'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/app/components/UserAvatar';
import type { Message, User, Attachment, Conversation, GroupChat } from '../types';

interface MessageInputProps {
  conversation: Conversation | null;
  groupChat: GroupChat | null;
  user: { id: number; username?: string; nickname?: string; avatar?: string | null } | null;
  newMessage: string;
  setNewMessage: (value: string) => void;
  attachments: Attachment[];
  setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
  replyingTo: Message | null;
  setReplyingTo: (msg: Message | null) => void;
  onSend: (e: React.FormEvent) => void;
  onTyping: () => void;
}

export default function MessageInput({
  conversation,
  groupChat,
  user,
  newMessage,
  setNewMessage,
  attachments,
  setAttachments,
  replyingTo,
  setReplyingTo,
  onSend,
  onTyping,
}: MessageInputProps) {
  const [uploading, setUploading] = useState(false);
  const [mentionSuggestions, setMentionSuggestions] = useState<User[]>([]);
  const [showMentionSuggestions, setShowMentionSuggestions] = useState(false);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const currentUserId = user?.id || 0;

  const getOtherUser = (): User | null => {
    if (!conversation) return null;
    return conversation.members.find((m) => m.user.id !== currentUserId)?.user || null;
  };

  const getMentionableUsers = (): User[] => {
    const users: User[] = [];
    if (conversation) {
      const other = getOtherUser();
      if (other) users.push(other);
    } else if (groupChat) {
      groupChat.members.forEach((m) => { if (m.user.id !== currentUserId) users.push(m.user); });
    }
    return users;
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

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    onTyping();

    const lastAtIndex = value.lastIndexOf('@');
    if (lastAtIndex !== -1) {
      const textAfterAt = value.substring(lastAtIndex + 1);
      const charBeforeAt = lastAtIndex === 0 ? ' ' : value[lastAtIndex - 1];
      if ((charBeforeAt === ' ' || lastAtIndex === 0) && !textAfterAt.includes(' ')) {
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

  return (
    <form onSubmit={onSend} className="px-3 sm:px-4 pb-4 sm:pb-6 flex-shrink-0" style={{ backgroundColor: 'var(--bg-primary)', zIndex: 10 }}>
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
                {mentionSuggestions.map((mentionUser, index) => (
                  <button
                    key={mentionUser.id}
                    onClick={() => insertMention(mentionUser.username)}
                    className="w-full flex items-center gap-2 px-2 py-2 rounded transition"
                    style={{ backgroundColor: index === selectedMentionIndex ? 'var(--hover-bg)' : 'transparent', border: 'none' }}
                    onMouseEnter={() => setSelectedMentionIndex(index)}
                  >
                    <UserAvatar src={mentionUser.id === -1 ? null : mentionUser.avatar} username={mentionUser.id === -1 ? '@' : mentionUser.username} size="sm" />
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold">{mentionUser.id === -1 ? 'everyone' : (mentionUser.nickname || mentionUser.username)}</p>
                      {mentionUser.id !== -1 && <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>@{mentionUser.username}</p>}
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
  );
}
