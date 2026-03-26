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

type FeedHandler struct {
	db  *gorm.DB
	hub *ws.Hub
}

func NewFeedHandler(db *gorm.DB, hub *ws.Hub) *FeedHandler {
	return &FeedHandler{db: db, hub: hub}
}

func (h *FeedHandler) GetFeed(c *gin.Context) {
	userID := mw.GetUserID(c)
	feedType := c.DefaultQuery("type", "friends")
	userIDFilter := c.Query("userId")

	query := h.db.Preload("User").Preload("Likes").Order("created_at DESC")

	if userIDFilter != "" {
		filterID, _ := strconv.Atoi(userIDFilter)
		if filterID == userID {
			query = query.Where("user_id = ?", userID)
		} else {
			var isFriend int64
			h.db.Model(&model.Friend{}).Where("user_id = ? AND friend_id = ?", userID, filterID).Count(&isFriend)
			if isFriend > 0 {
				query = query.Where("user_id = ?", filterID)
			} else {
				query = query.Where("user_id = ? AND is_public = ?", filterID, true)
			}
		}
	} else if feedType == "public" {
		query = query.Where("is_public = ?", true)
	} else {
		var friendIDs []int
		h.db.Model(&model.Friend{}).Where("user_id = ?", userID).Pluck("friend_id", &friendIDs)
		friendIDs = append(friendIDs, userID)
		query = query.Where("user_id IN ?", friendIDs)
	}

	var posts []model.FeedPost
	query.Find(&posts)

	result := make([]gin.H, len(posts))
	for i, post := range posts {
		likeCount := len(post.Likes)
		isLiked := false
		for _, like := range post.Likes {
			if like.UserID == userID {
				isLiked = true
				break
			}
		}
		result[i] = gin.H{
			"id": post.ID, "userId": post.UserID, "caption": post.Caption,
			"mediaUrl": post.MediaURL, "mediaType": post.MediaType,
			"isPublic": post.IsPublic, "createdAt": post.CreatedAt,
			"updatedAt": post.UpdatedAt, "user": post.User,
			"_count": gin.H{"likes": likeCount}, "isLiked": isLiked,
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *FeedHandler) CreatePost(c *gin.Context) {
	userID := mw.GetUserID(c)
	var req struct {
		Caption   *string `json:"caption"`
		MediaURL  string  `json:"mediaUrl" binding:"required"`
		MediaType string  `json:"mediaType" binding:"required"`
		IsPublic  bool    `json:"isPublic"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	post := model.FeedPost{
		UserID:    userID,
		Caption:   req.Caption,
		MediaURL:  req.MediaURL,
		MediaType: req.MediaType,
		IsPublic:  req.IsPublic,
	}
	h.db.Create(&post)
	h.db.Preload("User").First(&post, post.ID)

	c.JSON(http.StatusCreated, post)
}

func (h *FeedHandler) DeletePost(c *gin.Context) {
	userID := mw.GetUserID(c)
	id, _ := strconv.Atoi(c.Param("id"))

	result := h.db.Where("id = ? AND user_id = ?", id, userID).Delete(&model.FeedPost{})
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Post deleted"})
}

func (h *FeedHandler) ToggleLike(c *gin.Context) {
	userID := mw.GetUserID(c)
	postID, _ := strconv.Atoi(c.Param("id"))

	var existing model.FeedLike
	if err := h.db.Where("post_id = ? AND user_id = ?", postID, userID).First(&existing).Error; err == nil {
		h.db.Delete(&existing)
		c.JSON(http.StatusOK, gin.H{"liked": false})
		return
	}

	h.db.Create(&model.FeedLike{PostID: postID, UserID: userID})
	c.JSON(http.StatusOK, gin.H{"liked": true})
}
