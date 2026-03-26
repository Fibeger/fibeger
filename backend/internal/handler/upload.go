package handler

import (
	"fmt"
	"io"
	"net/http"
	"time"

	mw "github.com/fibeger/backend/internal/middleware"
	"github.com/fibeger/backend/internal/model"
	"github.com/fibeger/backend/internal/storage"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type UploadHandler struct {
	db      *gorm.DB
	storage *storage.StorageService
}

func NewUploadHandler(db *gorm.DB, storage *storage.StorageService) *UploadHandler {
	return &UploadHandler{db: db, storage: storage}
}

func (h *UploadHandler) Upload(c *gin.Context) {
	userID := mw.GetUserID(c)
	folder := c.DefaultPostForm("folder", "messages")

	form, err := c.MultipartForm()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid multipart form"})
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		files = form.File["file"]
	}
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No files uploaded"})
		return
	}

	var results []model.FileBlob
	for _, fh := range files {
		file, err := fh.Open()
		if err != nil {
			continue
		}
		data, err := io.ReadAll(file)
		file.Close()
		if err != nil {
			continue
		}

		hash := storage.HashFile(data)
		contentType := fh.Header.Get("Content-Type")

		var existing model.FileBlob
		if err := h.db.Where("hash = ?", hash).First(&existing).Error; err == nil {
			results = append(results, existing)
			continue
		}

		filename := fmt.Sprintf("%s/%d_%d_%s", folder, userID, time.Now().UnixMilli(), fh.Filename)
		url, err := h.storage.Upload(filename, data, contentType)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Upload failed: " + err.Error()})
			return
		}

		blob := model.FileBlob{
			Hash: hash, URL: url, ContentType: contentType,
			Size: len(data), UploadedBy: userID,
		}
		h.db.Create(&blob)
		results = append(results, blob)
	}

	if len(results) == 1 {
		c.JSON(http.StatusOK, results[0])
		return
	}
	c.JSON(http.StatusOK, results)
}
