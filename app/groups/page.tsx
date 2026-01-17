'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

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

interface GroupChat {
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  members: { user: User; role: string }[];
  messages: Message[];
}

export default function GroupChatsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [groupChats, setGroupChats] = useState<GroupChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    fetchGroupChats();
    const interval = setInterval(fetchGroupChats, 3000);

    return () => clearInterval(interval);
  }, [session, router]);

  const fetchGroupChats = async () => {
    try {
      const res = await fetch('/api/groupchats');
      if (res.ok) {
        const data = await res.json();
        setGroupChats(data);
      }
    } catch (error) {
      console.error('Failed to load group chats');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (groupChatId: number) => {
    try {
      const res = await fetch(`/api/groupchats/${groupChatId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Failed to load messages');
    }
  };

  const handleSelectChat = (chat: GroupChat) => {
    setSelectedChat(chat);
    fetchMessages(chat.id);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChat || !newMessage.trim()) return;

    try {
      const res = await fetch(
        `/api/groupchats/${selectedChat.id}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newMessage }),
        }
      );

      if (res.ok) {
        setNewMessage('');
        fetchMessages(selectedChat.id);
      }
    } catch (error) {
      console.error('Failed to send message');
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    try {
      const res = await fetch('/api/groupchats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newGroupName,
          description: newGroupDesc,
        }),
      });

      if (res.ok) {
        setNewGroupName('');
        setNewGroupDesc('');
        setShowCreateForm(false);
        fetchGroupChats();
      }
    } catch (error) {
      console.error('Failed to create group');
    }
  };

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-screen">
      <p className="text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>Loading groups...</p>
    </div>
  );

  return (
    <div className="flex h-screen">
      {/* Group List */}
      <div className="w-64 sm:w-80 flex flex-col" style={{ backgroundColor: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}>
        <div className="p-4" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
          <h1 className="text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Groups</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full px-4 py-2 text-white text-sm font-medium rounded transition"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {showCreateForm ? 'Cancel' : 'New Group'}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={handleCreateGroup} className="p-4 space-y-3" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-tertiary)' }}>
            <input
              type="text"
              placeholder="Group name"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm font-medium"
              required
            />
            <textarea
              placeholder="Description (optional)"
              value={newGroupDesc}
              onChange={(e) => setNewGroupDesc(e.target.value)}
              className="w-full px-3 py-2 rounded text-sm font-medium"
              rows={2}
            />
            <button
              type="submit"
              className="w-full px-3 py-2 text-white text-sm font-medium rounded transition"
              style={{ backgroundColor: 'var(--success)' }}
            >
              Create
            </button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto">
          {groupChats.length === 0 ? (
            <div className="p-4 text-center">
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No groups yet</p>
              <p className="text-sm font-medium mt-2" style={{ color: 'var(--text-tertiary)' }}>Create one to get started</p>
            </div>
          ) : (
            groupChats.map((chat) => {
              const lastMessage = chat.messages[0];

              return (
                <button
                  key={chat.id}
                  onClick={() => handleSelectChat(chat)}
                  className={`w-full p-4 text-left transition`}
                  style={{
                    backgroundColor: selectedChat?.id === chat.id ? 'var(--hover-bg)' : 'transparent',
                    borderBottom: '1px solid var(--border-color)',
                  }}
                >
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{chat.name}</p>
                  {chat.members && (
                    <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {chat.members.length} members
                    </p>
                  )}
                  {lastMessage && (
                    <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>
                      {lastMessage.content}
                    </p>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Window */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4" style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{selectedChat.name}</h2>
              <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>{selectedChat.members.length} members</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className="flex gap-3">
                  {msg.sender.avatar && (
                    <img
                      src={msg.sender.avatar}
                      alt={msg.sender.username}
                      className="w-10 h-10 rounded-full flex-shrink-0 border-2"
                      style={{ borderColor: 'var(--border-color)' }}
                    />
                  )}
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                        {msg.sender.nickname || msg.sender.username}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                    <p className="text-sm break-words font-medium" style={{ color: 'var(--text-secondary)' }}>{msg.content}</p>
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
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>No group selected</p>
            <p className="mt-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Create a group or select one from the list</p>
          </div>
        )}
      </div>
    </div>
  );
}
