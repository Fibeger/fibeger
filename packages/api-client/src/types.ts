export interface User {
  id: number;
  username: string;
  email: string;
  nickname?: string | null;
  bio?: string | null;
  avatar?: string | null;
  banner?: string | null;
  lastUsernameChange?: string | null;
  country?: string | null;
  city?: string | null;
  pronouns?: string | null;
  birthday?: string | null;
  website?: string | null;
  socialLinks?: string | null;
  status?: string | null;
  themeColor?: string | null;
  interests?: string | null;
  personalityBadge?: string | null;
  showPersonalityBadge: boolean;
  notificationSoundsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  steamUsername?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Friend {
  id: number;
  userId: number;
  friendId: number;
  createdAt: string;
  user?: User;
  friend?: User;
}

export interface FriendRequest {
  id: number;
  senderId: number;
  receiverId: number;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  updatedAt: string;
  sender?: User;
  receiver?: User;
}

export interface Conversation {
  id: number;
  createdAt: string;
  updatedAt: string;
  members?: ConversationMember[];
  messages?: Message[];
}

export interface ConversationMember {
  id: number;
  conversationId: number;
  userId: number;
  joinedAt: string;
  lastReadMessageId?: number | null;
  user?: User;
}

export interface GroupChat {
  id: number;
  name: string;
  description?: string | null;
  avatar?: string | null;
  createdAt: string;
  updatedAt: string;
  members?: GroupChatMember[];
  messages?: Message[];
}

export interface GroupChatMember {
  id: number;
  groupChatId: number;
  userId: number;
  role: "member" | "admin";
  joinedAt: string;
  lastReadMessageId?: number | null;
  user?: User;
}

export interface GroupCall {
  id: number;
  groupChatId: number;
  startedById: number;
  startedAt: string;
  endedAt?: string | null;
  status: "active" | "ended";
  startedBy?: User;
  participants?: GroupCallParticipant[];
}

export interface GroupCallParticipant {
  id: number;
  callId: number;
  userId: number;
  joinedAt: string;
  leftAt?: string | null;
  user?: User;
}

export interface Message {
  id: number;
  content: string;
  attachments?: string | null;
  senderId: number;
  conversationId?: number | null;
  groupChatId?: number | null;
  replyToId?: number | null;
  createdAt: string;
  updatedAt: string;
  sender?: User;
  replyTo?: Message | null;
  reactions?: Reaction[];
}

export interface Reaction {
  id: number;
  messageId: number;
  userId: number;
  emoji: string;
  createdAt: string;
  user?: User;
}

export interface Notification {
  id: number;
  userId: number;
  type: string;
  title: string;
  message: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
}

export interface FeedPost {
  id: number;
  userId: number;
  caption?: string | null;
  mediaUrl: string;
  mediaType: "image" | "video" | "gif";
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  user?: User;
  likes?: FeedLike[];
  _count?: { likes: number };
  isLiked?: boolean;
}

export interface FeedLike {
  id: number;
  postId: number;
  userId: number;
  createdAt: string;
}

export interface FileBlob {
  id: number;
  hash: string;
  url: string;
  contentType: string;
  size: number;
  uploadedBy: number;
  uploadedAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface SignupRequest {
  username: string;
  email: string;
  password: string;
}

export interface ApiError {
  error: string;
  details?: string;
}

export type EventType =
  | "notification"
  | "message"
  | "conversation_update"
  | "group_update"
  | "group_updated"
  | "typing"
  | "reaction"
  | "message_deleted"
  | "conversation_deleted"
  | "group_deleted"
  | "friend_removed"
  | "call_started"
  | "call_ended"
  | "call_participant_joined"
  | "call_participant_left"
  | "call_signal";

export interface RealtimeEvent {
  userId: number;
  type: EventType;
  data: unknown;
}
