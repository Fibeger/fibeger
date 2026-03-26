'use client';

import { useAuth } from '@/app/hooks/useAuth';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useRef, Suspense } from 'react';
import { useRealtimeEvents } from '@/app/hooks/useRealtimeEvents';
import { useWebRTC, ActiveCall } from '@/app/hooks/useWebRTC';
import { Button } from '@/components/ui/button';
import PageLoader from '@/app/components/PageLoader';
import ConversationList from './components/ConversationList';
import MessageThread from './components/MessageThread';
import MessageInput from './components/MessageInput';
import type { User, Attachment, Message, Conversation, GroupChat } from './types';

function MessagesContent() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const dmId = searchParams.get('dm');
  const groupId = searchParams.get('group');

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [groupChat, setGroupChat] = useState<GroupChat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<User[]>([]);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [viewingMedia, setViewingMedia] = useState<{ url: string; type: string; name: string } | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [joiningCall, setJoiningCall] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { on } = useRealtimeEvents();

  const currentUserId = user?.id || 0;
  const {
    inCall,
    localStream,
    remoteStreams,
    screenStream,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    startCall,
    joinCall,
    leaveCall,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
  } = useWebRTC({ currentUserId });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) { router.push('/auth/login'); return; }
    if (authLoading || !isAuthenticated) return;
    if (!dmId && !groupId) { setLoading(false); return; }
    if (dmId) { fetchConversation(parseInt(dmId)); }
    else if (groupId) { fetchGroupChat(parseInt(groupId)); fetchFriends(); }
  }, [authLoading, isAuthenticated, router, dmId, groupId]);

  useEffect(() => {
    if (!dmId && !groupId) return;

    const handleMessage = (event: any) => {
      const { conversationId, groupChatId, message: newMsg } = event.data;
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

    const handleCallStarted = (event: any) => {
      const { groupChatId: eventGroupId, call } = event.data;
      if (groupId && parseInt(groupId) === eventGroupId) setActiveCall(call);
    };

    const handleCallEnded = (event: any) => {
      const { groupChatId: eventGroupId } = event.data;
      if (groupId && parseInt(groupId) === eventGroupId) setActiveCall(null);
    };

    const handleCallParticipantJoined = (event: any) => {
      const { groupChatId: eventGroupId, user } = event.data;
      if (groupId && parseInt(groupId) === eventGroupId && user) {
        setActiveCall((prev) => {
          if (!prev) return prev;
          const alreadyIn = prev.participants.some((p) => p.user.id === user.id);
          if (alreadyIn) return prev;
          return { ...prev, participants: [...prev.participants, { user, joinedAt: new Date().toISOString() }] };
        });
      }
    };

    const handleCallParticipantLeft = (event: any) => {
      const { groupChatId: eventGroupId, userId: leftUserId } = event.data;
      if (groupId && parseInt(groupId) === eventGroupId) {
        setActiveCall((prev) => {
          if (!prev) return prev;
          return { ...prev, participants: prev.participants.filter((p) => p.user.id !== leftUserId) };
        });
      }
    };

    const unsubMessage = on('message', handleMessage);
    const unsubTyping = on('typing', handleTyping);
    const unsubReaction = on('reaction', handleReaction);
    const unsubMessageDeleted = on('message_deleted', handleMessageDeleted);
    const unsubConversationDeleted = on('conversation_deleted', handleConversationDeleted);
    const unsubGroupDeleted = on('group_deleted', handleGroupDeleted);
    const unsubGroupUpdated = on('group_updated', handleGroupUpdated);
    const unsubCallStarted = on('call_started', handleCallStarted);
    const unsubCallEnded = on('call_ended', handleCallEnded);
    const unsubCallParticipantJoined = on('call_participant_joined', handleCallParticipantJoined);
    const unsubCallParticipantLeft = on('call_participant_left', handleCallParticipantLeft);

    return () => {
      unsubMessage(); unsubTyping(); unsubReaction();
      unsubMessageDeleted(); unsubConversationDeleted();
      unsubGroupDeleted(); unsubGroupUpdated();
      unsubCallStarted(); unsubCallEnded();
      unsubCallParticipantJoined(); unsubCallParticipantLeft();
    };
  }, [on, dmId, groupId, router, isAuthenticated]);

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
      setGroupChat(null); setMessages([]); setActiveCall(null);
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
        if (group) {
          fetchMessages(id, 'group');
          markAsRead(id, 'group');
          try {
            const callRes = await fetch(`/api/groupchats/${id}/call`);
            if (callRes.ok) {
              const callData = await callRes.json();
              setActiveCall(callData.call);
            }
          } catch { /* non-critical */ }
        }
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

  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/friends');
      if (res.ok) setFriends(await res.json());
    } catch { console.error('Failed to load friends'); }
  };

  const handleStartCall = async () => {
    if (!groupId) return;
    try { await startCall(parseInt(groupId)); }
    catch (err: any) { alert(err?.message || 'Failed to start call'); }
  };

  const handleJoinCall = async () => {
    if (!groupId || !activeCall) return;
    setJoiningCall(true);
    try { await joinCall(parseInt(groupId)); }
    catch (err: any) { alert(err?.message || 'Failed to join call'); }
    finally { setJoiningCall(false); }
  };

  const handleLeaveCall = async () => { await leaveCall(); };

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

    const currentUser: User = {
      id: currentUserId,
      username: user?.username || 'Unknown',
      nickname: user?.nickname || null,
      avatar: user?.avatar || null,
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

  const handleDeleteConversation = async () => {
    if (!dmId || !confirm('Are you sure you want to delete this conversation? This will delete all messages and cannot be undone.')) return;
    try {
      const res = await fetch(`/api/conversations/${dmId}`, { method: 'DELETE' });
      if (res.ok) router.push('/messages');
      else { const error = await res.json(); alert(error.error || 'Failed to delete conversation'); }
    } catch { alert('Failed to delete conversation'); }
  };

  const handleAddReaction = async (messageId: number, emoji: string) => {
    try {
      await fetch(`/api/messages/${messageId}/reactions`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emoji }) });
    } catch { console.error('Failed to add reaction'); }
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

  const handleRefreshGroup = () => {
    if (groupId) fetchGroupChat(parseInt(groupId));
  };

  const getOtherUser = (): User | null => {
    if (!conversation) return null;
    return conversation.members.find((m) => m.user.id !== currentUserId)?.user || null;
  };

  if (authLoading || loading) return <PageLoader message="Loading messages..." />;

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

  return (
    <div className="flex flex-col pt-14 lg:pt-0 fixed top-0 bottom-0 left-0 right-0 lg:left-60" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {activeChat ? (
        <>
          <ConversationList
            conversation={conversation}
            groupChat={groupChat}
            currentUserId={currentUserId}
            chatName={chatName}
            activeCall={activeCall}
            inCall={inCall}
            joiningCall={joiningCall}
            localStream={localStream}
            remoteStreams={remoteStreams}
            screenStream={screenStream}
            isAudioEnabled={isAudioEnabled}
            isVideoEnabled={isVideoEnabled}
            isScreenSharing={isScreenSharing}
            onDeleteConversation={handleDeleteConversation}
            onStartCall={handleStartCall}
            onJoinCall={handleJoinCall}
            onLeaveCall={handleLeaveCall}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onToggleScreenShare={toggleScreenShare}
            friends={friends}
            groupId={groupId}
            onRefreshGroup={handleRefreshGroup}
          />

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

          <MessageThread
            messages={messages}
            user={user}
            typingUsers={typingUsers}
            conversation={conversation}
            groupChat={groupChat}
            chatName={chatName}
            chatAvatar={chatAvatar ?? null}
            onReply={setReplyingTo}
            onDeleteMessage={handleDeleteMessage}
            onAddReaction={handleAddReaction}
            onRemoveReaction={handleRemoveReaction}
            onViewMedia={setViewingMedia}
          />

          <MessageInput
            conversation={conversation}
            groupChat={groupChat}
            user={user}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            attachments={attachments}
            setAttachments={setAttachments}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            onSend={handleSendMessage}
            onTyping={handleTypingIndicator}
          />
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
