'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import UserAvatar from '@/app/components/UserAvatar';
import CallBanner from '@/app/components/CallBanner';
import GroupCallOverlay from '@/app/components/GroupCallOverlay';
import type { ActiveCall } from '@/app/hooks/useWebRTC';
import type { Conversation, GroupChat, User } from '../types';

interface ConversationListProps {
  conversation: Conversation | null;
  groupChat: GroupChat | null;
  currentUserId: number;
  chatName: string;
  activeCall: ActiveCall | null;
  inCall: boolean;
  joiningCall: boolean;
  localStream: MediaStream | null;
  remoteStreams: Map<number, MediaStream>;
  screenStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  onDeleteConversation: () => void;
  onStartCall: () => void;
  onJoinCall: () => void;
  onLeaveCall: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  friends: User[];
  groupId: string | null;
  onRefreshGroup: () => void;
}

export default function ConversationList({
  conversation,
  groupChat,
  currentUserId,
  chatName,
  activeCall,
  inCall,
  joiningCall,
  localStream,
  remoteStreams,
  screenStream,
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  onDeleteConversation,
  onStartCall,
  onJoinCall,
  onLeaveCall,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  friends,
  groupId,
  onRefreshGroup,
}: ConversationListProps) {
  const router = useRouter();
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addingMember, setAddingMember] = useState(false);
  const [uploadingGroupAvatar, setUploadingGroupAvatar] = useState(false);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  const getOtherUser = (): User | null => {
    if (!conversation) return null;
    return conversation.members.find((m) => m.user.id !== currentUserId)?.user || null;
  };

  const isGroupAdmin = () => {
    if (!groupChat) return false;
    return groupChat.members.find((m) => m.user.id === currentUserId)?.role === 'admin';
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
      if (res.ok) { onRefreshGroup(); setShowAddMember(false); }
      else { const error = await res.json(); alert(error.error || 'Failed to add member'); }
    } catch { alert('Failed to add member'); }
    finally { setAddingMember(false); }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!groupId) return;
    const isRemovingSelf = userId === currentUserId;
    if (!confirm(isRemovingSelf ? 'Are you sure you want to leave this group?' : 'Are you sure you want to remove this member?')) return;

    try {
      const res = await fetch(`/api/groupchats/${groupId}/members/${userId}`, { method: 'DELETE' });
      if (res.ok) { isRemovingSelf ? router.push('/messages') : onRefreshGroup(); }
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
      if (res.ok) { onRefreshGroup(); }
      else { const error = await res.json(); alert(error.error || 'Failed to upload avatar'); }
    } catch { alert('Failed to upload avatar'); }
    finally { setUploadingGroupAvatar(false); if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = ''; }
  };

  return (
    <>
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
          <Button variant="ghost" size="icon" onClick={onDeleteConversation} title="Delete Conversation" className="ml-auto" style={{ color: 'var(--text-secondary)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
            </svg>
          </Button>
        )}

        {groupChat && (
          <>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>({groupChat.members.length} members)</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={activeCall ? onJoinCall : onStartCall}
              title={activeCall ? 'Join active call' : 'Start voice call'}
              className="ml-auto"
              style={{ color: activeCall ? '#57f287' : 'var(--text-secondary)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.01L6.6 10.8z"/>
              </svg>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setShowGroupSettings(true)} title="Group Settings" style={{ color: 'var(--text-secondary)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 16C13.6569 16 15 14.6569 15 13C15 11.3431 13.6569 10 12 10C10.3431 10 9 11.3431 9 13C9 14.6569 10.3431 16 12 16Z" />
                <path d="M3 13C3 12.5341 3.03591 12.0765 3.10509 11.6296L5.74864 11.1567C5.88167 10.6437 6.07567 10.1533 6.32336 9.69318L4.81331 7.51741C5.32331 6.82107 5.92607 6.19852 6.60487 5.66794L8.81517 7.13088C9.27059 6.87428 9.75654 6.67426 10.2641 6.53773L10.7295 3.84479C11.1506 3.78129 11.5792 3.75 12.0114 3.75C12.4784 3.75 12.9371 3.78875 13.3849 3.86233L13.8503 6.52557C14.3595 6.65825 14.8474 6.85003 15.3055 7.09486L17.5028 5.63344C18.1846 6.1633 18.7899 6.78476 19.3015 7.48067L17.7889 9.66587C18.0383 10.1284 18.2335 10.6214 18.3672 11.1377L21.0172 11.6106C21.0876 12.0639 21.125 12.5279 21.125 13C21.125 13.4377 21.0929 13.8676 21.0305 14.2888L18.3801 14.7617C18.2471 15.2747 18.0531 15.7651 17.8054 16.2252L19.3155 18.401C18.8055 19.0973 18.2027 19.7199 17.5239 20.2505L15.3136 18.7875C14.8582 19.0441 14.3722 19.2441 13.8647 19.3807L13.3993 22.0736C12.9782 22.1371 12.5496 22.1684 12.1174 22.1684C11.6504 22.1684 11.1917 22.1296 10.7439 22.056L10.2785 19.3928C9.76927 19.2601 9.28136 19.0683 8.82323 18.8235L6.62603 20.285C5.94416 19.7551 5.33897 19.1336 4.82731 18.4377L6.33987 16.2525C6.09053 15.79 5.89529 15.297 5.7616 14.7807L3.11153 14.3078C3.04113 13.8545 3.00373 13.3905 3.00373 12.9528C3.00373 12.9193 3.00391 12.8858 3.00427 12.8524L3 13Z" />
              </svg>
            </Button>
          </>
        )}
      </div>

      {groupChat && activeCall && !inCall && (
        <CallBanner call={activeCall} onJoin={onJoinCall} joining={joiningCall} />
      )}

      {groupChat && inCall && activeCall && (
        <GroupCallOverlay
          call={activeCall}
          currentUserId={currentUserId}
          localStream={localStream}
          remoteStreams={remoteStreams}
          screenStream={screenStream}
          isAudioEnabled={isAudioEnabled}
          isVideoEnabled={isVideoEnabled}
          isScreenSharing={isScreenSharing}
          onLeave={onLeaveCall}
          onToggleAudio={onToggleAudio}
          onToggleVideo={onToggleVideo}
          onToggleScreenShare={onToggleScreenShare}
        />
      )}

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
                    const isCurrentUser = member.user.id === currentUserId;
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
                <Button variant="destructive" className="w-full" onClick={() => handleRemoveMember(currentUserId)}>
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
    </>
  );
}
