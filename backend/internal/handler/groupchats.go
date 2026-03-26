package handler

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"

	mw "github.com/fibeger/backend/internal/middleware"
	"github.com/fibeger/backend/internal/model"
	"github.com/fibeger/backend/internal/storage"
	ws "github.com/fibeger/backend/internal/websocket"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type GroupChatsHandler struct {
	db      *gorm.DB
	hub     *ws.Hub
	storage *storage.StorageService
}

func NewGroupChatsHandler(db *gorm.DB, hub *ws.Hub, storage *storage.StorageService) *GroupChatsHandler {
	return &GroupChatsHandler{db: db, hub: hub, storage: storage}
}

func (h *GroupChatsHandler) GetGroupChats(c *gin.Context) {
	userID := mw.GetUserID(c)

	var memberships []model.GroupChatMember
	h.db.Where("user_id = ?", userID).Find(&memberships)

	groupIDs := make([]int, len(memberships))
	lastReadMap := make(map[int]*int)
	for i, m := range memberships {
		groupIDs[i] = m.GroupChatID
		lastReadMap[m.GroupChatID] = m.LastReadMessageID
	}

	var groups []model.GroupChat
	h.db.Where("id IN ?", groupIDs).
		Preload("Members.User").
		Preload("Messages", func(db *gorm.DB) *gorm.DB {
			return db.Order("created_at DESC").Limit(1)
		}).
		Preload("Messages.Sender").
		Find(&groups)

	result := make([]gin.H, len(groups))
	for i, group := range groups {
		unreadCount := 0
		lastRead := lastReadMap[group.ID]
		if lastRead != nil {
			var count int64
			h.db.Model(&model.Message{}).Where("group_chat_id = ? AND id > ?", group.ID, *lastRead).Count(&count)
			unreadCount = int(count)
		} else {
			var count int64
			h.db.Model(&model.Message{}).Where("group_chat_id = ?", group.ID).Count(&count)
			unreadCount = int(count)
		}

		result[i] = gin.H{
			"id": group.ID, "name": group.Name, "description": group.Description,
			"avatar": group.Avatar, "createdAt": group.CreatedAt, "updatedAt": group.UpdatedAt,
			"members": group.Members, "messages": group.Messages,
			"unreadCount": unreadCount,
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *GroupChatsHandler) CreateGroupChat(c *gin.Context) {
	userID := mw.GetUserID(c)
	var req struct {
		Name        string `json:"name" binding:"required"`
		Description string `json:"description"`
		MemberIDs   []int  `json:"memberIds"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	group := model.GroupChat{Name: req.Name, Description: &req.Description}
	h.db.Create(&group)

	h.db.Create(&model.GroupChatMember{GroupChatID: group.ID, UserID: userID, Role: "admin"})
	for _, memberID := range req.MemberIDs {
		if memberID != userID {
			h.db.Create(&model.GroupChatMember{GroupChatID: group.ID, UserID: memberID})
		}
	}

	h.db.Preload("Members.User").First(&group, group.ID)
	c.JSON(http.StatusCreated, group)
}

func (h *GroupChatsHandler) GetGroupChat(c *gin.Context) {
	userID := mw.GetUserID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var member model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ?", id, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}

	var group model.GroupChat
	h.db.Preload("Members.User").First(&group, id)
	c.JSON(http.StatusOK, group)
}

func (h *GroupChatsHandler) DeleteGroupChat(c *gin.Context) {
	userID := mw.GetUserID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	var member model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ? AND role = ?", id, userID, "admin").First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
		return
	}

	var members []model.GroupChatMember
	h.db.Where("group_chat_id = ?", id).Find(&members)

	h.db.Delete(&model.GroupChat{}, id)

	for _, m := range members {
		h.hub.Emit(m.UserID, ws.EventGroupDeleted, gin.H{"groupChatId": id})
	}

	c.JSON(http.StatusOK, gin.H{"message": "Group deleted"})
}

func (h *GroupChatsHandler) GetMessages(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, _ := strconv.Atoi(c.Param("id"))

	var member model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ?", groupID, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}

	var messages []model.Message
	h.db.Where("group_chat_id = ?", groupID).
		Preload("Sender").Preload("Reactions.User").Preload("ReplyTo.Sender").
		Order("created_at ASC").Find(&messages)

	c.JSON(http.StatusOK, messages)
}

func (h *GroupChatsHandler) SendMessage(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, _ := strconv.Atoi(c.Param("id"))

	var member model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ?", groupID, userID).First(&member).Error; err != nil {
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
		Content:     req.Content,
		Attachments: req.Attachments,
		SenderID:    userID,
		GroupChatID: &groupID,
		ReplyToID:   req.ReplyToID,
	}
	h.db.Create(&msg)
	h.db.Preload("Sender").Preload("ReplyTo.Sender").First(&msg, msg.ID)

	h.db.Model(&model.GroupChat{}).Where("id = ?", groupID).Update("updated_at", msg.CreatedAt)

	var members []model.GroupChatMember
	h.db.Where("group_chat_id = ?", groupID).Find(&members)

	for _, m := range members {
		h.hub.Emit(m.UserID, ws.EventMessage, msg)
		h.hub.Emit(m.UserID, ws.EventGroupUpdate, gin.H{"groupChatId": groupID})

		if m.UserID != userID {
			var sender model.User
			h.db.First(&sender, userID)
			notif := model.Notification{
				UserID:  m.UserID,
				Type:    "message",
				Title:   "New Group Message",
				Message: sender.Username + ": " + truncate(req.Content, 50),
			}
			h.db.Create(&notif)
			h.hub.Emit(m.UserID, ws.EventNotification, notif)
		}
	}

	c.JSON(http.StatusCreated, msg)
}

func (h *GroupChatsHandler) AddMember(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, _ := strconv.Atoi(c.Param("id"))

	var admin model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ? AND role = ?", groupID, userID, "admin").First(&admin).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
		return
	}

	var req struct {
		UserID int `json:"userId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existing model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ?", groupID, req.UserID).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Already a member"})
		return
	}

	h.db.Create(&model.GroupChatMember{GroupChatID: groupID, UserID: req.UserID})

	var group model.GroupChat
	h.db.First(&group, groupID)

	notif := model.Notification{
		UserID:  req.UserID,
		Type:    "group_invite",
		Title:   "Group Invite",
		Message: "You were added to " + group.Name,
	}
	h.db.Create(&notif)
	h.hub.Emit(req.UserID, ws.EventNotification, notif)

	c.JSON(http.StatusOK, gin.H{"message": "Member added"})
}

func (h *GroupChatsHandler) RemoveMember(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, _ := strconv.Atoi(c.Param("id"))
	targetUserID, _ := strconv.Atoi(c.Param("userId"))

	if targetUserID == userID {
		var member model.GroupChatMember
		if err := h.db.Where("group_chat_id = ? AND user_id = ?", groupID, userID).First(&member).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not a member"})
			return
		}

		if member.Role == "admin" {
			var adminCount int64
			h.db.Model(&model.GroupChatMember{}).Where("group_chat_id = ? AND role = ?", groupID, "admin").Count(&adminCount)
			if adminCount <= 1 {
				var memberCount int64
				h.db.Model(&model.GroupChatMember{}).Where("group_chat_id = ?", groupID).Count(&memberCount)
				if memberCount > 1 {
					c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot leave as the only admin. Promote another member first."})
					return
				}
			}
		}

		h.db.Delete(&member)
		c.JSON(http.StatusOK, gin.H{"message": "Left group"})
		return
	}

	var admin model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ? AND role = ?", groupID, userID, "admin").First(&admin).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
		return
	}

	h.db.Where("group_chat_id = ? AND user_id = ?", groupID, targetUserID).Delete(&model.GroupChatMember{})
	c.JSON(http.StatusOK, gin.H{"message": "Member removed"})
}

