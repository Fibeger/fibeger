'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRealtimeEvents } from '@/app/hooks/useRealtimeEvents';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageLoader from '@/app/components/PageLoader';
import UserAvatar from '@/app/components/UserAvatar';

function linkifyText(text: string, router: any) {
  const combinedRegex = /(https?:\/\/[^\s]+)|(@everyone)|(@[a-zA-Z0-9_]+)/g;
  const parts = text.split(combinedRegex);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.match(/^https?:\/\//)) {
      return (
        <a key={index} href={part} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: '#00a8fc' }}>
          {part}
        </a>
      );
    }

    if (part === '@everyone') {
      return (
        <span key={index} className="font-semibold px-1 rounded" style={{ backgroundColor: 'rgba(88, 101, 242, 0.3)', color: '#5865f2', cursor: 'default' }}>
          {part}
        </span>
      );
    }

    if (part.match(/^@[a-zA-Z0-9_]+$/)) {
      const username = part.substring(1);
      return (
        <button key={index} onClick={() => router.push(`/profile/${username}`)} className="font-semibold px-1 rounded hover:underline" style={{ backgroundColor: 'rgba(88, 101, 242, 0.3)', color: '#5865f2', border: 'none', padding: '0 4px' }}>
          {part}
        </button>
      );
    }

    return part;
  });
}

