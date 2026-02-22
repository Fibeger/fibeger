'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useRealtimeEvents } from '@/app/hooks/useRealtimeEvents';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import PageLoader from '@/app/components/PageLoader';
import UserAvatar from '@/app/components/UserAvatar';

interface UserPreview {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

interface FriendRequest {
  id: number;
  sender: UserPreview;
  status: string;
  createdAt: string;
}

export default function FriendsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { on, off } = useRealtimeEvents();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserPreview[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<UserPreview[]>([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  useEffect(() => {
    if (status === 'unauthenticated') { router.push('/auth/login'); return; }
    if (status === 'loading' || !session) return;
    fetchFriendRequests();
    fetchFriends();
  }, [status, session, router]);

  useEffect(() => {
    const handleFriendRemoved = (event: any) => {
      fetchFriends();
      const removedByName = event.data.removedByNickname || event.data.removedByUsername;
      showMessage(`${removedByName} removed you from their friends`, 'info');
    };
    on('friend_removed', handleFriendRemoved);
    return () => off('friend_removed', handleFriendRemoved);
  }, [on, off]);

  const fetchFriendRequests = async () => {
    try {
      const res = await fetch('/api/friends/request/dummy');
      if (res.ok) setFriendRequests(await res.json());
    } catch { console.error('Failed to load friend requests'); }
  };

  const fetchFriends = async () => {
    try {
      const res = await fetch('/api/friends');
      if (res.ok) setFriends(await res.json());
    } catch { console.error('Failed to load friends'); }
    finally { setLoading(false); }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) { setSearchResults([]); return; }

    setSearching(true);
    try {
      const res = await fetch(`/api/friends/request?query=${encodeURIComponent(query)}`);
      if (res.ok) setSearchResults(await res.json());
    } catch { showMessage('Failed to search users', 'error'); }
    finally { setSearching(false); }
  };

  const handleSendFriendRequest = async (username: string) => {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverUsername: username }),
      });
      if (res.ok) {
        showMessage('Friend request sent!', 'success');
        setSearchQuery('');
        setSearchResults([]);
      } else {
        const error = await res.json();
        showMessage(error.error || 'Failed to send request', 'error');
      }
    } catch { showMessage('Error sending friend request', 'error'); }
  };

  const handleRespondToRequest = async (requestId: number, action: 'accept' | 'reject') => {
    try {
      const res = await fetch(`/api/friends/request/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        showMessage(action === 'accept' ? 'Friend added!' : 'Request rejected', action === 'accept' ? 'success' : 'info');
        fetchFriendRequests();
        if (action === 'accept') fetchFriends();
      } else {
        showMessage('Failed to respond to request', 'error');
      }
    } catch { showMessage('Error responding to request', 'error'); }
  };

  const handleMessageFriend = async (friendId: number) => {
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });
      if (res.ok) {
        const conversation = await res.json();
        router.push(`/messages?dm=${conversation.id}`);
      } else {
        const error = await res.json();
        showMessage(error.error || 'Failed to open conversation', 'error');
      }
    } catch { showMessage('Error opening conversation', 'error'); }
  };

  const handleRemoveFriend = async (friendId: number, friendName: string) => {
    if (!confirm(`Are you sure you want to remove ${friendName} from your friends?`)) return;

    try {
      const res = await fetch(`/api/friends?friendId=${friendId}`, { method: 'DELETE' });
      if (res.ok) {
        showMessage('Friend removed successfully', 'success');
        fetchFriends();
      } else {
        const error = await res.json();
        showMessage(error.error || 'Failed to remove friend', 'error');
      }
    } catch { showMessage('Error removing friend', 'error'); }
  };

  if (status === 'loading' || loading) return <PageLoader message="Loading friends..." />;

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-12">
        <h1 className="text-4xl font-bold mb-8">Find Friends</h1>

        {message && (
          <Alert variant={messageType === 'error' ? 'destructive' : 'default'} className="mb-6">
            <AlertDescription className="font-semibold">{message}</AlertDescription>
          </Alert>
        )}

        {/* Friends List */}
        {friends.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Your Friends</CardTitle>
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                You have {friends.length} friend{friends.length !== 1 ? 's' : ''}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {friends.map((friend) => (
                  <div
                    key={friend.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg gap-3"
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    <div className="flex items-center gap-4">
                      <UserAvatar src={friend.avatar} username={friend.username} size="lg" />
                      <div>
                        <button onClick={() => router.push(`/profile/${friend.username}`)} className="font-semibold hover:underline text-left text-lg" style={{ color: 'var(--text-primary)', background: 'none', border: 'none' }}>
                          {friend.nickname || friend.username}
                        </button>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>@{friend.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <Button size="sm" className="flex-1 sm:flex-none" onClick={() => handleMessageFriend(friend.id)}>
                        Message
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={() => handleRemoveFriend(friend.id, friend.nickname || friend.username)}>
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Search Users */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Search Users</CardTitle>
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Find your friends by username</p>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Input
                type="text"
                placeholder="Search by username..."
                value={searchQuery}
                onChange={handleSearch}
              />
              {searching && (
                <span className="absolute right-4 top-3 text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                  Searching...
                </span>
              )}
            </div>

            {searchResults.length > 0 && (
              <div className="mt-6 pt-6 space-y-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
                  Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
                </p>
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg gap-3"
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    <div className="flex items-center gap-4">
                      <UserAvatar src={user.avatar} username={user.username} size="md" />
                      <div>
                        <button onClick={() => router.push(`/profile/${user.username}`)} className="font-semibold hover:underline text-left" style={{ color: 'var(--text-primary)', background: 'none', border: 'none' }}>
                          {user.username}
                        </button>
                        {user.nickname && <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>{user.nickname}</p>}
                      </div>
                    </div>
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => handleSendFriendRequest(user.username)}>
                      Add Friend
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Friend Requests */}
        {friendRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Friend Requests</CardTitle>
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                You have {friendRequests.length} pending request{friendRequests.length !== 1 ? 's' : ''}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {friendRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-lg gap-3"
                    style={{ backgroundColor: 'var(--bg-tertiary)' }}
                  >
                    <div className="flex items-center gap-4">
                      <UserAvatar src={request.sender.avatar} username={request.sender.username} size="lg" />
                      <div>
                        <button onClick={() => router.push(`/profile/${request.sender.username}`)} className="font-semibold hover:underline text-left" style={{ color: 'var(--text-primary)', background: 'none', border: 'none' }}>
                          {request.sender.nickname || request.sender.username}
                        </button>
                        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>@{request.sender.username}</p>
                      </div>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <Button size="sm" className="flex-1 sm:flex-none app-btn-success" onClick={() => handleRespondToRequest(request.id, 'accept')}>
                        Accept
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1 sm:flex-none" onClick={() => handleRespondToRequest(request.id, 'reject')}>
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {friendRequests.length === 0 && searchQuery === '' && friends.length === 0 && (
          <div className="text-center py-12">
            <p className="text-2xl font-semibold" style={{ color: 'var(--text-secondary)' }}>No friend requests yet</p>
            <p className="mt-4 font-medium" style={{ color: 'var(--text-tertiary)' }}>Search for users above to send friend requests</p>
          </div>
        )}
      </div>
    </div>
  );
}
