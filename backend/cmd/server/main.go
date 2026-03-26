package main

import (
	"log"
	"os"

	"github.com/fibeger/backend/internal/auth"
	"github.com/fibeger/backend/internal/handler"
	"github.com/fibeger/backend/internal/middleware"
	"github.com/fibeger/backend/internal/model"
	"github.com/fibeger/backend/internal/storage"
	ws "github.com/fibeger/backend/internal/websocket"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func main() {
	godotenv.Load()

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL is required")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Error),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	if os.Getenv("AUTO_MIGRATE") == "true" {
		log.Println("Running auto-migration...")
		if err := db.AutoMigrate(model.AllModels()...); err != nil {
			log.Fatalf("Auto-migration failed: %v", err)
		}
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = os.Getenv("NEXTAUTH_SECRET")
	}
	if jwtSecret == "" {
		log.Fatal("JWT_SECRET is required")
	}
	authConfig := auth.NewConfig(jwtSecret)

	hub := ws.NewHub()
	storageSvc := storage.NewStorageService()

	authHandler := handler.NewAuthHandler(db, authConfig)
	profileHandler := handler.NewProfileHandler(db, hub, storageSvc)
	friendsHandler := handler.NewFriendsHandler(db, hub)
	feedHandler := handler.NewFeedHandler(db, hub)
	convHandler := handler.NewConversationsHandler(db, hub)
	groupHandler := handler.NewGroupChatsHandler(db, hub, storageSvc)
	callsHandler := handler.NewCallsHandler(db, hub)
	messagesHandler := handler.NewMessagesHandler(db, hub)
	notifsHandler := handler.NewNotificationsHandler(db, hub)
	uploadHandler := handler.NewUploadHandler(db, storageSvc)
	personalityHandler := handler.NewPersonalityHandler(db, "data/personalityTest.json")
	wsHandler := handler.NewWebSocketHandler(hub, authConfig)

	if os.Getenv("GIN_MODE") == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.Default()
	r.Use(middleware.CORS())

	r.MaxMultipartMemory = 500 << 20

	r.GET("/ws", wsHandler.HandleWebSocket)

	pub := r.Group("/api")
	{
		pub.POST("/auth/signup", authHandler.Signup)
		pub.POST("/auth/login", authHandler.Login)
		pub.POST("/auth/refresh", authHandler.Refresh)
	}

	api := r.Group("/api")
	api.Use(middleware.AuthRequired(authConfig))
	{
		api.POST("/auth/logout", authHandler.Logout)
		api.GET("/auth/me", authHandler.Me)

		api.GET("/profile", profileHandler.GetProfile)
		api.PUT("/profile", profileHandler.UpdateProfile)
		api.PATCH("/profile", profileHandler.UpdateProfile)
		api.GET("/profile/:username", profileHandler.GetProfileByUsername)
		api.GET("/profile/:username/friends", profileHandler.GetProfileFriends)
		api.POST("/profile/avatar", profileHandler.UploadAvatar)
		api.POST("/profile/banner", profileHandler.UploadBanner)
		api.DELETE("/profile/banner", profileHandler.DeleteBanner)
		api.PUT("/profile/username", profileHandler.ChangeUsername)
		api.DELETE("/profile/delete", profileHandler.DeleteAccount)

		api.GET("/friends", friendsHandler.GetFriends)
		api.DELETE("/friends", friendsHandler.RemoveFriend)
		api.GET("/friends/request", friendsHandler.SearchUsers)
		api.POST("/friends/request", friendsHandler.SendFriendRequest)
		api.GET("/friends/request/:id", friendsHandler.GetFriendRequest)
		api.PUT("/friends/request/:id", friendsHandler.RespondToFriendRequest)

		api.GET("/feed", feedHandler.GetFeed)
		api.POST("/feed", feedHandler.CreatePost)
		api.DELETE("/feed/:id", feedHandler.DeletePost)
		api.POST("/feed/:id/like", feedHandler.ToggleLike)

		api.GET("/conversations", convHandler.GetConversations)
		api.POST("/conversations", convHandler.CreateConversation)
		api.GET("/conversations/:id", convHandler.GetConversation)
		api.DELETE("/conversations/:id", convHandler.DeleteConversation)
		api.GET("/conversations/:id/messages", convHandler.GetMessages)
		api.POST("/conversations/:id/messages", convHandler.SendMessage)

		api.GET("/groupchats", groupHandler.GetGroupChats)
		api.POST("/groupchats", groupHandler.CreateGroupChat)
		api.GET("/groupchats/:id", groupHandler.GetGroupChat)
		api.DELETE("/groupchats/:id", groupHandler.DeleteGroupChat)
		api.GET("/groupchats/:id/messages", groupHandler.GetMessages)
		api.POST("/groupchats/:id/messages", groupHandler.SendMessage)
		api.POST("/groupchats/:id/members", groupHandler.AddMember)
		api.DELETE("/groupchats/:id/members/:userId", groupHandler.RemoveMember)
		api.POST("/groupchats/:id/avatar", groupHandler.UploadAvatar)

		api.GET("/groupchats/:id/call", callsHandler.GetCall)
		api.POST("/groupchats/:id/call", callsHandler.StartCall)
		api.DELETE("/groupchats/:id/call", callsHandler.EndCall)
		api.POST("/groupchats/:id/call/join", callsHandler.JoinCall)
		api.POST("/groupchats/:id/call/leave", callsHandler.LeaveCall)
		api.POST("/groupchats/:id/call/signal", callsHandler.Signal)

		api.DELETE("/messages/:id", messagesHandler.DeleteMessage)
		api.POST("/messages/:id/reactions", messagesHandler.AddReaction)
		api.DELETE("/messages/:id/reactions", messagesHandler.RemoveReaction)
		api.POST("/messages/mark-read", messagesHandler.MarkAsRead)
		api.POST("/typing", messagesHandler.Typing)

		api.GET("/notifications", notifsHandler.GetNotifications)
		api.POST("/notifications", notifsHandler.CreateNotification)
		api.PATCH("/notifications/:id", notifsHandler.UpdateNotification)
		api.DELETE("/notifications/:id", notifsHandler.DeleteNotification)
		api.PATCH("/notifications/mark-all-read", notifsHandler.MarkAllRead)

		api.POST("/upload", uploadHandler.Upload)

		api.GET("/personality-test", personalityHandler.GetTest)
		api.POST("/personality-test", personalityHandler.SubmitTest)
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