interface User {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

interface Attachment {
  url: string;
  type: string;
  name: string;
  size: number;
}

interface Reaction {
  id: number;
  emoji: string;
  userId: number;
  user: User;
}

interface Message {
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

interface Conversation {
  id: number;
  members: { user: User }[];
  messages: Message[];
}

interface GroupChat {
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  members: { user: User; role: string }[];
  messages: Message[];
}

function MessagesContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dmId = searchParams.get('dm');
  const groupId = searchParams.get('group');

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [groupChat, setGroupChat] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const [hoveredMessage, setHoveredMessage] = useState<number | null>(null);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [viewingMedia, setViewingMedia] = useState<{ url: string; type: string; name: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);
  const { on, off } = useRealtimeEvents();

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/login'); return; }
    if (status === 'loading' || !session) return;
    if (!dmId && !groupId) { setLoading(false); return; }
    if (dmId) { fetchConversation(parseInt(dmId)); }
    else if (groupId) { fetchGroupChat(parseInt(groupId)); fetchFriends(); }
  }, [status, session, router, dmId, groupId]);

  useEffect(() => {
    if (!dmId && !groupId) return;

    const handleMessage = (event: any) => {
      const { conversationId, groupChatId, message: newMsg } = event.data;
      const currentUserId = parseInt((session?.user as any)?.id || '0');
      const isCurrentConv = dmId && conversationId === parseInt(dmId);
      const isCurrentGroup = groupId && groupChatId === parseInt(groupId);

      if ((isCurrentConv || isCurrentGroup) && newMsg) {
        setMessages((prev) => {
          if (prev.some((msg) => msg.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });
        if (isCurrentConv) markAsRead(parseInt(dmId!), 'dm');
        if (isCurrentGroup) markAsRead(parseInt(groupId!), 'group');
      }
    };

    const handleTyping = (event: any) => {
      const { conversationId, groupChatId, userName, isTyping } = event.data;
      if ((dmId && conversationId === parseInt(dmId)) || (groupId && groupChatId === parseInt(groupId))) {
        setTypingUsers((prev) => {
          const newSet = new Set(prev);
          isTyping ? newSet.add(userName) : newSet.delete(userName);
          return newSet;
        });
        if (isTyping) {
          setTimeout(() => setTypingUsers((prev) => { const s = new Set(prev); s.delete(userName); return s; }), 5000);
        }
      }
    };

    const handleReaction = (event: any) => {
      const { messageId, reaction, action, userId, emoji } = event.data;
      setMessages((prev) => prev.map((msg) => {
        if (msg.id !== messageId) return msg;
        const current = msg.reactions || [];
        if (action === 'add') {
          const exists = current.some((r) => r.userId === reaction.userId && r.emoji === reaction.emoji);
          return exists ? msg : { ...msg, reactions: [...current, reaction] };
        }
        return { ...msg, reactions: current.filter((r) => !(r.userId === userId && r.emoji === emoji)) };
      }));
    };

    const handleMessageDeleted = (event: any) => setMessages((prev) => prev.filter((msg) => msg.id !== event.data.messageId));
    const handleConversationDeleted = (event: any) => { if (dmId && parseInt(dmId) === event.data.conversationId) router.push('/messages'); };
    const handleGroupDeleted = (event: any) => { if (groupId && parseInt(groupId) === event.data.groupChatId) router.push('/messages'); };
    const handleGroupUpdated = (event: any) => { if (groupId && parseInt(groupId) === event.data.groupChatId && event.data.group) setGroupChat(event.data.group); };

    const unsubMessage = on('message', handleMessage);
    const unsubTyping = on('typing', handleTyping);
    const unsubReaction = on('reaction', handleReaction);
    const unsubMessageDeleted = on('message_deleted', handleMessageDeleted);
    const unsubConversationDeleted = on('conversation_deleted', handleConversationDeleted);
    const unsubGroupDeleted = on('group_deleted', handleGroupDeleted);
    const unsubGroupUpdated = on('group_updated', handleGroupUpdated);

    return () => {
      unsubMessage(); unsubTyping(); unsubReaction();
      unsubMessageDeleted(); unsubConversationDeleted();
      unsubGroupDeleted(); unsubGroupUpdated();
    };
  }, [on, dmId, groupId, router, session]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape' && viewingMedia) setViewingMedia(null); };
    if (viewingMedia) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleEscape);
    }
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', handleEscape); };
  }, [viewingMedia]);

  const fetchConversation = async (id: number) => {
    try {
      setGroupChat(null); setMessages([]);
      const res = await fetch('/api/conversations');
      if (res.ok) {
        const data = await res.json();
        const conv = data.find((c: Conversation) => c.id === id);
        setConversation(conv || null);
        if (conv) { fetchMessages(id, 'dm'); markAsRead(id, 'dm'); }
      }
    } catch { console.error('Failed to load conversation'); }
    finally { setLoading(false); }
  };

  const fetchGroupChat = async (id: number) => {
    try {
      setConversation(null); setMessages([]);
      const res = await fetch('/api/groupchats');
      if (res.ok) {
        const data = await res.json();
        const group = data.find((g: GroupChat) => g.id === id);
        setGroupChat(group || null);
        if (group) { fetchMessages(id, 'group'); markAsRead(id, 'group'); }
      }
    } catch { console.error('Failed to load group chat'); }
    finally { setLoading(false); }
  };

  const fetchMessages = async (id: number, type: 'dm' | 'group') => {
    try {
      const endpoint = type === 'dm' ? `/api/conversations/${id}/messages` : `/api/groupchats/${id}/messages`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => {
          const pending = prev.filter((msg) => msg.isPending);
          const serverIds = new Set(data.map((msg: Message) => msg.id));
          return [...data, ...pending.filter((msg) => !serverIds.has(msg.id))];
        });
      }
    } catch { console.error('Failed to load messages'); }
  };

  const markAsRead = async (id: number, type: 'dm' | 'group') => {
    try {
      await fetch('/api/messages/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: type === 'dm' ? id : undefined, groupChatId: type === 'group' ? id : undefined }),
      });
    } catch { console.error('Failed to mark messages as read'); }
  };

  const handleTypingIndicator = async () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    const body = {
      conversationId: dmId ? parseInt(dmId) : undefined,
      groupChatId: groupId ? parseInt(groupId) : undefined,
      isTyping: true,
    };

    try { await fetch('/api/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch { console.error('Failed to send typing indicator'); }

    typingTimeoutRef.current = setTimeout(async () => {
      try { await fetch('/api/typing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, isTyping: false }) }); }
      catch {}
    }, 3000);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach((file) => fd.append('files', file));
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setAttachments((prev) => [...prev, ...(data.files || [data])]);
      } else {
        const error = await res.json();
        alert(error.error || 'Failed to upload files');
      }
    } catch { alert('Failed to upload files'); }
    finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() && attachments.length === 0) return;

    const id = dmId ? parseInt(dmId) : groupId ? parseInt(groupId) : null;
    if (!id) return;

    const type = dmId ? 'dm' : 'group';
    const msgContent = newMessage;
    const msgAttachments = attachments;
    const replyToId = replyingTo?.id;
    const tempId = `temp-${Date.now()}-${Math.random()}`;

    const userId = parseInt((session?.user as any)?.id || '0');
    const currentUser: User = {
      id: userId,
      username: (session?.user as any)?.username || 'Unknown',
      nickname: (session?.user as any)?.nickname || null,
      avatar: (session?.user as any)?.avatar || null,
    };

    const optimisticMessage: Message = {
      id: -1,
      tempId,
      content: msgContent,
      attachments: msgAttachments.length > 0 ? JSON.stringify(msgAttachments) : null,
      sender: currentUser,
      createdAt: new Date().toISOString(),
      isPending: true,
      reactions: [],
      replyTo: replyingTo ? { id: replyingTo.id, content: replyingTo.content, sender: replyingTo.sender } : null,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setNewMessage('');
    setAttachments([]);
    setReplyingTo(null);

    try {
      await fetch('/api/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: dmId ? parseInt(dmId) : undefined, groupChatId: groupId ? parseInt(groupId) : undefined, isTyping: false }),
      });
    } catch {}

    try {
      const endpoint = type === 'dm' ? `/api/conversations/${id}/messages` : `/api/groupchats/${id}/messages`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: msgContent, attachments: msgAttachments.length > 0 ? msgAttachments : undefined, replyToId }),
      });

      if (res.ok) {
        const serverMessage = await res.json();
        setMessages((prev) => prev.map((msg) => msg.tempId === tempId ? { ...serverMessage, isPending: false } : msg));
      } else {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));
        alert(`Failed to send message: ${errorData.error || 'Please try again.'}`);
      }
    } catch (error) {
      setMessages((prev) => prev.filter((msg) => msg.tempId !== tempId));
      alert(`Failed to send message: ${error instanceof Error ? error.message : 'Please try again.'}`);
    }
  };

  const getOtherUser = (): User | null => {
    if (!conversation) return null;
    const userId = parseInt((session?.user as any)?.id || '0');
    return conversation.members.find((m) => m.user.id !== userId)?.user || null;
  };

  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/friends');
      if (res.ok) setFriends(await res.json());
    } catch { console.error('Failed to load friends'); }
  };

  const isGroupAdmin = () => {
    if (!groupChat) return false;
    const userId = parseInt((session?.user as any)?.id || '0');
    return groupChat.members.find((m) => m.user.id === userId)?.role === 'admin';
  };

  const getAvailableFriends = (): User[] => {
    if (!groupChat) return [];
    const memberIds = groupChat.members.map((m) => m.user.id);
    return friends.filter((friend) => !memberIds.includes(friend.id));
  };

  const handleAddMember = async (friendId: number) => {
    if (!groupId) return;
    setAddingMember(true);
    try {
      const res = await fetch(`/api/groupchats/${groupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: friendId }),
      });
      if (res.ok) { await fetchGroupChat(parseInt(groupId)); setShowAddMember(false); }
      else { const error = await res.json(); alert(error.error || 'Failed to add member'); }
    } catch { alert('Failed to add member'); }
    finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!groupId) return;
    const currentUserId = parseInt((session?.user as any)?.id || '0');
    const isRemovingSelf = userId === currentUserId;
    if (!confirm(isRemovingSelf ? 'Are you sure you want to leave this group?' : 'Are you sure you want to remove this member?')) return;

    try {
      const res = await fetch(`/api/groupchats/${groupId}/members/${userId}`, { method: 'DELETE' });
      if (res.ok) { isRemovingSelf ? router.push('/messages') : await fetchGroupChat(parseInt(groupId)); }
      else { const error = await res.json(); alert(error.error || 'Failed to remove member'); }
    } catch { alert('Failed to remove member'); }
  };

  const handleDeleteGroup = async () => {
    if (!groupId || !confirm('Are you sure you want to delete this group? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/groupchats/${groupId}`, { method: 'DELETE' });
      if (res.ok) router.push('/messages');
      else { const error = await res.json(); alert(error.error || 'Failed to delete group'); }
    } catch { alert('Failed to delete group'); }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !groupId) return;
    setUploadingGroupAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await fetch(`/api/groupchats/${groupId}/avatar`, { method: 'POST', body: fd });
      if (res.ok) { const updatedGroup = await res.json(); setGroupChat(updatedGroup); }
      else { const error = await res.json(); alert(error.error || 'Failed to upload avatar'); }
    } catch { alert('Failed to upload avatar'); }
    finally { setUploadingGroupAvatar(false); if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = ''; }
  };

  const handleAddReaction = async (messageId: number, emoji: string) => {
    try {
      await fetch(`/api/messages/${messageId}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) });
    } catch { console.error('Failed to add reaction'); }
    setShowEmojiPicker(null);
  };

  const handleRemoveReaction = async (messageId: number, emoji: string) => {
    try {
      await fetch(`/api/messages/${messageId}/reactions?emoji=${encodeURIComponent(emoji)}`, { method: 'DELETE' });
    } catch { console.error('Failed to remove reaction'); }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      const res = await fetch(`/api/messages/${messageId}`, { method: 'DELETE' });
      if (res.ok) setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
      else { const error = await res.json(); alert(error.error || 'Failed to delete message'); }
    } catch { alert('Failed to delete message'); }
  };

  const handleDeleteConversation = async () => {
    if (!dmId || !confirm('Are you sure you want to delete this conversation? This will delete all messages and cannot be undone.')) return;
    try {
      const res = await fetch(`/api/conversations/${dmId}`, { method: 'DELETE' });
      if (res.ok) router.push('/messages');
      else { const error = await res.json(); alert(error.error || 'Failed to delete conversation'); }
    } catch { alert('Failed to delete conversation'); }
  };

  const getMentionableUsers = (): User[] => {
    const users: User[] = [];
    if (conversation) {
      const other = getOtherUser();
      if (other) users.push(other);
    } else if (groupChat) {
      const currentUserId = parseInt((session?.user as any)?.id || '0');
      groupChat.members.forEach((m) => { if (m.user.id !== currentUserId) users.push(m.user); });
    }
    return users;
  };

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    handleTypingIndicator();

    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = value.substring(lastAtIndex + 1);
      const charBeforeAt = lastAtIndex === 0 ? ' ' : value[lastAtIndex - 1];
      if ((charBeforeAt === ' ' || lastAtIndex === 0) && !textAfterAt.includes(' ')) {
        setMentionQuery(textAfterAt.toLowerCase());
        const mentionable = getMentionableUsers();
        const filtered = mentionable.filter(
          (u) => u.username.toLowerCase().includes(textAfterAt.toLowerCase()) || (u.nickname && u.nickname.toLowerCase().includes(textAfterAt.toLowerCase()))
        );
        const suggestions = groupChat && 'everyone'.includes(textAfterAt.toLowerCase())
          ? [{ id: -1, username: 'everyone', nickname: null, avatar: null } as User, ...filtered]
          : filtered;
        setMentionSuggestions(suggestions);
        setShowMentionSuggestions(suggestions.length > 0);
        setSelectedMentionIndex(0);
      } else {
        setShowMentionSuggestions(false);
      }
    } else {
      setShowMentionSuggestions(false);
    }
  };

  const insertMention = (username: string) => {
    const lastAtIndex = newMessage.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const beforeAt = newMessage.substring(0, lastAtIndex);
      const afterAt = newMessage.substring(lastAtIndex + 1);
      const afterMention = afterAt.includes(' ') ? afterAt.substring(afterAt.indexOf(' ')) : '';
      setNewMessage(`${beforeAt}@${username} ${afterMention}`);
      setShowMentionSuggestions(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showMentionSuggestions || mentionSuggestions.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedMentionIndex((p) => p < mentionSuggestions.length - 1 ? p + 1 : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedMentionIndex((p) => p > 0 ? p - 1 : mentionSuggestions.length - 1); }
    else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); insertMention(mentionSuggestions[selectedMentionIndex].username); }
    else if (e.key === 'Escape') setShowMentionSuggestions(false);
  };

  if (status === 'loading' || loading) return <PageLoader message="Loading messages..." />;

  if (!dmId && !groupId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center px-4">
          <div className="w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--text-tertiary)">
              <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold mb-2">No chat selected</h2>
          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Select a conversation or group from the sidebar</p>
        </div>
      </div>
    );
  }

  const activeChat = conversation || groupChat;
  const chatName = conversation
    ? (getOtherUser()?.nickname || getOtherUser()?.username || 'Unknown')
    : groupChat?.name || 'Unknown';
  const chatAvatar = conversation ? getOtherUser()?.avatar : groupChat?.avatar;
  const chatUsername = conversation ? getOtherUser()?.username : undefined;

  return (
    <div className="flex flex-col pt-14 lg:pt-0 fixed top-0 bottom-0 left-0 right-0 lg:left-60" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {activeChat ? (
        <>
          {/* Chat Header */}
          <div className="px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 flex-shrink-0" style={{ borderBottom: '1px solid rgba(0,0,0,0.2)', boxShadow: '0 1px 0 rgba(4,4,5,0.2),0 1.5px 0 rgba(6,6,7,0.05)', backgroundColor: 'var(--bg-primary)', zIndex: 10 }}>
            {conversation && <span className="text-xl" style={{ color: 'var(--text-tertiary)' }}>@</span>}
            {groupChat && <span className="text-xl" style={{ color: 'var(--text-tertiary)' }}>#</span>}

            <button
              onClick={() => { if (conversation && getOtherUser()) router.push(`/profile/${getOtherUser()!.username}`); }}
              className={`font-semibold text-sm sm:text-base truncate ${conversation ? 'hover:underline' : 'cursor-default'}`}
              style={{ color: 'var(--text-primary)', background: 'none', border: 'none' }}
              disabled={!conversation}
            >
              {chatName}
            </button>

            {conversation && (
              <Button variant="ghost" size="icon" onClick={handleDeleteConversation} title="Delete Conversation" className="ml-auto" style={{ color: 'var(--text-secondary)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </Button>
            )}

            {groupChat && (
              <>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>({groupChat.members.length} members)</span>
                <Button variant="ghost" size="icon" onClick={() => setShowGroupSettings(true)} title="Group Settings" className="ml-auto" style={{ color: 'var(--text-secondary)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 16C13.6569 16 15 14.6569 15 13C15 11.3431 13.6569 10 12 10C10.3431 10 9 11.3431 9 13C9 14.6569 10.3431 16 12 16Z" />
                    <path d="M3 13C3 12.5341 3.03591 12.0765 3.10509 11.6296L5.74864 11.1567C5.88167 10.6437 6.07567 10.1533 6.32336 9.69318L4.81331 7.51741C5.32331 6.82107 5.92607 6.19852 6.60487 5.66794L8.81517 7.13088C9.27059 6.87428 9.75654 6.67426 10.2641 6.53773L10.7295 3.84479C11.1506 3.78129 11.5792 3.75 12.0114 3.75C12.4784 3.75 12.9371 3.78875 13.3849 3.86233L13.8503 6.52557C14.3595 6.65825 14.8474 6.85003 15.3055 7.09486L17.5028 5.63344C18.1846 6.1633 18.7899 6.78476 19.3015 7.48067L17.7889 9.66587C18.0383 10.1284 18.2335 10.6214 18.3672 11.1377L21.0172 11.6106C21.0876 12.0639 21.125 12.5279 21.125 13C21.125 13.4377 21.0929 13.8676 21.0305 14.2888L18.3801 14.7617C18.2471 15.2747 18.0531 15.7651 17.8054 16.2252L19.3155 18.401C18.8055 19.0973 18.2027 19.7199 17.5239 20.2505L15.3136 18.7875C14.8582 19.0441 14.3722 19.2441 13.8647 19.3807L13.3993 22.0736C12.9782 22.1371 12.5496 22.1684 12.1174 22.1684C11.6504 22.1684 11.1917 22.1296 10.7439 22.056L10.2785 19.3928C9.76927 19.2601 9.28136 19.0683 8.82323 18.8235L6.62603 20.285C5.94416 19.7551 5.33897 19.1336 4.82731 18.4377L6.33987 16.2525C6.09053 15.79 5.89529 15.297 5.7616 14.7807L3.11153 14.3078C3.04113 13.8545 3.00373 13.3905 3.00373 12.9528C3.00373 12.9193 3.00391 12.8858 3.00427 12.8524L3 13Z" />
                  </svg>
                </Button>
              </>
            )}
          </div>

          {/* Media Viewer */}
          {viewingMedia && (
            <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={() => setViewingMedia(null)}>
              <Button variant="ghost" size="icon" onClick={() => setViewingMedia(null)} className="absolute top-4 right-4 z-10 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: 'white' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
              </Button>
              <div className="max-w-7xl max-h-[90vh] w-full mx-4 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                {viewingMedia.type.startsWith('image/') ? (
                  <img src={viewingMedia.url} alt={viewingMedia.name} className="max-w-full max-h-[90vh] object-contain rounded-lg" />
                ) : viewingMedia.type.startsWith('video/') ? (
                  <video src={viewingMedia.url} controls autoPlay className="max-w-full max-h-[90vh] object-contain rounded-lg" />
                ) : null}
              </div>
            </div>
          )}

          {/* Group Settings Dialog */}
          <Dialog open={showGroupSettings} onOpenChange={setShowGroupSettings}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Group Settings</DialogTitle>
              </DialogHeader>

              {groupChat && (
                <div className="space-y-4">
                  {isGroupAdmin() && (
                    <div>
                      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-tertiary)' }}>GROUP AVATAR</p>
                      <div className="flex items-center gap-4">
                        <UserAvatar src={groupChat.avatar} username={groupChat.name} size="xl" themeColor="#5865f2" />
                        <div className="flex-1">
                          <input ref={groupAvatarInputRef} type="file" accept="image/*" onChange={handleGroupAvatarUpload} className="hidden" />
                          <Button size="sm" disabled={uploadingGroupAvatar} onClick={() => groupAvatarInputRef.current?.click()}>
                            {uploadingGroupAvatar ? 'Uploading...' : 'Change Avatar'}
                          </Button>
                          <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>Recommended: Square image, max 5MB</p>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)' }}>GROUP NAME</p>
                    <p>{groupChat.name}</p>
                  </div>

                  {groupChat.description && (
                    <div>
                      <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-tertiary)' }}>DESCRIPTION</p>
                      <p>{groupChat.description}</p>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>MEMBERS ({groupChat.members.length})</p>
                      {isGroupAdmin() && (
                        <button onClick={() => setShowAddMember(!showAddMember)} className="text-sm font-semibold hover:underline" style={{ color: 'var(--link-color)', background: 'none', border: 'none' }}>
                          Add Member
                        </button>
                      )}
                    </div>

                    {showAddMember && (
                      <div className="mb-3 p-3 rounded" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <p className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>Select a friend to add:</p>
                        {getAvailableFriends().length === 0 ? (
                          <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>No friends available to add</p>
                        ) : (
                          <div className="space-y-2 max-h-40 overflow-y-auto">
                            {getAvailableFriends().map((friend) => (
                              <button key={friend.id} onClick={() => handleAddMember(friend.id)} disabled={addingMember} className="w-full p-2 rounded flex items-center gap-2 transition hover:bg-gray-700" style={{ background: 'none', border: 'none' }}>
                                <UserAvatar src={friend.avatar} username={friend.username} size="xs" />
                                <span className="text-sm flex-1 text-left">{friend.nickname || friend.username}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {groupChat.members.map((member) => {
                        const isCurrentUser = member.user.id === parseInt((session?.user as any)?.id || '0');
                        return (
                          <div key={member.user.id} className="flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <UserAvatar src={member.user.avatar} username={member.user.username} size="sm" />
                            <div className="flex-1">
                              <p className="text-sm">{member.user.nickname || member.user.username}{isCurrentUser && ' (You)'}</p>
                              {member.role === 'admin' && <span className="text-xs" style={{ color: 'var(--link-color)' }}>Admin</span>}
                            </div>
                            {isGroupAdmin() && !isCurrentUser && (
                              <Button size="sm" variant="destructive" onClick={() => handleRemoveMember(member.user.id)}>Kick</Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <Button variant="destructive" className="w-full" onClick={() => handleRemoveMember(parseInt((session?.user as any)?.id || '0'))}>
                      Leave Group
                    </Button>
                    {isGroupAdmin() && (
                      <Button variant="destructive" className="w-full opacity-80" onClick={handleDeleteGroup}>
                        Delete Group
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4" style={{ minHeight: 0, maxHeight: '100%' }}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <UserAvatar
                  src={chatAvatar}
                  username={chatName}
                  size="xl"
                  themeColor="#5865f2"
                  className="mb-4"
                />
                <h2 className="text-2xl font-bold mb-2">{chatName}</h2>
                <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
                  {conversation
                    ? `This is the beginning of your direct message history with @${getOtherUser()?.username}`
                    : `This is the beginning of the ${groupChat?.name} group chat.`}
                </p>
              </div>
            ) : (
              <div>
                {messages.map((msg, index) => {
                  const isCurrentUser = msg.sender.id === parseInt((session?.user as any)?.id || '0');
                  const showAvatar = index === 0 || messages[index - 1].sender.id !== msg.sender.id;
                  const isConsecutive = !showAvatar;
                  const currentUserId = parseInt((session?.user as any)?.id || '0');

                  return (
                    <div
                      key={msg.tempId || msg.id}
                      id={`msg-${msg.id}`}
                      className={`flex gap-2 sm:gap-4 hover:bg-[#2e3035] px-2 sm:px-4 py-1 -mx-2 sm:-mx-4 rounded ${isConsecutive ? 'mt-0.5' : 'mt-3 sm:mt-4'} ${msg.isPending ? 'opacity-70' : ''} relative group`}
                      onMouseEnter={() => setHoveredMessage(msg.id)}
                      onMouseLeave={() => setHoveredMessage(null)}
                    >
                      <div className="flex-shrink-0">
                        {showAvatar ? (
                          isCurrentUser ? (
                            <UserAvatar src={(session?.user as any)?.avatar} username={(session?.user as any)?.username || 'U'} size="md" />
                          ) : (
                            <UserAvatar src={msg.sender.avatar} username={msg.sender.username} size="md" />
                          )
                        ) : (
                          <div className="w-8 sm:w-10" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Hover Actions */}
                        {!msg.isPending && hoveredMessage === msg.id && (
                          <div className="absolute -top-4 right-4 flex gap-1 p-1 rounded shadow-lg z-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setReplyingTo(msg)} title="Reply" style={{ color: 'var(--text-secondary)' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" /></svg>
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)} title="Add Reaction" style={{ color: 'var(--text-secondary)' }}>
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z" /></svg>
                            </Button>
                            {msg.content && (
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigator.clipboard.writeText(msg.content)} title="Copy" style={{ color: 'var(--text-secondary)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z" /></svg>
                              </Button>
                            )}
                            {isCurrentUser && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeleteMessage(msg.id)} title="Delete">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Emoji Picker */}
                        {showEmojiPicker === msg.id && (
                          <div className="absolute top-0 right-16 p-2 rounded shadow-lg z-20 flex flex-wrap gap-1" style={{ backgroundColor: 'var(--bg-secondary)', maxWidth: '200px' }}>
                            {['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉', '🔥', '💯'].map((emoji) => (
                              <button key={emoji} onClick={() => handleAddReaction(msg.id, emoji)} className="text-2xl hover:bg-gray-700 rounded p-1 transition" style={{ background: 'none', border: 'none' }}>{emoji}</button>
                            ))}
                          </div>
                        )}

                        {showAvatar && (
                          <div className="flex items-baseline gap-2 mb-1">
                            <button onClick={() => router.push(`/profile/${msg.sender.username}`)} className="font-semibold hover:underline" style={{ color: isCurrentUser ? 'var(--link-color)' : 'var(--text-primary)', background: 'none', border: 'none' }}>
                              {isCurrentUser ? ((session?.user as any)?.nickname || (session?.user as any)?.username) : (msg.sender.nickname || msg.sender.username)}
                            </button>
                            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                        <div>
                          {msg.replyTo && (
                            <div
                              className="mb-2 pl-2 py-1 border-l-2 rounded text-sm cursor-pointer hover:bg-black hover:bg-opacity-10"
                              style={{ borderColor: '#4e5058', color: 'var(--text-secondary)' }}
                              onClick={() => { document.getElementById(`msg-${msg.replyTo!.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }}
                            >
                              <div className="flex items-center gap-1 mb-0.5">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" /></svg>
                                <span className="font-semibold">{msg.replyTo.sender.nickname || msg.replyTo.sender.username}</span>
                              </div>
                              <p className="truncate" style={{ color: 'var(--text-tertiary)' }}>{msg.replyTo.content}</p>
                            </div>
                          )}

                          {msg.content && (
                            <div className="flex items-center gap-2">
                              <p className="break-words" style={{ color: 'var(--text-secondary)', lineHeight: '1.375rem' }}>
                                {linkifyText(msg.content, router)}
                              </p>
                              {msg.isPending && (
                                <span className="text-xs" style={{ color: 'var(--text-tertiary)' }} title="Sending...">
                                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          )}

                          {msg.attachments && (() => {
                            try {
                              const attachmentList: Attachment[] = typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments;
                              return (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {attachmentList.map((attachment, idx) => {
                                    const isImage = attachment.type.startsWith('image/');
                                    const isVideo = attachment.type.startsWith('video/');
                                    return (
                                      <div key={idx} className="max-w-sm">
                                        {isImage ? (
                                          <img src={attachment.url} alt={attachment.name} className="rounded-lg max-h-80 max-w-full object-contain cursor-pointer hover:opacity-90 transition" onClick={() => setViewingMedia({ url: attachment.url, type: attachment.type, name: attachment.name })} />
                                        ) : isVideo ? (
                                          <div className="relative">
                                            <video src={attachment.url} controls className="rounded-lg max-h-80 max-w-full object-contain" />
                                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: 'white' }} onClick={() => setViewingMedia({ url: attachment.url, type: attachment.type, name: attachment.name })}>
                                              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" /></svg>
                                            </Button>
                                          </div>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            } catch { return null; }
                          })()}

                          {msg.reactions && msg.reactions.length > 0 && (() => {
                            const currentUserId = parseInt((session?.user as any)?.id || '0');
                            const grouped = msg.reactions.reduce((acc, r) => {
                              if (!acc[r.emoji]) acc[r.emoji] = [];
                              acc[r.emoji].push(r);
                              return acc;
                            }, {} as Record<string, Reaction[]>);

                            return (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {Object.entries(grouped).map(([emoji, reactions]) => {
                                  const hasReacted = reactions.some((r) => r.userId === currentUserId);
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => hasReacted ? handleRemoveReaction(msg.id, emoji) : handleAddReaction(msg.id, emoji)}
                                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-sm transition ${hasReacted ? 'hover:bg-blue-900' : 'hover:bg-gray-700'}`}
                                      style={{ backgroundColor: hasReacted ? '#2e4a7c' : 'var(--bg-secondary)', border: hasReacted ? '1px solid #5865f2' : '1px solid var(--border-color)' }}
                                      title={reactions.map((r) => r.user.nickname || r.user.username).join(', ')}
                                    >
                                      <span>{emoji}</span>
                                      <span style={{ color: hasReacted ? '#5865f2' : 'var(--text-secondary)' }}>{reactions.length}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}

            {typingUsers.size > 0 && (
              <div className="px-2 py-1">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: 'var(--text-tertiary)', animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                  <span className="text-sm italic" style={{ color: 'var(--text-tertiary)' }}>
                    {Array.from(typingUsers).join(', ')} {typingUsers.size === 1 ? 'is' : 'are'} typing...
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="px-3 sm:px-4 pb-4 sm:pb-6 flex-shrink-0" style={{ backgroundColor: 'var(--bg-primary)', zIndex: 10 }}>
            {/* Reply Context */}
            {replyingTo && (
              <div className="mb-2 flex items-center gap-2 p-2 rounded" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex-1">
                  <div className="flex items-center gap-1 mb-1">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text-secondary)"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" /></svg>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Replying to {replyingTo.sender.nickname || replyingTo.sender.username}
                    </span>
                  </div>
                  <p className="text-sm truncate" style={{ color: 'var(--text-tertiary)' }}>{replyingTo.content}</p>
                </div>
                <Button type="button" variant="ghost" size="icon" onClick={() => setReplyingTo(null)} className="h-8 w-8" style={{ color: 'var(--text-tertiary)' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" /></svg>
                </Button>
              </div>
            )}

            {/* Attachment Preview */}
            {attachments.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((attachment, index) => {
                  const isImage = attachment.type.startsWith('image/');
                  const isVideo = attachment.type.startsWith('video/');
                  return (
                    <div key={index} className="relative group">
                      {isImage ? <img src={attachment.url} alt={attachment.name} className="h-20 w-20 object-cover rounded" /> : isVideo ? <video src={attachment.url} className="h-20 w-20 object-cover rounded" /> : null}
                      <Button type="button" variant="destructive" size="icon" className="absolute -top-2 -right-2 w-6 h-6 rounded-full" onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}>×</Button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="rounded-lg flex items-center gap-2" style={{ backgroundColor: 'var(--input-bg)' }}>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*,video/*" multiple className="hidden" />
              <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="ml-1" style={{ color: uploading ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
                {uploading ? (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C11.5 2 11 2.19 10.59 2.59L2.59 10.59C1.8 11.37 1.8 12.63 2.59 13.41C3.37 14.2 4.63 14.2 5.41 13.41L11 7.83V19C11 20.1 11.9 21 13 21C14.1 21 15 20.1 15 19V7.83L20.59 13.41C21.37 14.2 22.63 14.2 23.41 13.41C24.2 12.63 24.2 11.37 23.41 10.59L15.41 2.59C15 2.19 14.5 2 14 2H12Z" /></svg>
                )}
              </Button>

              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  placeholder={conversation ? `Message @${getOtherUser()?.username}` : `Message #${groupChat?.name}`}
                  value={newMessage}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-4 py-3"
                  style={{ backgroundColor: 'transparent', color: 'var(--text-primary)', border: 'none', outline: 'none', fontSize: '15px' }}
                />

                {showMentionSuggestions && mentionSuggestions.length > 0 && (
                  <div className="absolute bottom-full left-0 mb-2 rounded-lg shadow-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)', minWidth: '200px', maxHeight: '300px', overflowY: 'auto', zIndex: 50 }}>
                    <div className="p-2">
                      <p className="text-xs font-semibold mb-2 px-2" style={{ color: 'var(--text-tertiary)' }}>MENTION</p>
                      {mentionSuggestions.map((user, index) => (
                        <button
                          key={user.id}
                          onClick={() => insertMention(user.username)}
                          className="w-full flex items-center gap-2 px-2 py-2 rounded transition"
                          style={{ backgroundColor: index === selectedMentionIndex ? 'var(--hover-bg)' : 'transparent', border: 'none' }}
                          onMouseEnter={() => setSelectedMentionIndex(index)}
                        >
                          <UserAvatar src={user.id === -1 ? null : user.avatar} username={user.id === -1 ? '@' : user.username} size="sm" />
                          <div className="flex-1 text-left">
                            <p className="text-sm font-semibold">{user.id === -1 ? 'everyone' : (user.nickname || user.username)}</p>
                            {user.id !== -1 && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>@{user.username}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button type="submit" variant="ghost" size="icon" disabled={!newMessage.trim() && attachments.length === 0} className="mr-1" style={{ color: (newMessage.trim() || attachments.length > 0) ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" /></svg>
              </Button>
            </div>
          </form>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="text-center px-4">
            <h2 className="text-xl font-semibold mb-2">Chat not found</h2>
            <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>This conversation or group may no longer exist</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<PageLoader message="Loading messages..." />}>
      <MessagesContent />
    </Suspense>
  );
}
