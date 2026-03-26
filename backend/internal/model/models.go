package model

import (
	"time"
)

type User struct {
	ID                          int              `gorm:"primaryKey;autoIncrement" json:"id"`
	Username                    string           `gorm:"uniqueIndex;not null" json:"username"`
	Email                       string           `gorm:"uniqueIndex;not null" json:"email"`
	Password                    string           `gorm:"not null" json:"-"`
	Nickname                    *string          `json:"nickname"`
	Bio                         *string          `json:"bio"`
	Avatar                      *string          `json:"avatar"`
	Banner                      *string          `json:"banner"`
	LastUsernameChange          *time.Time       `json:"lastUsernameChange"`
	Country                     *string          `json:"country"`
	City                        *string          `json:"city"`
	Pronouns                    *string          `json:"pronouns"`
	Birthday                    *string          `json:"birthday"`
	Website                     *string          `json:"website"`
	SocialLinks                 *string          `json:"socialLinks"`
	Status                      *string          `json:"status"`
	ThemeColor                  *string          `json:"themeColor"`
	Interests                   *string          `json:"interests"`
	PersonalityBadge            *string          `json:"personalityBadge"`
	ShowPersonalityBadge        bool             `gorm:"default:true" json:"showPersonalityBadge"`
	NotificationSoundsEnabled   bool             `gorm:"default:true" json:"notificationSoundsEnabled"`
	BrowserNotificationsEnabled bool             `gorm:"default:false" json:"browserNotificationsEnabled"`
	SteamUsername               *string          `json:"steamUsername"`
	CreatedAt                   time.Time        `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt                   time.Time        `gorm:"autoUpdateTime" json:"updatedAt"`
	SentFriendRequests          []FriendRequest  `gorm:"foreignKey:SenderID" json:"-"`
	ReceivedFriendRequests      []FriendRequest  `gorm:"foreignKey:ReceiverID" json:"-"`
	Friends                     []Friend         `gorm:"foreignKey:UserID" json:"-"`
	FriendOf                    []Friend         `gorm:"foreignKey:FriendID" json:"-"`
	Conversations               []ConversationMember `gorm:"foreignKey:UserID" json:"-"`
	GroupChats                  []GroupChatMember    `gorm:"foreignKey:UserID" json:"-"`
	Messages                    []Message        `gorm:"foreignKey:SenderID" json:"-"`
	UsernameHistory             []UsernameHistory `gorm:"foreignKey:UserID" json:"-"`
	Notifications               []Notification   `gorm:"foreignKey:UserID" json:"-"`
	Reactions                   []Reaction       `gorm:"foreignKey:UserID" json:"-"`
	FeedPosts                   []FeedPost       `gorm:"foreignKey:UserID" json:"-"`
	FeedLikes                   []FeedLike       `gorm:"foreignKey:UserID" json:"-"`
}

type Friend struct {
	ID        int       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int       `gorm:"not null;uniqueIndex:idx_user_friend" json:"userId"`
	FriendID  int       `gorm:"not null;uniqueIndex:idx_user_friend" json:"friendId"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	FriendUser User     `gorm:"foreignKey:FriendID;constraint:OnDelete:CASCADE" json:"friend,omitempty"`
}

type FriendRequest struct {
	ID         int       `gorm:"primaryKey;autoIncrement" json:"id"`
	SenderID   int       `gorm:"not null;uniqueIndex:idx_sender_receiver" json:"senderId"`
	ReceiverID int       `gorm:"not null;uniqueIndex:idx_sender_receiver" json:"receiverId"`
	Status     string    `gorm:"default:pending;not null" json:"status"`
	CreatedAt  time.Time `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt  time.Time `gorm:"autoUpdateTime" json:"updatedAt"`
	Sender     User      `gorm:"foreignKey:SenderID;constraint:OnDelete:CASCADE" json:"sender,omitempty"`
	Receiver   User      `gorm:"foreignKey:ReceiverID;constraint:OnDelete:CASCADE" json:"receiver,omitempty"`
}

type Conversation struct {
	ID        int                  `gorm:"primaryKey;autoIncrement" json:"id"`
	CreatedAt time.Time            `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt time.Time            `gorm:"autoUpdateTime" json:"updatedAt"`
	Members   []ConversationMember `gorm:"foreignKey:ConversationID" json:"members,omitempty"`
	Messages  []Message            `gorm:"foreignKey:ConversationID" json:"messages,omitempty"`
}

