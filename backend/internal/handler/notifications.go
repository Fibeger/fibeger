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

type NotificationsHandler struct {
	db  *gorm.DB
	hub *ws.Hub
}

func NewNotificationsHandler(db *gorm.DB, hub *ws.Hub) *NotificationsHandler {
	return &NotificationsHandler{db: db, hub: hub}
}

func (h *NotificationsHandler) GetNotifications(c *gin.Context) {
	userID := mw.GetUserID(c)
	unreadOnly := c.Query("unreadOnly") == "true"

	query := h.db.Where("user_id = ?", userID).Order("created_at DESC")
	if unreadOnly {
		query = query.Where("read = ?", false)
	}

	var notifications []model.Notification
	query.Find(&notifications)

	c.JSON(http.StatusOK, notifications)
}

func (h *NotificationsHandler) CreateNotification(c *gin.Context) {
	userID := mw.GetUserID(c)
	var req struct {
		Type    string `json:"type" binding:"required"`
		Title   string `json:"title" binding:"required"`
		Message string `json:"message" binding:"required"`
		Link    string `json:"link"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	notif := model.Notification{
		UserID:  userID,
		Type:    req.Type,
		Title:   req.Title,
		Message: req.Message,
	}
	if req.Link != "" {
		notif.Link = &req.Link
	}
	h.db.Create(&notif)

	h.hub.Emit(userID, ws.EventNotification, notif)
	c.JSON(http.StatusCreated, notif)
}

func (h *NotificationsHandler) UpdateNotification(c *gin.Context) {
	userID := mw.GetUserID(c)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	var req struct {
		Read bool `json:"read"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result := h.db.Model(&model.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("read", req.Read)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Updated"})
}

func (h *NotificationsHandler) DeleteNotification(c *gin.Context) {
	userID := mw.GetUserID(c)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid notification ID"})
		return
	}

	result := h.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.Notification{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notification not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted"})
}

func (h *NotificationsHandler) MarkAllRead(c *gin.Context) {
	userID := mw.GetUserID(c)
	h.db.Model(&model.Notification{}).
		Where("user_id = ? AND read = ?", userID, false).
		Update("read", true)

	c.JSON(http.StatusOK, gin.H{"message": "All marked as read"})
}
