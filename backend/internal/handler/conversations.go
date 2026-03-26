package handler

import (
	"net/http"
	"strconv"

	mw "github.com/fibeger/backend/internal/middleware"
	"github.com/fibeger/backend/internal/model"
	ws "github.com/fibeger/backend/internal/websocket"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ConversationsHandler struct {
	db  *gorm.DB
	hub *ws.Hub
}

func NewConversationsHandler(db *gorm.DB, hub *ws.Hub) *ConversationsHandler {
	return &ConversationsHandler{db: db, hub: hub}
}

func (h *ConversationsHandler) GetConversations(c *gin.Context) {
	userID := mw.GetUserID(c)

	var memberships []model.ConversationMember
	h.db.Where("user_id = ?", userID).Find(&memberships)

	convIDs := make([]int, len(memberships))
	lastReadMap := make(map[int]*int)
	for i, m := range memberships {
		convIDs[i] = m.ConversationID
		lastReadMap[m.ConversationID] = m.LastReadMessageID
	}

	var conversations []model.Conversation
	h.db.Where("id IN ?", convIDs).
		Preload("Members.User").
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at DESC").Limit(1)
		}).
		Preload("Messages.Sender").
		Find(&conversations)

	result := make([]gin.H, len(conversations))
	for i, conv := range conversations {
		unreadCount := 0
		lastRead := lastReadMap[conv.ID]
		if lastRead != nil {
			var count int64
			h.db.Model(&model.Message{}).Where("conversation_id = ? AND id > ?", conv.ID, *lastRead).Count(&count)
			unreadCount = int(count)
		} else {
			var count int64
			h.db.Model(&model.Message{}).Where("conversation_id = ?", conv.ID).Count(&count)
			unreadCount = int(count)
		}

		result[i] = gin.H{
			"id": conv.ID, "createdAt": conv.CreatedAt, "updatedAt": conv.UpdatedAt,
			"members": conv.Members, "messages": conv.Messages,
			"unreadCount": unreadCount,
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *ConversationsHandler) CreateConversation(c *gin.Context) {
	userID := mw.GetUserID(c)
	var req struct {
		FriendID int `json:"friendId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var isFriend int64
	h.db.Model(&model.Friend{}).Where("user_id = ? AND friend_id = ?", userID, req.FriendID).Count(&isFriend)
	if isFriend == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Must be friends to start a conversation"})
		return
	}

	var existingMember model.ConversationMember
	if err := h.db.Where("user_id = ?", userID).First(&existingMember).Error; err == nil {
		var otherMember model.ConversationMember
		if err := h.db.Where("conversation_id = ? AND user_id = ?", existingMember.ConversationID, req.FriendID).First(&otherMember).Error; err == nil {
			var memberCount int64
			h.db.Model(&model.ConversationMember{}).Where("conversation_id = ?", existingMember.ConversationID).Count(&memberCount)
			if memberCount == 2 {
				var conv model.Conversation
				h.db.Preload("Members.User").First(&conv, existingMember.ConversationID)
				c.JSON(http.StatusOK, conv)
				return
			}
		}
	}

	subQuery := h.db.Model(&model.ConversationMember{}).Select("conversation_id").Where("user_id = ?", userID)
	var sharedConvIDs []int
	h.db.Model(&model.ConversationMember{}).Select("conversation_id").
		Where("user_id = ? AND conversation_id IN (?)", req.FriendID, subQuery).
		Pluck("conversation_id", &sharedConvIDs)

	for _, convID := range sharedConvIDs {
		var memberCount int64
		h.db.Model(&model.ConversationMember{}).Where("conversation_id = ?", convID).Count(&memberCount)
		if memberCount == 2 {
			var conv model.Conversation
			h.db.Preload("Members.User").First(&conv, convID)
			c.JSON(http.StatusOK, conv)
			return
		}
	}

	conv := model.Conversation{}
	h.db.Create(&conv)
	h.db.Create(&model.ConversationMember{ConversationID: conv.ID, UserID: userID})
	h.db.Create(&model.ConversationMember{ConversationID: conv.ID, UserID: req.FriendID})

	h.db.Preload("Members.User").First(&conv, conv.ID)
	c.JSON(http.StatusCreated, conv)
}

func (h *ConversationsHandler) GetConversation(c *gin.Context) {
	userID := mw.GetUserID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var member model.ConversationMember
	if err := h.db.Where("conversation_id = ? AND user_id = ?", id, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}

	var conv model.Conversation
	h.db.Preload("Members.User").First(&conv, id)
	c.JSON(http.StatusOK, conv)
}

func (h *ConversationsHandler) DeleteConversation(c *gin.Context) {
	userID := mw.GetUserID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var member model.ConversationMember
	if err := h.db.Where("conversation_id = ? AND user_id = ?", id, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}

	var members []model.ConversationMember
	h.db.Where("conversation_id = ?", id).Find(&members)

	h.db.Delete(&model.Conversation{}, id)

	for _, m := range members {
		if m.UserID != userID {
			h.hub.Emit(m.UserID, ws.EventConversationDeleted, gin.H{"conversationId": id})
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Conversation deleted"})
}

func (h *ConversationsHandler) GetMessages(c *gin.Context) {
	userID := mw.GetUserID(c)
	convID, _ := strconv.Atoi(c.Param("id"))

	var member model.ConversationMember
	if err := h.db.Where("conversation_id = ? AND user_id = ?", convID, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}

	var messages []model.Message
	h.db.Where("conversation_id = ?", convID).
		Preload("Sender").Preload("Reactions.User").Preload("ReplyTo.Sender").
		Order("created_at ASC").Find(&messages)

	c.JSON(http.StatusOK, messages)
}

func (h *ConversationsHandler) SendMessage(c *gin.Context) {
	userID := mw.GetUserID(c)
	convID, _ := strconv.Atoi(c.Param("id"))

	var member model.ConversationMember
	if err := h.db.Where("conversation_id = ? AND user_id = ?", convID, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}

	var req struct {
		Content     string  `json:"content" binding:"required"`
		Attachments *string `json:"attachments"`
		ReplyToID   *int    `json:"replyToId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	msg := model.Message{
		Content:        req.Content,
		Attachments:    req.Attachments,
		SenderID:       userID,
		ConversationID: &convID,
		ReplyToID:      req.ReplyToID,
	}
	h.db.Create(&msg)
	h.db.Preload("Sender").Preload("ReplyTo.Sender").First(&msg, msg.ID)

	h.db.Model(&model.Conversation{}).Where("id = ?", convID).Update("updated_at", msg.CreatedAt)

	var members []model.ConversationMember
	h.db.Where("conversation_id = ?", convID).Find(&members)

	for _, m := range members {
		h.hub.Emit(m.UserID, ws.EventMessage, msg)
		h.hub.Emit(m.UserID, ws.EventConversationUpdate, gin.H{"conversationId": convID})

		if m.UserID != userID {
			var sender model.User
			h.db.First(&sender, userID)
			notif := model.Notification{
				UserID:  m.UserID,
				Type:    "message",
				Title:   "New Message",
				Message: sender.Username + ": " + truncate(req.Content, 50),
			}
			h.db.Create(&notif)
			h.hub.Emit(m.UserID, ws.EventNotification, notif)
		}
	}

	c.JSON(http.StatusCreated, msg)
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