type ConversationMember struct {
	ID                int       `gorm:"primaryKey;autoIncrement" json:"id"`
	ConversationID    int       `gorm:"not null;uniqueIndex:idx_conv_user" json:"conversationId"`
	UserID            int       `gorm:"not null;uniqueIndex:idx_conv_user" json:"userId"`
	JoinedAt          time.Time `gorm:"autoCreateTime" json:"joinedAt"`
	LastReadMessageID *int      `json:"lastReadMessageId"`
	Conversation      Conversation `gorm:"foreignKey:ConversationID;constraint:OnDelete:CASCADE" json:"-"`
	User              User         `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}

type GroupChat struct {
	ID          int               `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string            `gorm:"not null" json:"name"`
	Description *string           `json:"description"`
	Avatar      *string           `json:"avatar"`
	CreatedAt   time.Time         `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time         `gorm:"autoUpdateTime" json:"updatedAt"`
	Members     []GroupChatMember `gorm:"foreignKey:GroupChatID" json:"members,omitempty"`
	Messages    []Message         `gorm:"foreignKey:GroupChatID" json:"messages,omitempty"`
	Calls       []GroupCall       `gorm:"foreignKey:GroupChatID" json:"-"`
}

type GroupChatMember struct {
	ID                int       `gorm:"primaryKey;autoIncrement" json:"id"`
	GroupChatID       int       `gorm:"not null;uniqueIndex:idx_group_user" json:"groupChatId"`
	UserID            int       `gorm:"not null;uniqueIndex:idx_group_user" json:"userId"`
	Role              string    `gorm:"default:member;not null" json:"role"`
	JoinedAt          time.Time `gorm:"autoCreateTime" json:"joinedAt"`
	LastReadMessageID *int      `json:"lastReadMessageId"`
	GroupChat         GroupChat `gorm:"foreignKey:GroupChatID;constraint:OnDelete:CASCADE" json:"-"`
	User              User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}

type GroupCall struct {
	ID           int                    `gorm:"primaryKey;autoIncrement" json:"id"`
	GroupChatID  int                    `gorm:"not null;index:idx_group_call_status" json:"groupChatId"`
	StartedByID  int                    `gorm:"not null" json:"startedById"`
	StartedAt    time.Time              `gorm:"autoCreateTime" json:"startedAt"`
	EndedAt      *time.Time             `json:"endedAt"`
	Status       string                 `gorm:"default:active;not null;index:idx_group_call_status" json:"status"`
	GroupChat    GroupChat              `gorm:"foreignKey:GroupChatID;constraint:OnDelete:CASCADE" json:"-"`
	StartedBy    User                   `gorm:"foreignKey:StartedByID;constraint:OnDelete:CASCADE" json:"startedBy,omitempty"`
	Participants []GroupCallParticipant `gorm:"foreignKey:CallID" json:"participants,omitempty"`
}

type GroupCallParticipant struct {
	ID       int        `gorm:"primaryKey;autoIncrement" json:"id"`
	CallID   int        `gorm:"not null;uniqueIndex:idx_call_user;index:idx_call" json:"callId"`
	UserID   int        `gorm:"not null;uniqueIndex:idx_call_user" json:"userId"`
	JoinedAt time.Time  `gorm:"autoCreateTime" json:"joinedAt"`
	LeftAt   *time.Time `json:"leftAt"`
	Call     GroupCall  `gorm:"foreignKey:CallID;constraint:OnDelete:CASCADE" json:"-"`
	User     User       `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}

