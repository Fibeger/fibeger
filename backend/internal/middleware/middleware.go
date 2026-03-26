package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/fibeger/backend/internal/auth"
	"github.com/gin-gonic/gin"
)

var allowedOrigins []string

func init() {
	if extra := os.Getenv("ALLOWED_ORIGINS"); extra != "" {
		for _, o := range strings.Split(extra, ",") {
			if o = strings.TrimSpace(o); o != "" {
				allowedOrigins = append(allowedOrigins, o)
			}
		}
	}
	defaults := []string{
		"https://fibeger.com",
		"tauri://localhost",
		"http://tauri.localhost",
	}
	allowedOrigins = append(allowedOrigins, defaults...)
}

func IsAllowedOrigin(origin string) bool {
	if origin == "" {
		return false
	}
	for _, o := range allowedOrigins {
		if strings.EqualFold(o, origin) {
			return true
		}
	}
	if strings.HasPrefix(origin, "http://localhost:") || origin == "http://localhost" {
		return true
	}
	if strings.HasPrefix(origin, "http://127.0.0.1:") || origin == "http://127.0.0.1" {
		return true
	}
	return false
}

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if IsAllowedOrigin(origin) {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept, Authorization")
		c.Header("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func AuthRequired(authConfig *auth.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		tokenString := extractToken(c)
		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Authorization required"})
			return
		}

		claims, err := authConfig.ValidateToken(tokenString)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			return
		}

		c.Set("userID", claims.UserID)
		c.Set("username", claims.Username)
		c.Next()
	}
}

func extractToken(c *gin.Context) string {
	header := c.GetHeader("Authorization")
	if header != "" {
		parts := strings.SplitN(header, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return parts[1]
		}
	}

	if token, err := c.Cookie("access_token"); err == nil && token != "" {
		return token
	}

	return ""
}

func GetUserID(c *gin.Context) int {
	id, ok := c.Get("userID")
	if !ok {
		return 0
	}
	v, _ := id.(int)
	return v
}

func GetUsername(c *gin.Context) string {
	username, ok := c.Get("username")
	if !ok {
		return ""
	}
	v, _ := username.(string)
	return v
}
