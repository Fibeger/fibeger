package handler

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/fibeger/backend/internal/auth"
	"github.com/fibeger/backend/internal/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
)

func setupTestRouter(t *testing.T) (*gin.Engine, *gorm.DB) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	db.AutoMigrate(&model.User{}, &model.RefreshToken{})

	authCfg := auth.NewConfig("test-secret")
	h := NewAuthHandler(db, authCfg)

	r := gin.New()
	r.POST("/api/auth/signup", h.Signup)
	r.POST("/api/auth/login", h.Login)

	return r, db
}

func postJSON(router *gin.Engine, url string, body any) *httptest.ResponseRecorder {
	data, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, url, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)
	return w
}

func TestSignup_Success(t *testing.T) {
	router, _ := setupTestRouter(t)

	w := postJSON(router, "/api/auth/signup", map[string]string{
		"username": "testuser",
		"email":    "test@example.com",
		"password": "password123",
	})

	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSignup_DuplicateUsername(t *testing.T) {
	router, _ := setupTestRouter(t)

	payload := map[string]string{
		"username": "testuser",
		"email":    "test@example.com",
		"password": "password123",
	}
	postJSON(router, "/api/auth/signup", payload)

	w := postJSON(router, "/api/auth/signup", payload)
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestSignup_DuplicateEmail(t *testing.T) {
	router, _ := setupTestRouter(t)

	postJSON(router, "/api/auth/signup", map[string]string{
		"username": "user1",
		"email":    "same@example.com",
		"password": "password123",
	})

	w := postJSON(router, "/api/auth/signup", map[string]string{
		"username": "user2",
		"email":    "same@example.com",
		"password": "password123",
	})
	if w.Code != http.StatusConflict {
		t.Fatalf("expected 409, got %d: %s", w.Code, w.Body.String())
	}
}

func TestLogin_Success(t *testing.T) {
	router, _ := setupTestRouter(t)

	postJSON(router, "/api/auth/signup", map[string]string{
		"username": "loginuser",
		"email":    "login@example.com",
		"password": "password123",
	})

	w := postJSON(router, "/api/auth/login", map[string]string{
		"login":    "loginuser",
		"password": "password123",
	})

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["accessToken"] == nil || resp["accessToken"] == "" {
		t.Fatal("expected accessToken in response")
	}
	if resp["refreshToken"] == nil || resp["refreshToken"] == "" {
		t.Fatal("expected refreshToken in response")
	}
}

func TestLogin_InvalidPassword(t *testing.T) {
	router, _ := setupTestRouter(t)

	postJSON(router, "/api/auth/signup", map[string]string{
		"username": "loginuser",
		"email":    "login@example.com",
		"password": "password123",
	})

	w := postJSON(router, "/api/auth/login", map[string]string{
		"login":    "loginuser",
		"password": "wrongpassword",
	})

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}

func TestLogin_NonexistentUser(t *testing.T) {
	router, _ := setupTestRouter(t)

	w := postJSON(router, "/api/auth/login", map[string]string{
		"login":    "nobody",
		"password": "password123",
	})

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d: %s", w.Code, w.Body.String())
	}
}
