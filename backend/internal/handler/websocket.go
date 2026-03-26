package handler

import (
	"log/slog"
	"net/http"

	"github.com/fibeger/backend/internal/auth"
	mw "github.com/fibeger/backend/internal/middleware"
	ws "github.com/fibeger/backend/internal/websocket"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return mw.IsAllowedOrigin(r.Header.Get("Origin"))
	},
}

type WebSocketHandler struct {
	hub        *ws.Hub
	authConfig *auth.Config
}

func NewWebSocketHandler(hub *ws.Hub, authConfig *auth.Config) *WebSocketHandler {
	return &WebSocketHandler{hub: hub, authConfig: authConfig}
}

func (h *WebSocketHandler) HandleWebSocket(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		if cookie, err := c.Cookie("access_token"); err == nil {
			token = cookie
		}
	}

	if token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Authentication required"})
		return
	}

	claims, err := h.authConfig.ValidateToken(token)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		slog.Error("websocket upgrade failed", "error", err)
		return
	}

	client := ws.NewClient(h.hub, conn, claims.UserID)
	h.hub.Register(claims.UserID, client)

	go client.WritePump()
	go client.ReadPump()
}
