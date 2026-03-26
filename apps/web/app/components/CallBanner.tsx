'use client';

import { ActiveCall, CallUser } from '@/app/hooks/useWebRTC';
import UserAvatar from './UserAvatar';
import { Button } from '@/components/ui/button';

interface CallBannerProps {
  call: ActiveCall;
  onJoin: () => void;
  joining?: boolean;
}

export default function CallBanner({ call, onJoin, joining = false }: CallBannerProps) {
  const activeParticipants = call.participants.slice(0, 3);
  const overflow = call.participants.length - 3;

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 text-sm flex-shrink-0"
      style={{
        backgroundColor: 'rgba(88, 101, 242, 0.15)',
        borderBottom: '1px solid rgba(88, 101, 242, 0.3)',
      }}
    >
      {/* Pulsing call indicator */}
      <span className="relative flex h-3 w-3 flex-shrink-0">
        <span
          className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
          style={{ backgroundColor: '#5865f2' }}
        />
        <span
          className="relative inline-flex rounded-full h-3 w-3"
          style={{ backgroundColor: '#5865f2' }}
        />
      </span>

      {/* Participant avatars */}
      <div className="flex -space-x-2 flex-shrink-0">
        {activeParticipants.map((p: { user: CallUser }) => (
          <UserAvatar
            key={p.user.id}
            src={p.user.avatar}
            username={p.user.nickname || p.user.username}
            size="xs"
            themeColor="#5865f2"
            className="ring-2"
            style={{ '--ring-color': 'var(--bg-primary)' } as React.CSSProperties}
          />
        ))}
        {overflow > 0 && (
          <div
            className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ring-2"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
            }}
          >
            +{overflow}
          </div>
        )}
      </div>

      <span style={{ color: 'var(--text-secondary)' }} className="flex-1 truncate">
        <span className="font-semibold" style={{ color: '#5865f2' }}>
          Voice Call
        </span>
        {' '}— {call.participants.length} participant{call.participants.length !== 1 ? 's' : ''}
      </span>

      <Button
        size="sm"
        onClick={onJoin}
        disabled={joining}
        className="flex-shrink-0 text-white font-semibold"
        style={{ backgroundColor: '#5865f2', borderColor: '#5865f2' }}
      >
        {joining ? 'Joining…' : 'Join Call'}
      </Button>
    </div>
  );
}