func (h *GroupChatsHandler) UploadAvatar(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, _ := strconv.Atoi(c.Param("id"))

	var admin model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ? AND role = ?", groupID, userID, "admin").First(&admin).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin only"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	data, _ := io.ReadAll(file)
	hash := storage.HashFile(data)
	contentType := header.Header.Get("Content-Type")

	var existing model.FileBlob
	if err := h.db.Where("hash = ?", hash).First(&existing).Error; err == nil {
		h.db.Model(&model.GroupChat{}).Where("id = ?", groupID).Update("avatar", existing.URL)
		h.notifyGroupUpdated(groupID)
		c.JSON(http.StatusOK, gin.H{"avatar": existing.URL})
		return
	}

	filename := fmt.Sprintf("groups/%d_%d_%s", groupID, time.Now().UnixMilli(), header.Filename)
	url, err := h.storage.Upload(filename, data, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Upload failed"})
		return
	}

	h.db.Create(&model.FileBlob{Hash: hash, URL: url, ContentType: contentType, Size: len(data), UploadedBy: userID})
	h.db.Model(&model.GroupChat{}).Where("id = ?", groupID).Update("avatar", url)
	h.notifyGroupUpdated(groupID)

	c.JSON(http.StatusOK, gin.H{"avatar": url})
}

func (h *GroupChatsHandler) notifyGroupUpdated(groupID int) {
	var members []model.GroupChatMember
	h.db.Where("group_chat_id = ?", groupID).Find(&members)
	for _, m := range members {
		h.hub.Emit(m.UserID, ws.EventGroupUpdated, gin.H{"groupChatId": groupID})
	}
}
