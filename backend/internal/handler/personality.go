package handler

import (
	"encoding/json"
	"net/http"
	"os"

	mw "github.com/fibeger/backend/internal/middleware"
	"github.com/fibeger/backend/internal/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PersonalityHandler struct {
	db       *gorm.DB
	testData json.RawMessage
}

func NewPersonalityHandler(db *gorm.DB, testDataPath string) *PersonalityHandler {
	h := &PersonalityHandler{db: db}
	data, err := os.ReadFile(testDataPath)
	if err == nil {
		h.testData = data
	}
	return h
}

func (h *PersonalityHandler) GetTest(c *gin.Context) {
	if h.testData == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Test data not found"})
		return
	}
	c.Data(http.StatusOK, "application/json", h.testData)
}

func (h *PersonalityHandler) SubmitTest(c *gin.Context) {
	userID := mw.GetUserID(c)
	var req struct {
		Answers map[string]string `json:"answers" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	badge := calculateBadge(req.Answers)

	h.db.Model(&model.User{}).Where("id = ?", userID).Update("personality_badge", badge)

	c.JSON(http.StatusOK, gin.H{"badge": badge})
}

func calculateBadge(answers map[string]string) string {
	if len(answers) == 0 {
		return "Explorer"
	}
	scores := make(map[string]int)
	for _, v := range answers {
		scores[v]++
	}
	maxScore := 0
	badge := "Explorer"
	for k, v := range scores {
		if v > maxScore {
			maxScore = v
			badge = k
		}
	}
	return badge
}
