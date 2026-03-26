FROM golang:1.25-alpine AS builder
WORKDIR /app

RUN apk add --no-cache git

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

FROM alpine:3.21
WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/server .
COPY --from=builder /app/data ./data

EXPOSE 8080

CMD ["./server"]
