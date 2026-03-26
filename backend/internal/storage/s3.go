package storage

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

type StorageService struct {
	s3Client  *s3.Client
	bucket    string
	publicURL string
	endpoint  string
	region    string
	useS3     bool
	localDir  string
}

func NewStorageService() *StorageService {
	bucket := os.Getenv("S3_BUCKET")
	if bucket == "" {
		return &StorageService{useS3: false, localDir: "uploads"}
	}

	region := os.Getenv("S3_REGION")
	if region == "" {
		region = "us-east-1"
	}

	endpoint := os.Getenv("S3_ENDPOINT")
	useTLS := os.Getenv("S3_USE_TLS") != "false"

	opts := func(o *s3.Options) {
		o.Region = region
		o.Credentials = credentials.NewStaticCredentialsProvider(
			os.Getenv("S3_ACCESS_KEY_ID"),
			os.Getenv("S3_SECRET_ACCESS_KEY"),
			"",
		)
		o.UsePathStyle = true
		if endpoint != "" {
			proto := "https"
			if !useTLS {
				proto = "http"
			}
			if !strings.HasPrefix(endpoint, "http") {
				endpoint = proto + "://" + endpoint
			}
			o.BaseEndpoint = aws.String(endpoint)
		}
	}

	client := s3.New(s3.Options{}, opts)

	return &StorageService{
		s3Client:  client,
		bucket:    bucket,
		publicURL: os.Getenv("S3_PUBLIC_URL"),
		endpoint:  endpoint,
		region:    region,
		useS3:     true,
	}
}

func (s *StorageService) Upload(filename string, data []byte, contentType string) (string, error) {
	if s.useS3 {
		return s.uploadToS3(filename, data, contentType)
	}
	return s.uploadLocal(filename, data)
}

func (s *StorageService) uploadToS3(filename string, data []byte, contentType string) (string, error) {
	_, err := s.s3Client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(filename),
		Body:        bytes.NewReader(data),
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", fmt.Errorf("failed to upload to S3: %w", err)
	}

	if s.publicURL != "" {
		return fmt.Sprintf("%s/%s/%s", strings.TrimRight(s.publicURL, "/"), s.bucket, filename), nil
	}
	if s.endpoint != "" {
		return fmt.Sprintf("%s/%s/%s", strings.TrimRight(s.endpoint, "/"), s.bucket, filename), nil
	}
	return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucket, s.region, filename), nil
}

func (s *StorageService) uploadLocal(filename string, data []byte) (string, error) {
	fullPath := filepath.Join(s.localDir, filename)
	dir := filepath.Dir(fullPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("failed to create directory: %w", err)
	}
	if err := os.WriteFile(fullPath, data, 0644); err != nil {
		return "", fmt.Errorf("failed to write file: %w", err)
	}
	return "/uploads/" + filename, nil
}

func (s *StorageService) IsS3Enabled() bool {
	return s.useS3
}

func HashFile(data []byte) string {
	h := sha256.New()
	h.Write(data)
	return hex.EncodeToString(h.Sum(nil))
}

func ReadAll(r io.Reader) ([]byte, error) {
	return io.ReadAll(r)
}
