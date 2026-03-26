'use client';

import { useEffect, useRef } from 'react';
import { ActiveCall, CallUser } from '@/app/hooks/useWebRTC';
import UserAvatar from './UserAvatar';
import { Button } from '@/components/ui/button';

interface GroupCallOverlayProps {
  call: ActiveCall;
  currentUserId: number;
  localStream: MediaStream | null;
  remoteStreams: Map<number, MediaStream>;
  screenStream: MediaStream | null;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  onLeave: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
}

function VideoTile({
  stream,
  user,
  muted = false,
  label,
  large = false,
}: {
  stream: MediaStream | null;
  user: CallUser | null;
  muted?: boolean;
  label?: string;
  large?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const hasVideo =
    stream &&
    stream.getVideoTracks().length > 0 &&
    stream.getVideoTracks().some((t) => t.enabled && t.readyState === 'live');

  return (
    <div
      className={`relative rounded-xl overflow-hidden flex items-center justify-center ${large ? 'w-full h-full' : 'w-full h-full'}`}
      style={{ backgroundColor: 'var(--bg-secondary)', minHeight: large ? 300 : 140 }}
    >
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={muted}
          className="w-full h-full object-cover"
        />
      ) : (
        <>
          {/* No video – show avatar */}
          <video ref={videoRef} autoPlay playsInline muted={muted} className="hidden" />
          <div className="flex flex-col items-center gap-2">
            {user && (
              <UserAvatar
                src={user.avatar}
                username={user.nickname || user.username}
                size={large ? 'xl' : 'lg'}
                themeColor="#5865f2"
              />
            )}
          </div>
        </>
      )}

      {/* Name label */}
      {(label || user) && (
        <div
          className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-xs font-semibold truncate max-w-[80%]"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)', color: '#fff' }}
        >
          {label || user?.nickname || user?.username}
        </div>
      )}
    </div>
  );
}

function ControlButton({
  onClick,
  active,
  danger,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex items-center justify-center w-12 h-12 rounded-full transition-colors"
      style={{
        backgroundColor: danger
          ? '#ed4245'
          : active
          ? 'var(--bg-tertiary, rgba(255,255,255,0.15))'
          : 'rgba(255,255,255,0.1)',
        color: danger ? '#fff' : active ? '#fff' : 'rgba(255,255,255,0.7)',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export default function GroupCallOverlay({
  call,
  currentUserId,
  localStream,
  remoteStreams,
  screenStream,
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  onLeave,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
}: GroupCallOverlayProps) {
  const currentUser = call.participants.find((p) => p.user.id === currentUserId)?.user ?? null;
  const remoteParticipants = call.participants.filter((p) => p.user.id !== currentUserId);

  const hasScreenShare = isScreenSharing && screenStream;

  // Build participant tiles for remote users
  const remoteTiles = remoteParticipants.map((p) => ({
    user: p.user,
    stream: remoteStreams.get(p.user.id) ?? null,
  }));

  // Determine grid layout
  const totalTiles = remoteTiles.length + 1; // +1 for local
  let gridClass = 'grid-cols-1';
  if (totalTiles === 2) gridClass = 'grid-cols-2';
  else if (totalTiles <= 4) gridClass = 'grid-cols-2';
  else if (totalTiles <= 9) gridClass = 'grid-cols-3';
  else gridClass = 'grid-cols-4';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'var(--bg-primary)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="flex items-center gap-2">
          <span
            className="relative flex h-2.5 w-2.5"
          >
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: '#57f287' }}
            />
            <span
              className="relative inline-flex rounded-full h-2.5 w-2.5"
              style={{ backgroundColor: '#57f287' }}
            />
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Voice Call
          </span>
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
            · {call.participants.length} participant{call.participants.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {hasScreenShare ? (
          // Screen share layout: large screen on left, participant strip on right
          <>
            <div className="flex-1 p-3 flex items-center justify-center">
              <VideoTile
                stream={screenStream}
                user={currentUser}
                muted
                label="Your Screen"
                large
              />
            </div>
            <div
              className="flex flex-col gap-2 p-2 overflow-y-auto"
              style={{ width: 180, borderLeft: '1px solid rgba(255,255,255,0.08)' }}
            >
              {/* Local tile in strip */}
              <div style={{ height: 120 }}>
                <VideoTile
                  stream={localStream}
                  user={currentUser}
                  muted
                  label={`${currentUser?.nickname || currentUser?.username || 'You'} (You)`}
                />
              </div>
              {remoteTiles.map(({ user, stream }) => (
                <div key={user.id} style={{ height: 120 }}>
                  <VideoTile stream={stream} user={user} />
                </div>
              ))}
            </div>
          </>
        ) : (
          // Regular grid layout
          <div className={`flex-1 grid ${gridClass} gap-2 p-3 overflow-auto content-start`}>
            {/* Local tile */}
            <VideoTile
              stream={localStream}
              user={currentUser}
              muted
              label={`${currentUser?.nickname || currentUser?.username || 'You'} (You)`}
            />
            {remoteTiles.map(({ user, stream }) => (
              <VideoTile key={user.id} stream={stream} user={user} />
            ))}
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div
        className="flex items-center justify-center gap-3 px-4 py-4 flex-shrink-0"
        style={{ borderTop: '1px solid rgba(255,255,255,0.08)', backgroundColor: 'var(--bg-secondary)' }}
      >
        {/* Mic */}
        <ControlButton
          onClick={onToggleAudio}
          active={isAudioEnabled}
          title={isAudioEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isAudioEnabled ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z"/>
              <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.34 3 3 3 .23 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.57-.08 1.12-.24 1.64-.46l4.09 4.09L20 20.73 4.27 3z"/>
            </svg>
          )}
        </ControlButton>

        {/* Camera */}
        <ControlButton
          onClick={onToggleVideo}
          active={isVideoEnabled}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 6.5l-4-4-9.91 9.91L3 8.5v8.5h8.59l9.41-9.41V6.5zm-3 8.62L16.12 17H5v-3.12l1.88-1.88.59.59-1.41 1.41H15L18 11l.59.59L16.12 14h.88l1-1v2.12zM3.02 4.41L4.41 3l17 17-1.41 1.41z"/>
            </svg>
          )}
        </ControlButton>

        {/* Screen Share */}
        <ControlButton
          onClick={onToggleScreenShare}
          active={isScreenSharing}
          title={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
        >
          {isScreenSharing ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78.48-4.34 1.71-5.5 3.72.14-1.72.6-4.90 3.5-6.83V7l4 4-2 3.47z"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2H0v2h24v-2h-4zm-7-3.53v-2.19c-2.78.48-4.34 1.71-5.5 3.72.14-1.72.6-4.90 3.5-6.83V7l4 4-2 3.47z"/>
            </svg>
          )}
        </ControlButton>

        {/* Hang Up */}
        <ControlButton onClick={onLeave} danger title="Leave call">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.01L6.6 10.8z"/>
          </svg>
        </ControlButton>
      </div>
    </div>
  );
}
