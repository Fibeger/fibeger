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

type FriendsHandler struct {
	db  *gorm.DB
	hub *ws.Hub
}

func NewFriendsHandler(db *gorm.DB, hub *ws.Hub) *FriendsHandler {
	return &FriendsHandler{db: db, hub: hub}
}

func (h *FriendsHandler) GetFriends(c *gin.Context) {
	userID := mw.GetUserID(c)
	var friends []model.Friend
	h.db.Where("user_id = ?", userID).Preload("FriendUser").Find(&friends)

	users := make([]model.User, len(friends))
	for i, f := range friends {
		users[i] = f.FriendUser
	}
	c.JSON(http.StatusOK, users)
}

func (h *FriendsHandler) RemoveFriend(c *gin.Context) {
	userID := mw.GetUserID(c)
	var req struct {
		FriendID int `json:"friendId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.db.Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userID, req.FriendID, req.FriendID, userID).Delete(&model.Friend{})

	var user model.User
	h.db.First(&user, userID)

	h.hub.Emit(req.FriendID, ws.EventFriendRemoved, gin.H{
		"userId": userID, "username": user.Username,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Friend removed"})
}

func (h *FriendsHandler) SearchUsers(c *gin.Context) {
	userID := mw.GetUserID(c)
	search := c.Query("search")
	if search == "" {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}

	var users []model.User
	h.db.Select("id, username, nickname, avatar, status").
		Where("id != ? AND username ILIKE ?", userID, "%"+search+"%").
		Limit(10).Find(&users)

	c.JSON(http.StatusOK, users)
}

func (h *FriendsHandler) SendFriendRequest(c *gin.Context) {
	userID := mw.GetUserID(c)
	var req struct {
		ReceiverID int `json:"receiverId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.ReceiverID == userID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot send friend request to yourself"})
		return
	}

	var existing model.FriendRequest
	err := h.db.Where(
		"(sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)",
		userID, req.ReceiverID, req.ReceiverID, userID,
	).Where("status = ?", "pending").First(&existing).Error
	if err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Friend request already exists"})
		return
	}

	var friendCount int64
	h.db.Model(&model.Friend{}).Where("user_id = ? AND friend_id = ?", userID, req.ReceiverID).Count(&friendCount)
	if friendCount > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Already friends"})
		return
	}

	fr := model.FriendRequest{SenderID: userID, ReceiverID: req.ReceiverID}
	h.db.Create(&fr)

	var sender model.User
	h.db.First(&sender, userID)

	notif := model.Notification{
		UserID:  req.ReceiverID,
		Type:    "friend_request",
		Title:   "Friend Request",
		Message: sender.Username + " sent you a friend request",
	}
	h.db.Create(&notif)
	h.hub.Emit(req.ReceiverID, ws.EventNotification, notif)

	h.db.Preload("Sender").Preload("Receiver").First(&fr, fr.ID)
	c.JSON(http.StatusCreated, fr)
}

func (h *FriendsHandler) GetFriendRequest(c *gin.Context) {
	userID := mw.GetUserID(c)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid friend request ID"})
		return
	}

	var fr model.FriendRequest
	if err := h.db.Preload("Sender").Preload("Receiver").Where("id = ? AND (sender_id = ? OR receiver_id = ?)", id, userID, userID).First(&fr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Friend request not found"})
		return
	}
	c.JSON(http.StatusOK, fr)
}

func (h *FriendsHandler) RespondToFriendRequest(c *gin.Context) {
	userID := mw.GetUserID(c)
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid friend request ID"})
		return
	}

	var req struct {
		Action string `json:"action" binding:"required,oneof=accept reject"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var fr model.FriendRequest
	if err := h.db.Where("id = ? AND receiver_id = ? AND status = ?", id, userID, "pending").First(&fr).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Friend request not found"})
		return
	}

	if req.Action == "accept" {
		h.db.Model(&fr).Update("status", "accepted")
		h.db.Create(&model.Friend{UserID: fr.SenderID, FriendID: fr.ReceiverID})
		h.db.Create(&model.Friend{UserID: fr.ReceiverID, FriendID: fr.SenderID})

		var receiver model.User
		h.db.First(&receiver, userID)

		notif := model.Notification{
			UserID:  fr.SenderID,
			Type:    "friend_request",
			Title:   "Friend Request Accepted",
			Message: receiver.Username + " accepted your friend request",
		}
		h.db.Create(&notif)
		h.hub.Emit(fr.SenderID, ws.EventNotification, notif)
	} else {
		h.db.Model(&fr).Update("status", "rejected")
	}

	h.db.Preload("Sender").Preload("Receiver").First(&fr, fr.ID)
	c.JSON(http.StatusOK, fr)
}
