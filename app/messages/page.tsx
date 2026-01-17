'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface User {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

interface Message {
  id: number;
  content: string;
  sender: User;
  createdAt: string;
}

interface Conversation {
  id: number;
  members: { user: User }[];
  messages: Message[];
}

export default function DMsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<User[]>([]);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [creatingConversation, setCreatingConversation] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    fetchConversations();
    fetchFriends();
    const interval = setInterval(fetchConversations, 3000);

    return () => clearInterval(interval);
  }, [session, router]);

  const fetchConversations = async () => {
    try {
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  };

  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/friends');
      if (res.ok) {
        const data = await res.json();
        setFriends(data);
      }
    } catch (error) {
      console.error('Failed to load friends');
    }
  };

  const fetchMessages = async (conversationId: number) => {
    try {
      const res = await fetch(`/api/conversations/${conversationId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load messages');
    }
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    fetchMessages(conversation.id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConversation || !newMessage.trim()) return;

    try {
      const res = await fetch(
        `/api/conversations/${selectedConversation.id}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newMessage }),
        }
      );

      if (res.ok) {
        setNewMessage('');
        fetchMessages(selectedConversation.id);
      }
    } catch (error) {
      console.error('Failed to send message');
    }
  };

  const handleStartConversation = async (friendId: number) => {
    setCreatingConversation(true);
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });

      if (res.ok) {
        const conversation = await res.json();
        await fetchConversations();
        setShowNewConversation(false);
        setSelectedConversation(conversation);
        fetchMessages(conversation.id);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to create conversation');
      }
    } catch (error) {
      console.error('Failed to create conversation');
      alert('Failed to create conversation');
    } finally {
      setCreatingConversation(false);
    }
  };

  const getOtherUser = (conversation: Conversation): User | null => {
    const userId = parseInt((session?.user as any)?.id || '0');
    return conversation.members.find((m) => m.user.id !== userId)?.user || null;
  };

  const getFriendsWithoutConversation = () => {
    const conversationFriendIds = conversations.map(conv => {
      const otherUser = getOtherUser(conv);
      return otherUser?.id;
    });
    return friends.filter(friend => !conversationFriendIds.includes(friend.id));
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <p className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>Loading messages...</p>
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* Conversations List */}
      <div className="w-64 sm:w-80 flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}>
        <div className="p-4" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Messages</h1>
            <button
              onClick={() => setShowNewConversation(!showNewConversation)}
              className="px-3 py-1 rounded text-sm font-medium transition"
              style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
            >
              + New
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {showNewConversation && (
            <div className="p-4" style={{ borderBottom: '2px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>Start New Chat</h2>
                <button
                  onClick={() => setShowNewConversation(false)}
                  className="text-xl font-bold"
                  style={{ color: 'var(--text-tertiary)' }}
                >
                  ×
                </button>
              </div>
              {getFriendsWithoutConversation().length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    No friends available
                  </p>
                  <Link
                    href="/friends"
                    className="text-sm font-semibold"
                    style={{ color: 'var(--accent)' }}
                  >
                    Add friends
                  </Link>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {getFriendsWithoutConversation().map((friend) => (
                    <button
                      key={friend.id}
                      onClick={() => handleStartConversation(friend.id)}
                      disabled={creatingConversation}
                      className="w-full p-2 rounded flex items-center gap-3 transition"
                      style={{ backgroundColor: 'var(--hover-bg)' }}
                    >
                      {friend.avatar ? (
                        <img
                          src={friend.avatar}
                          alt={friend.username}
                          className="w-10 h-10 rounded-full border-2"
                          style={{ borderColor: 'var(--border-color)' }}
                        />
                      ) : (
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: 'var(--accent)' }}
                        >
                          {friend.username.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                          {friend.nickname || friend.username}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                          @{friend.username}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {conversations.length === 0 ? (
            <div className="p-4 text-center">
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No conversations yet</p>
              <button
                onClick={() => setShowNewConversation(true)}
                className="font-semibold text-sm transition mt-2"
                style={{ color: 'var(--accent)' }}
              >
                Start a conversation
              </button>
            </div>
          ) : (
            conversations.map((conv) => {
              const otherUser = getOtherUser(conv);
              const lastMessage = conv.messages[0];

              return (
                <button
                  key={conv.id}
                  onClick={() => handleSelectConversation(conv)}
                  className={`w-full p-4 text-left transition`}
                  style={{
                    backgroundColor: selectedConversation?.id === conv.id ? 'var(--hover-bg)' : 'transparent',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <div className="flex items-center gap-3">
                    {otherUser?.avatar && (
                      <img
                        src={otherUser.avatar}
                        alt={otherUser.username}
                        className="w-12 h-12 rounded-full border-2"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {otherUser?.nickname || otherUser?.username}
                      </p>
                      {lastMessage && (
                        <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                          {lastMessage.content}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 flex items-center gap-3" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              {getOtherUser(selectedConversation)?.avatar && (
                <img
                  src={getOtherUser(selectedConversation)!.avatar || ''}
                  alt=""
                  className="w-12 h-12 rounded-full border-2"
                  style={{ borderColor: 'var(--border-color)' }}
                />
              )}
              <div>
                <p className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                  {getOtherUser(selectedConversation)?.nickname ||
                    getOtherUser(selectedConversation)?.username}
                </p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  @{getOtherUser(selectedConversation)?.username}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.sender.id === parseInt((session?.user as any)?.id || '0')
                      ? 'justify-end'
                      : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-xs px-4 py-2 rounded font-medium`}
                    style={{
                      backgroundColor: msg.sender.id === parseInt((session?.user as any)?.id || '0')
                        ? 'var(--accent)'
                        : 'var(--hover-bg)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <p className="break-words">{msg.content}</p>
                    <p className="text-xs mt-2" style={{ opacity: 0.7 }}>
                      {new Date(msg.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <form
              onSubmit={handleSendMessage}
              className="p-4 flex gap-3"
              style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)' }}
            >
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="flex-1 px-4 py-2 rounded font-medium"
              />
              <button
                type="submit"
                className="px-6 py-2 text-white rounded transition font-medium"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                Send
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>No chat selected</p>
            <p className="mt-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Select a conversation to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
