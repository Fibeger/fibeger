package handler

import (
	"net/http"
	"strconv"
	"time"

	mw "github.com/fibeger/backend/internal/middleware"
	"github.com/fibeger/backend/internal/model"
	ws "github.com/fibeger/backend/internal/websocket"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CallsHandler struct {
	db  *gorm.DB
	hub *ws.Hub
}

func NewCallsHandler(db *gorm.DB, hub *ws.Hub) *CallsHandler {
	return &CallsHandler{db: db, hub: hub}
}

func (h *CallsHandler) GetCall(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var memberCount int64
	h.db.Model(&model.GroupChatMember{}).Where("group_chat_id = ? AND user_id = ?", groupID, userID).Count(&memberCount)
	if memberCount == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}

	var call model.GroupCall
	if err := h.db.Where("group_chat_id = ? AND status = ?", groupID, "active").
		Preload("Participants.User").Preload("StartedBy").
		First(&call).Error; err != nil {
		c.JSON(http.StatusOK, nil)
		return
	}

	c.JSON(http.StatusOK, call)
}

func (h *CallsHandler) StartCall(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var member model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ?", groupID, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}

	var existing model.GroupCall
	if err := h.db.Where("group_chat_id = ? AND status = ?", groupID, "active").First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "A call is already active"})
		return
	}

	call := model.GroupCall{GroupChatID: groupID, StartedByID: userID}
	h.db.Create(&call)
	h.db.Create(&model.GroupCallParticipant{CallID: call.ID, UserID: userID})
	h.db.Preload("Participants.User").Preload("StartedBy").First(&call, call.ID)

	var members []model.GroupChatMember
	h.db.Where("group_chat_id = ?", groupID).Find(&members)
	for _, m := range members {
		h.hub.Emit(m.UserID, ws.EventCallStarted, call)
	}

	c.JSON(http.StatusCreated, call)
}

func (h *CallsHandler) EndCall(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var call model.GroupCall
	if err := h.db.Where("group_chat_id = ? AND status = ?", groupID, "active").First(&call).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active call"})
		return
	}

	var member model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ?", groupID, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}
	if call.StartedByID != userID && member.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only the starter or admin can end the call"})
		return
	}

	now := time.Now()
	h.db.Model(&call).Updates(map[string]interface{}{"status": "ended", "ended_at": now})

	var members []model.GroupChatMember
	h.db.Where("group_chat_id = ?", groupID).Find(&members)
	for _, m := range members {
		h.hub.Emit(m.UserID, ws.EventCallEnded, gin.H{"groupChatId": groupID, "callId": call.ID})
	}

	c.JSON(http.StatusOK, gin.H{"message": "Call ended"})
}

func (h *CallsHandler) JoinCall(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var memberCount int64
	h.db.Model(&model.GroupChatMember{}).Where("group_chat_id = ? AND user_id = ?", groupID, userID).Count(&memberCount)
	if memberCount == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}

	var call model.GroupCall
	if err := h.db.Where("group_chat_id = ? AND status = ?", groupID, "active").First(&call).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active call"})
		return
	}

	h.db.Where("call_id = ? AND user_id = ?", call.ID, userID).Delete(&model.GroupCallParticipant{})
	h.db.Create(&model.GroupCallParticipant{CallID: call.ID, UserID: userID})

	var user model.User
	h.db.First(&user, userID)

	var members []model.GroupChatMember
	h.db.Where("group_chat_id = ?", groupID).Find(&members)
	for _, m := range members {
		h.hub.Emit(m.UserID, ws.EventCallParticipantJoined, gin.H{
			"callId": call.ID, "userId": userID, "user": user,
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "Joined call"})
}

func (h *CallsHandler) LeaveCall(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var call model.GroupCall
	if err := h.db.Where("group_chat_id = ? AND status = ?", groupID, "active").First(&call).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "No active call"})
		return
	}

	now := time.Now()
	h.db.Model(&model.GroupCallParticipant{}).
		Where("call_id = ? AND user_id = ? AND left_at IS NULL", call.ID, userID).
		Update("left_at", now)

	var activeCount int64
	h.db.Model(&model.GroupCallParticipant{}).
		Where("call_id = ? AND left_at IS NULL", call.ID).
		Count(&activeCount)

	var members []model.GroupChatMember
	h.db.Where("group_chat_id = ?", groupID).Find(&members)

	if activeCount == 0 {
		h.db.Model(&call).Updates(map[string]interface{}{"status": "ended", "ended_at": now})
		for _, m := range members {
			h.hub.Emit(m.UserID, ws.EventCallEnded, gin.H{"groupChatId": groupID, "callId": call.ID})
		}
	} else {
		for _, m := range members {
			h.hub.Emit(m.UserID, ws.EventCallParticipantLeft, gin.H{
				"callId": call.ID, "userId": userID,
			})
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "Left call"})
}

func (h *CallsHandler) Signal(c *gin.Context) {
	userID := mw.GetUserID(c)
	groupID, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}

	var member model.GroupChatMember
	if err := h.db.Where("group_chat_id = ? AND user_id = ?", groupID, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Not a member"})
		return
	}

	var req struct {
		TargetUserID int         `json:"targetUserId" binding:"required"`
		Signal       interface{} `json:"signal" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var targetMemberCount int64
	h.db.Model(&model.GroupChatMember{}).Where("group_chat_id = ? AND user_id = ?", groupID, req.TargetUserID).Count(&targetMemberCount)
	if targetMemberCount == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Target user is not a member of this group"})
		return
	}

	h.hub.Emit(req.TargetUserID, ws.EventCallSignal, gin.H{
		"fromUserId": userID, "signal": req.Signal, "groupChatId": groupID,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Signal sent"})
}
