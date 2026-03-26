package handler

import (
	"net/http"
	"strings"
	"time"

	"github.com/fibeger/backend/internal/auth"
	mw "github.com/fibeger/backend/internal/middleware"
	"github.com/fibeger/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AuthHandler struct {
	db         *gorm.DB
	authConfig *auth.Config
}

func NewAuthHandler(db *gorm.DB, authConfig *auth.Config) *AuthHandler {
	return &AuthHandler{db: db, authConfig: authConfig}
}

func (h *AuthHandler) Signup(c *gin.Context) {
	var req struct {
		Username string `json:"username" binding:"required,min=3,max=30"`
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required,min=6"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	var existing model.User
	if err := h.db.Where("username = ? OR email = ?", req.Username, req.Email).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "Username or email already exists"})
		return
	}

	hashed, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	user := model.User{
		Username: req.Username,
		Email:    req.Email,
		Password: hashed,
	}
	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "Account created successfully"})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Login    string `json:"login" binding:"required"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user model.User
	if err := h.db.Where("username = ? OR email = ?", req.Login, req.Login).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if !auth.CheckPassword(req.Password, user.Password) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	accessToken, err := h.authConfig.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	refreshTokenStr := uuid.New().String()
	refreshToken := model.RefreshToken{
		UserID:    user.ID,
		Token:     refreshTokenStr,
		ExpiresAt: time.Now().Add(h.authConfig.RefreshTokenExpiry),
	}
	h.db.Create(&refreshToken)

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		MaxAge:   int(h.authConfig.AccessTokenExpiry.Seconds()),
		HttpOnly: true,
		Secure:   c.Request.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	})

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "refresh_token",
		Value:    refreshTokenStr,
		Path:     "/api/auth/refresh",
		MaxAge:   int(h.authConfig.RefreshTokenExpiry.Seconds()),
		HttpOnly: true,
		Secure:   c.Request.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	})

	user.Password = ""
	c.JSON(http.StatusOK, gin.H{
		"accessToken":  accessToken,
		"refreshToken": refreshTokenStr,
		"user":         user,
	})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}
	c.ShouldBindJSON(&req)

	tokenStr := req.RefreshToken
	if tokenStr == "" {
		if cookie, err := c.Cookie("refresh_token"); err == nil {
			tokenStr = cookie
		}
	}
	if tokenStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Refresh token required"})
		return
	}

	var rt model.RefreshToken
	if err := h.db.Where("token = ? AND expires_at > ?", tokenStr, time.Now()).First(&rt).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid refresh token"})
		return
	}

	var user model.User
	if err := h.db.First(&user, rt.UserID).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
		return
	}

	h.db.Delete(&rt)

	accessToken, _ := h.authConfig.GenerateAccessToken(user.ID, user.Username)
	newRefreshStr := uuid.New().String()
	h.db.Create(&model.RefreshToken{
		UserID:    user.ID,
		Token:     newRefreshStr,
		ExpiresAt: time.Now().Add(h.authConfig.RefreshTokenExpiry),
	})

	http.SetCookie(c.Writer, &http.Cookie{
		Name:     "access_token",
		Value:    accessToken,
		Path:     "/",
		MaxAge:   int(h.authConfig.AccessTokenExpiry.Seconds()),
		HttpOnly: true,
		Secure:   c.Request.TLS != nil,
		SameSite: http.SameSiteLaxMode,
	})

	user.Password = ""
	c.JSON(http.StatusOK, gin.H{
		"accessToken":  accessToken,
		"refreshToken": newRefreshStr,
		"user":         user,
	})
}

func (h *AuthHandler) Logout(c *gin.Context) {
	userID := mw.GetUserID(c)
	h.db.Where("user_id = ?", userID).Delete(&model.RefreshToken{})

	http.SetCookie(c.Writer, &http.Cookie{
		Name:   "access_token",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})
	http.SetCookie(c.Writer, &http.Cookie{
		Name:   "refresh_token",
		Value:  "",
		Path:   "/api/auth/refresh",
		MaxAge: -1,
	})

	c.JSON(http.StatusOK, gin.H{"message": "Logged out"})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID := mw.GetUserID(c)
	var user model.User
	if err := h.db.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}
	c.JSON(http.StatusOK, user)
}
