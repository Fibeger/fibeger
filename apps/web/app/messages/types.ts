export interface User {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

export interface Attachment {
  url: string;
  type: string;
  name: string;
  size: number;
}

export interface Reaction {
  id: number;
  emoji: string;
  userId: number;
  user: User;
}

export interface Message {
  id: number;
  content: string;
  attachments?: string | Attachment[] | null;
  sender: User;
  createdAt: string;
  isPending?: boolean;
  tempId?: string;
  reactions?: Reaction[];
  replyTo?: { id: number; content: string; sender: User } | null;
}

export interface Conversation {
  id: number;
  members: { user: User }[];
  messages: Message[];
}

export interface GroupChat {
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  members: { user: User; role: string }[];
  messages: Message[];
}
