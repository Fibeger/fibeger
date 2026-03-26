package websocket

import (
	"encoding/json"
	"log/slog"
	"sync"
)

type EventType string

const (
	EventMessage              EventType = "message"
	EventTyping               EventType = "typing"
	EventReaction             EventType = "reaction"
	EventMessageDeleted       EventType = "message_deleted"
	EventConversationUpdate   EventType = "conversation_update"
	EventConversationDeleted  EventType = "conversation_deleted"
	EventGroupUpdate          EventType = "group_update"
	EventGroupUpdated         EventType = "group_updated"
	EventGroupDeleted         EventType = "group_deleted"
	EventNotification         EventType = "notification"
	EventFriendRemoved        EventType = "friend_removed"
	EventCallStarted          EventType = "call_started"
	EventCallEnded            EventType = "call_ended"
	EventCallSignal           EventType = "call_signal"
	EventCallParticipantJoined EventType = "call_participant_joined"
	EventCallParticipantLeft   EventType = "call_participant_left"
)

type Event struct {
	UserID int       `json:"userId"`
	Type   EventType `json:"type"`
	Data   any       `json:"data"`
}

type Hub struct {
	mu          sync.RWMutex
	connections map[int]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{
		connections: make(map[int]map[*Client]bool),
	}
}

func (h *Hub) Register(userID int, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.connections[userID] == nil {
		h.connections[userID] = make(map[*Client]bool)
	}
	h.connections[userID][client] = true
}

func (h *Hub) Unregister(userID int, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.connections[userID]; ok {
		delete(clients, client)
		if len(clients) == 0 {
			delete(h.connections, userID)
		}
	}
}

func (h *Hub) IsOnline(userID int) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients, ok := h.connections[userID]
	return ok && len(clients) > 0
}

func (h *Hub) Emit(userID int, eventType EventType, data any) {
	event := Event{
		UserID: userID,
		Type:   eventType,
		Data:   data,
	}
	msg, err := json.Marshal(event)
	if err != nil {
		slog.Error("failed to marshal event", "error", err)
		return
	}

	h.mu.RLock()
	src := h.connections[userID]
	snapshot := make([]*Client, 0, len(src))
	for c := range src {
		snapshot = append(snapshot, c)
	}
	h.mu.RUnlock()

	for _, client := range snapshot {
		select {
		case client.send <- msg:
		default:
			go h.removeStaleClient(userID, client)
		}
	}
}

func (h *Hub) EmitToMany(userIDs []int, eventType EventType, data any) {
	for _, uid := range userIDs {
		h.Emit(uid, eventType, data)
	}
}

func (h *Hub) removeStaleClient(userID int, client *Client) {
	h.Unregister(userID, client)
	client.Close()
}

func (h *Hub) GetOnlineCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.connections)
}
