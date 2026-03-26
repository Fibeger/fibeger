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

type MessagesHandler struct {
	db  *gorm.DB
	hub *ws.Hub
}

func NewMessagesHandler(db *gorm.DB, hub *ws.Hub) *MessagesHandler {
	return &MessagesHandler{db: db, hub: hub}
}

func (h *MessagesHandler) DeleteMessage(c *gin.Context) {
	userID := mw.GetUserID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var msg model.Message
	if err := h.db.First(&msg, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	if msg.SenderID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Can only delete own messages"})
		return
	}

	h.db.Delete(&msg)

	eventData := gin.H{"messageId": id}
	if msg.ConversationID != nil {
		eventData["conversationId"] = *msg.ConversationID
		var members []model.ConversationMember
		h.db.Where("conversation_id = ?", *msg.ConversationID).Find(&members)
		for _, m := range members {
			h.hub.Emit(m.UserID, ws.EventMessageDeleted, eventData)
		}
	}
	if msg.GroupChatID != nil {
		eventData["groupChatId"] = *msg.GroupChatID
		var members []model.GroupChatMember
		h.db.Where("group_chat_id = ?", *msg.GroupChatID).Find(&members)
		for _, m := range members {
			h.hub.Emit(m.UserID, ws.EventMessageDeleted, eventData)
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Message deleted"})
}

func (h *MessagesHandler) AddReaction(c *gin.Context) {
	userID := mw.GetUserID(c)
	msgID, _ := strconv.Atoi(c.Param("id"))

	var req struct {
		Emoji string `json:"emoji" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var msg model.Message
	if err := h.db.First(&msg, msgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	reaction := model.Reaction{MessageID: msgID, UserID: userID, Emoji: req.Emoji}
	if err := h.db.Create(&reaction).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Reaction already exists"})
		return
	}

	h.db.Preload("User").First(&reaction, reaction.ID)
	h.broadcastToMessageMembers(&msg, ws.EventReaction, gin.H{
		"messageId": msgID, "reaction": reaction, "action": "add",
	})

	c.JSON(http.StatusCreated, reaction)
}

func (h *MessagesHandler) RemoveReaction(c *gin.Context) {
	userID := mw.GetUserID(c)
	msgID, _ := strconv.Atoi(c.Param("id"))

	var req struct {
		Emoji string `json:"emoji" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var msg model.Message
	if err := h.db.First(&msg, msgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Message not found"})
		return
	}

	result := h.db.Where("message_id = ? AND user_id = ? AND emoji = ?", msgID, userID, req.Emoji).Delete(&model.Reaction{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Reaction not found"})
		return
	}

	h.broadcastToMessageMembers(&msg, ws.EventReaction, gin.H{
		"messageId": msgID, "userId": userID, "emoji": req.Emoji, "action": "remove",
	})

	c.JSON(http.StatusOK, gin.H{"message": "Reaction removed"})
}

func (h *MessagesHandler) MarkAsRead(c *gin.Context) {
	userID := mw.GetUserID(c)
	var req struct {
		MessageID      int  `json:"messageId" binding:"required"`
		ConversationID *int `json:"conversationId"`
		GroupChatID    *int `json:"groupChatId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.ConversationID != nil {
		h.db.Model(&model.ConversationMember{}).
			Where("conversation_id = ? AND user_id = ?", *req.ConversationID, userID).
			Update("last_read_message_id", req.MessageID)

		var members []model.ConversationMember
		h.db.Where("conversation_id = ?", *req.ConversationID).Find(&members)
		for _, m := range members {
			h.hub.Emit(m.UserID, ws.EventConversationUpdate, gin.H{"conversationId": *req.ConversationID})
		}
	}

	if req.GroupChatID != nil {
		h.db.Model(&model.GroupChatMember{}).
			Where("group_chat_id = ? AND user_id = ?", *req.GroupChatID, userID).
			Update("last_read_message_id", req.MessageID)

		var members []model.GroupChatMember
		h.db.Where("group_chat_id = ?", *req.GroupChatID).Find(&members)
		for _, m := range members {
			h.hub.Emit(m.UserID, ws.EventGroupUpdate, gin.H{"groupChatId": *req.GroupChatID})
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Marked as read"})
}

func (h *MessagesHandler) Typing(c *gin.Context) {
	userID := mw.GetUserID(c)
	var req struct {
		ConversationID *int `json:"conversationId"`
		GroupChatID    *int `json:"groupChatId"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user model.User
	h.db.First(&user, userID)

	typingData := gin.H{"userId": userID, "username": user.Username}

	if req.ConversationID != nil {
		typingData["conversationId"] = *req.ConversationID
		var members []model.ConversationMember
		h.db.Where("conversation_id = ?", *req.ConversationID).Find(&members)
		for _, m := range members {
			if m.UserID != userID {
				h.hub.Emit(m.UserID, ws.EventTyping, typingData)
			}
		}
	}

	if req.GroupChatID != nil {
		typingData["groupChatId"] = *req.GroupChatID
		var members []model.GroupChatMember
		h.db.Where("group_chat_id = ?", *req.GroupChatID).Find(&members)
		for _, m := range members {
			if m.UserID != userID {
				h.hub.Emit(m.UserID, ws.EventTyping, typingData)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "OK"})
}

func (h *MessagesHandler) broadcastToMessageMembers(msg *model.Message, eventType ws.EventType, data any) {
	if msg.ConversationID != nil {
		var members []model.ConversationMember
		h.db.Where("conversation_id = ?", *msg.ConversationID).Find(&members)
		for _, m := range members {
			h.hub.Emit(m.UserID, eventType, data)
		}
	}
	if msg.GroupChatID != nil {
		var members []model.GroupChatMember
		h.db.Where("group_chat_id = ?", *msg.GroupChatID).Find(&members)
		for _, m := range members {
			h.hub.Emit(m.UserID, eventType, data)
		}
	}
}
