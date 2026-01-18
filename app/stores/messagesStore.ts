import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

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
  replyTo?: {
    id: number;
    content: string;
    sender: User;
  } | null;
}

export interface Conversation {
  id: number;
  members: { user: User }[];
  messages: Message[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface GroupChat {
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  members: { user: User; role: string }[];
  messages: Message[];
  lastMessage?: Message;
  unreadCount?: number;
}

interface MessagesState {
  conversations: Map<number, Conversation>;
  groupChats: Map<number, GroupChat>;
  messages: Map<number, Message[]>; // Key: conversationId or groupChatId
  typingUsers: Map<number, Set<string>>; // Key: conversationId or groupChatId
  isLoading: boolean;
  lastFetch: number | null;

  // Actions
  setConversations: (conversations: Conversation[]) => void;
  updateConversation: (conversation: Conversation) => void;
  removeConversation: (conversationId: number) => void;
  
  setGroupChats: (groupChats: GroupChat[]) => void;
  updateGroupChat: (groupChat: GroupChat) => void;
  removeGroupChat: (groupChatId: number) => void;
  
  setMessages: (chatId: number, messages: Message[]) => void;
  addMessage: (chatId: number, message: Message) => void;
  updateMessage: (chatId: number, messageId: number, updates: Partial<Message>) => void;
  removeMessage: (chatId: number, messageId: number) => void;
  addReaction: (chatId: number, messageId: number, reaction: Reaction) => void;
  removeReaction: (chatId: number, messageId: number, userId: number, emoji: string) => void;
  
  setTypingUsers: (chatId: number, users: Set<string>) => void;
  addTypingUser: (chatId: number, username: string) => void;
  removeTypingUser: (chatId: number, username: string) => void;
  
  setLoading: (isLoading: boolean) => void;
  
  // API Actions
  fetchConversations: () => Promise<void>;
  fetchGroupChats: () => Promise<void>;
  fetchMessages: (chatId: number, type: 'dm' | 'group') => Promise<void>;
  sendMessage: (chatId: number, type: 'dm' | 'group', content: string, attachments?: Attachment[], replyToId?: number) => Promise<{ success: boolean; error?: string }>;
}

export const useMessagesStore = create<MessagesState>()(
  devtools(
    (set, get) => ({
      conversations: new Map(),
      groupChats: new Map(),
      messages: new Map(),
      typingUsers: new Map(),
      isLoading: false,
      lastFetch: null,

      setConversations: (conversations) => {
        const convMap = new Map<number, Conversation>();
        conversations.forEach(conv => convMap.set(conv.id, conv));
        set({ conversations: convMap, lastFetch: Date.now() });
      },

      updateConversation: (conversation) => set((state) => {
        const newConversations = new Map(state.conversations);
        newConversations.set(conversation.id, conversation);
        return { conversations: newConversations };
      }),

      removeConversation: (conversationId) => set((state) => {
        const newConversations = new Map(state.conversations);
        newConversations.delete(conversationId);
        const newMessages = new Map(state.messages);
        newMessages.delete(conversationId);
        return { conversations: newConversations, messages: newMessages };
      }),

      setGroupChats: (groupChats) => {
        const groupMap = new Map<number, GroupChat>();
        groupChats.forEach(group => groupMap.set(group.id, group));
        set({ groupChats: groupMap });
      },

      updateGroupChat: (groupChat) => set((state) => {
        const newGroupChats = new Map(state.groupChats);
        newGroupChats.set(groupChat.id, groupChat);
        return { groupChats: newGroupChats };
      }),

      removeGroupChat: (groupChatId) => set((state) => {
        const newGroupChats = new Map(state.groupChats);
        newGroupChats.delete(groupChatId);
        const newMessages = new Map(state.messages);
        newMessages.delete(groupChatId);
        return { groupChats: newGroupChats, messages: newMessages };
      }),

      setMessages: (chatId, messages) => set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(chatId, messages);
        return { messages: newMessages };
      }),

      addMessage: (chatId, message) => set((state) => {
        const newMessages = new Map(state.messages);
        const chatMessages = newMessages.get(chatId) || [];
        // Avoid duplicates
        if (!chatMessages.some(m => m.id === message.id || m.tempId === message.tempId)) {
          newMessages.set(chatId, [...chatMessages, message]);
        }
        return { messages: newMessages };
      }),

      updateMessage: (chatId, messageId, updates) => set((state) => {
        const newMessages = new Map(state.messages);
        const chatMessages = newMessages.get(chatId) || [];
        newMessages.set(chatId, chatMessages.map(msg => 
          msg.id === messageId || msg.tempId === updates.tempId 
            ? { ...msg, ...updates } 
            : msg
        ));
        return { messages: newMessages };
      }),

      removeMessage: (chatId, messageId) => set((state) => {
        const newMessages = new Map(state.messages);
        const chatMessages = newMessages.get(chatId) || [];
        newMessages.set(chatId, chatMessages.filter(msg => msg.id !== messageId));
        return { messages: newMessages };
      }),

      addReaction: (chatId, messageId, reaction) => set((state) => {
        const newMessages = new Map(state.messages);
        const chatMessages = newMessages.get(chatId) || [];
        newMessages.set(chatId, chatMessages.map(msg => {
          if (msg.id === messageId) {
            const currentReactions = msg.reactions || [];
            const exists = currentReactions.some(
              r => r.userId === reaction.userId && r.emoji === reaction.emoji
            );
            if (!exists) {
              return { ...msg, reactions: [...currentReactions, reaction] };
            }
          }
          return msg;
        }));
        return { messages: newMessages };
      }),

      removeReaction: (chatId, messageId, userId, emoji) => set((state) => {
        const newMessages = new Map(state.messages);
        const chatMessages = newMessages.get(chatId) || [];
        newMessages.set(chatId, chatMessages.map(msg => {
          if (msg.id === messageId) {
            const currentReactions = msg.reactions || [];
            return {
              ...msg,
              reactions: currentReactions.filter(
                r => !(r.userId === userId && r.emoji === emoji)
              ),
            };
          }
          return msg;
        }));
        return { messages: newMessages };
      }),

      setTypingUsers: (chatId, users) => set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        newTypingUsers.set(chatId, users);
        return { typingUsers: newTypingUsers };
      }),

      addTypingUser: (chatId, username) => set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        const users = new Set(newTypingUsers.get(chatId) || []);
        users.add(username);
        newTypingUsers.set(chatId, users);
        return { typingUsers: newTypingUsers };
      }),

      removeTypingUser: (chatId, username) => set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        const users = new Set(newTypingUsers.get(chatId) || []);
        users.delete(username);
        newTypingUsers.set(chatId, users);
        return { typingUsers: newTypingUsers };
      }),

      setLoading: (isLoading) => set({ isLoading }),

      // API Actions
      fetchConversations: async () => {
        const { lastFetch } = get();
        // Cache for 10 seconds
        if (lastFetch && Date.now() - lastFetch < 10000) {
          return;
        }

        set({ isLoading: true });
        try {
          const res = await fetch('/api/conversations');
          if (res.ok) {
            const data = await res.json();
            get().setConversations(data);
          }
        } catch (error) {
          console.error('Failed to load conversations:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchGroupChats: async () => {
        set({ isLoading: true });
        try {
          const res = await fetch('/api/groupchats');
          if (res.ok) {
            const data = await res.json();
            get().setGroupChats(data);
          }
        } catch (error) {
          console.error('Failed to load group chats:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      fetchMessages: async (chatId: number, type: 'dm' | 'group') => {
        try {
          const endpoint = type === 'dm' 
            ? `/api/conversations/${chatId}/messages`
            : `/api/groupchats/${chatId}/messages`;
          
          const res = await fetch(endpoint);
          if (res.ok) {
            const data = await res.json();
            get().setMessages(chatId, data);
          }
        } catch (error) {
          console.error('Failed to load messages:', error);
        }
      },

      sendMessage: async (chatId: number, type: 'dm' | 'group', content: string, attachments?: Attachment[], replyToId?: number) => {
        try {
          const endpoint = type === 'dm'
            ? `/api/conversations/${chatId}/messages`
            : `/api/groupchats/${chatId}/messages`;

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              content,
              attachments: attachments && attachments.length > 0 ? attachments : undefined,
              replyToId,
            }),
          });

          if (res.ok) {
            const message = await res.json();
            return { success: true };
          } else {
            const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
            return { success: false, error: errorData.error || 'Failed to send message' };
          }
        } catch (error) {
          return { success: false, error: error instanceof Error ? error.message : 'Failed to send message' };
        }
      },
    }),
    { name: 'MessagesStore' }
  )
);
