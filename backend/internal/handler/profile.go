package handler

import (
	"fmt"
	"io"
	"net/http"
	"time"

	mw "github.com/fibeger/backend/internal/middleware"
	"github.com/fibeger/backend/internal/model"
	"github.com/fibeger/backend/internal/storage"
	ws "github.com/fibeger/backend/internal/websocket"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type ProfileHandler struct {
	db      *gorm.DB
	hub     *ws.Hub
	storage *storage.StorageService
}

func NewProfileHandler(db *gorm.DB, hub *ws.Hub, storage *storage.StorageService) *ProfileHandler {
	return &ProfileHandler{db: db, hub: hub, storage: storage}
}

func (h *ProfileHandler) GetProfile(c *gin.Context) {
	userID := mw.GetUserID(c)
	var user model.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}

func (h *ProfileHandler) UpdateProfile(c *gin.Context) {
	userID := mw.GetUserID(c)
	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	delete(updates, "id")
	delete(updates, "username")
	delete(updates, "email")
	delete(updates, "password")
	delete(updates, "createdAt")

	if err := h.db.Model(&model.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	var user model.User
	h.db.First(&user, userID)
	c.JSON(http.StatusOK, user)
}

func (h *ProfileHandler) GetProfileByUsername(c *gin.Context) {
	username := c.Param("username")
	userID := mw.GetUserID(c)

	var user model.User
	if err := h.db.Where("username = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	isOwnProfile := user.ID == userID
	isFriend := false
	if !isOwnProfile {
		var count int64
		h.db.Model(&model.Friend{}).Where("user_id = ? AND friend_id = ?", userID, user.ID).Count(&count)
		isFriend = count > 0
	}

	c.JSON(http.StatusOK, gin.H{
		"id": user.ID, "username": user.Username, "email": user.Email,
		"nickname": user.Nickname, "bio": user.Bio, "avatar": user.Avatar,
		"banner": user.Banner, "country": user.Country, "city": user.City,
		"pronouns": user.Pronouns, "birthday": user.Birthday,
		"website": user.Website, "socialLinks": user.SocialLinks,
		"status": user.Status, "themeColor": user.ThemeColor,
		"interests": user.Interests, "personalityBadge": user.PersonalityBadge,
		"showPersonalityBadge": user.ShowPersonalityBadge,
		"steamUsername": user.SteamUsername,
		"createdAt": user.CreatedAt, "updatedAt": user.UpdatedAt,
		"isOwnProfile": isOwnProfile, "isFriend": isFriend,
	})
}

func (h *ProfileHandler) GetProfileFriends(c *gin.Context) {
	username := c.Param("username")
	var user model.User
	if err := h.db.Where("username = ?", username).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	var friends []model.Friend
	h.db.Where("user_id = ?", user.ID).Preload("FriendUser").Find(&friends)

	users := make([]model.User, len(friends))
	for i, f := range friends {
		users[i] = f.FriendUser
	}
	c.JSON(http.StatusOK, users)
}

func (h *ProfileHandler) UploadAvatar(c *gin.Context) {
	userID := mw.GetUserID(c)
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
		h.db.Model(&model.User{}).Where("id = ?", userID).Update("avatar", existing.URL)
		c.JSON(http.StatusOK, gin.H{"avatar": existing.URL})
		return
	}

	filename := fmt.Sprintf("avatars/%d_%d_%s", userID, time.Now().UnixMilli(), header.Filename)
	url, err := h.storage.Upload(filename, data, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Upload failed"})
		return
	}

	h.db.Create(&model.FileBlob{Hash: hash, URL: url, ContentType: contentType, Size: len(data), UploadedBy: userID})
	h.db.Model(&model.User{}).Where("id = ?", userID).Update("avatar", url)

	c.JSON(http.StatusOK, gin.H{"avatar": url})
}

func (h *ProfileHandler) UploadBanner(c *gin.Context) {
	userID := mw.GetUserID(c)
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
		h.db.Model(&model.User{}).Where("id = ?", userID).Update("banner", existing.URL)
		c.JSON(http.StatusOK, gin.H{"banner": existing.URL})
		return
	}

	filename := fmt.Sprintf("banners/%d_%d_%s", userID, time.Now().UnixMilli(), header.Filename)
	url, err := h.storage.Upload(filename, data, contentType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Upload failed"})
		return
	}

	h.db.Create(&model.FileBlob{Hash: hash, URL: url, ContentType: contentType, Size: len(data), UploadedBy: userID})
	h.db.Model(&model.User{}).Where("id = ?", userID).Update("banner", url)

	c.JSON(http.StatusOK, gin.H{"banner": url})
}

func (h *ProfileHandler) DeleteBanner(c *gin.Context) {
	userID := mw.GetUserID(c)
	h.db.Model(&model.User{}).Where("id = ?", userID).Update("banner", nil)
	c.JSON(http.StatusOK, gin.H{"message": "Banner removed"})
}

func (h *ProfileHandler) ChangeUsername(c *gin.Context) {
	userID := mw.GetUserID(c)
	var req struct {
		Username string `json:"username" binding:"required,min=3,max=30"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user model.User
	h.db.First(&user, userID)

	if user.LastUsernameChange != nil && time.Since(*user.LastUsernameChange) < 7*24*time.Hour {
		c.JSON(http.StatusBadRequest, gin.H{"error": "You can only change your username once every 7 days"})
		return
	}

	var count int64
	h.db.Model(&model.User{}).Where("username = ? AND id != ?", req.Username, userID).Count(&count)
	if count > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "Username already taken"})
		return
	}

	now := time.Now()
	h.db.Create(&model.UsernameHistory{UserID: userID, OldUsername: user.Username, NewUsername: req.Username})
	h.db.Model(&user).Updates(map[string]interface{}{
		"username":             req.Username,
		"last_username_change": now,
	})

	h.db.First(&user, userID)
	c.JSON(http.StatusOK, user)
}

func (h *ProfileHandler) DeleteAccount(c *gin.Context) {
	userID := mw.GetUserID(c)
	if err := h.db.Delete(&model.User{}, userID).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete account"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Account deleted"})
}
