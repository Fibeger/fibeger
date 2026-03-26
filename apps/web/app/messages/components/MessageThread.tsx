'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import UserAvatar from '@/app/components/UserAvatar';
import type { Message, User, Attachment, Reaction, Conversation, GroupChat } from '../types';

function linkifyText(text: string, router: ReturnType<typeof useRouter>) {
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

interface MessageThreadProps {
  messages: Message[];
  user: { id: number; username?: string; nickname?: string; avatar?: string | null } | null;
  typingUsers: Set<string>;
  conversation: Conversation | null;
  groupChat: GroupChat | null;
  chatName: string;
  chatAvatar: string | null;
  onReply: (msg: Message) => void;
  onDeleteMessage: (id: number) => void;
  onAddReaction: (messageId: number, emoji: string) => void;
  onRemoveReaction: (messageId: number, emoji: string) => void;
  onViewMedia: (media: { url: string; type: string; name: string }) => void;
}

export default function MessageThread({
  messages,
  user,
  typingUsers,
  conversation,
  groupChat,
  chatName,
  chatAvatar,
  onReply,
  onDeleteMessage,
  onAddReaction,
  onRemoveReaction,
  onViewMedia,
}: MessageThreadProps) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [hoveredMessage, setHoveredMessage] = useState<number | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<number | null>(null);
  const currentUserId = user?.id || 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getOtherUser = (): User | null => {
    if (!conversation) return null;
    return conversation.members.find((m) => m.user.id !== currentUserId)?.user || null;
  };

  return (
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
            const isCurrentUser = msg.sender.id === currentUserId;
            const showAvatar = index === 0 || messages[index - 1].sender.id !== msg.sender.id;
            const isConsecutive = !showAvatar;

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
                      <UserAvatar src={user?.avatar} username={user?.username || 'U'} size="md" />
                    ) : (
                      <UserAvatar src={msg.sender.avatar} username={msg.sender.username} size="md" />
                    )
                  ) : (
                    <div className="w-8 sm:w-10" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  {!msg.isPending && hoveredMessage === msg.id && (
                    <div className="absolute -top-4 right-4 flex gap-1 p-1 rounded shadow-lg z-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onReply(msg)} title="Reply" style={{ color: 'var(--text-secondary)' }}>
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => onDeleteMessage(msg.id)} title="Delete">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" /></svg>
                        </Button>
                      )}
                    </div>
                  )}

                  {showEmojiPicker === msg.id && (
                    <div className="absolute top-0 right-16 p-2 rounded shadow-lg z-20 flex flex-wrap gap-1" style={{ backgroundColor: 'var(--bg-secondary)', maxWidth: '200px' }}>
                      {['👍', '❤️', '😂', '😮', '😢', '😡', '👏', '🎉', '🔥', '💯'].map((emoji) => (
                        <button key={emoji} onClick={() => { onAddReaction(msg.id, emoji); setShowEmojiPicker(null); }} className="text-2xl hover:bg-gray-700 rounded p-1 transition" style={{ background: 'none', border: 'none' }}>{emoji}</button>
                      ))}
                    </div>
                  )}

                  {showAvatar && (
                    <div className="flex items-baseline gap-2 mb-1">
                      <button onClick={() => router.push(`/profile/${msg.sender.username}`)} className="font-semibold hover:underline" style={{ color: isCurrentUser ? 'var(--link-color)' : 'var(--text-primary)', background: 'none', border: 'none' }}>
                        {isCurrentUser ? (user?.nickname || user?.username) : (msg.sender.nickname || msg.sender.username)}
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
                                    <img src={attachment.url} alt={attachment.name} className="rounded-lg max-h-80 max-w-full object-contain cursor-pointer hover:opacity-90 transition" onClick={() => onViewMedia({ url: attachment.url, type: attachment.type, name: attachment.name })} />
                                  ) : isVideo ? (
                                    <div className="relative">
                                      <video src={attachment.url} controls className="rounded-lg max-h-80 max-w-full object-contain" />
                                      <Button variant="ghost" size="icon" className="absolute top-2 right-2 rounded-full" style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: 'white' }} onClick={() => onViewMedia({ url: attachment.url, type: attachment.type, name: attachment.name })}>
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
                                onClick={() => hasReacted ? onRemoveReaction(msg.id, emoji) : onAddReaction(msg.id, emoji)}
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
  );
}