type Message struct {
	ID             int        `gorm:"primaryKey;autoIncrement" json:"id"`
	Content        string     `gorm:"not null" json:"content"`
	Attachments    *string    `json:"attachments"`
	SenderID       int        `gorm:"not null" json:"senderId"`
	ConversationID *int       `json:"conversationId"`
	GroupChatID    *int       `json:"groupChatId"`
	ReplyToID      *int       `json:"replyToId"`
	CreatedAt      time.Time  `gorm:"autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
	Sender         User       `gorm:"foreignKey:SenderID;constraint:OnDelete:CASCADE" json:"sender,omitempty"`
	Conversation   *Conversation `gorm:"foreignKey:ConversationID;constraint:OnDelete:CASCADE" json:"-"`
	GroupChat      *GroupChat    `gorm:"foreignKey:GroupChatID;constraint:OnDelete:CASCADE" json:"-"`
	ReplyTo        *Message   `gorm:"foreignKey:ReplyToID;constraint:OnDelete:SET NULL" json:"replyTo,omitempty"`
	Reactions      []Reaction `gorm:"foreignKey:MessageID" json:"reactions,omitempty"`
}

type Reaction struct {
	ID        int       `gorm:"primaryKey;autoIncrement" json:"id"`
	MessageID int       `gorm:"not null;uniqueIndex:idx_msg_user_emoji;index:idx_message" json:"messageId"`
	UserID    int       `gorm:"not null;uniqueIndex:idx_msg_user_emoji" json:"userId"`
	Emoji     string    `gorm:"not null;uniqueIndex:idx_msg_user_emoji" json:"emoji"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	Message   Message   `gorm:"foreignKey:MessageID;constraint:OnDelete:CASCADE" json:"-"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
}

type UsernameHistory struct {
	ID          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      int       `gorm:"not null" json:"userId"`
	OldUsername string    `gorm:"not null" json:"oldUsername"`
	NewUsername string    `gorm:"not null" json:"newUsername"`
	ChangedAt   time.Time `gorm:"autoCreateTime" json:"changedAt"`
	User        User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

type Notification struct {
	ID        int       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int       `gorm:"not null;index:idx_user_read" json:"userId"`
	Type      string    `gorm:"not null" json:"type"`
	Title     string    `gorm:"not null" json:"title"`
	Message   string    `gorm:"not null" json:"message"`
	Link      *string   `json:"link"`
	Read      bool      `gorm:"default:false;index:idx_user_read" json:"read"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

type FeedPost struct {
	ID        int        `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int        `gorm:"not null;index:idx_feed_user" json:"userId"`
	Caption   *string    `json:"caption"`
	MediaURL  string     `gorm:"column:media_url;not null" json:"mediaUrl"`
	MediaType string     `gorm:"column:media_type;not null" json:"mediaType"`
	IsPublic  bool       `gorm:"column:is_public;default:false;index:idx_feed_public" json:"isPublic"`
	CreatedAt time.Time  `gorm:"autoCreateTime;index:idx_feed_created" json:"createdAt"`
	UpdatedAt time.Time  `gorm:"autoUpdateTime" json:"updatedAt"`
	User      User       `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Likes     []FeedLike `gorm:"foreignKey:PostID" json:"likes,omitempty"`
}

type FeedLike struct {
	ID        int       `gorm:"primaryKey;autoIncrement" json:"id"`
	PostID    int       `gorm:"not null;uniqueIndex:idx_post_user;index:idx_like_post" json:"postId"`
	UserID    int       `gorm:"not null;uniqueIndex:idx_post_user" json:"userId"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	Post      FeedPost  `gorm:"foreignKey:PostID;constraint:OnDelete:CASCADE" json:"-"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

type FileBlob struct {
	ID          int       `gorm:"primaryKey;autoIncrement" json:"id"`
	Hash        string    `gorm:"uniqueIndex;not null" json:"hash"`
	URL         string    `gorm:"not null" json:"url"`
	ContentType string    `gorm:"not null" json:"contentType"`
	Size        int       `gorm:"not null" json:"size"`
	UploadedBy  int       `gorm:"not null" json:"uploadedBy"`
	UploadedAt  time.Time `gorm:"autoCreateTime" json:"uploadedAt"`
}

type RefreshToken struct {
	ID        int       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int       `gorm:"not null;index" json:"userId"`
	Token     string    `gorm:"uniqueIndex;not null" json:"-"`
	ExpiresAt time.Time `gorm:"not null" json:"expiresAt"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

type DeviceToken struct {
	ID        int       `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    int       `gorm:"not null;index" json:"userId"`
	Token     string    `gorm:"uniqueIndex;not null" json:"token"`
	Platform  string    `gorm:"not null" json:"platform"`
	CreatedAt time.Time `gorm:"autoCreateTime" json:"createdAt"`
	User      User      `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

func AllModels() []interface{} {
	return []interface{}{
		&User{},
		&Friend{},
		&FriendRequest{},
		&Conversation{},
		&ConversationMember{},
		&GroupChat{},
		&GroupChatMember{},
		&GroupCall{},
		&GroupCallParticipant{},
		&Message{},
		&Reaction{},
		&UsernameHistory{},
		&Notification{},
		&FeedPost{},
		&FeedLike{},
		&FileBlob{},
		&RefreshToken{},
		&DeviceToken{},
	}
}
