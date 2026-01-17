'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';

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
  const { data: session } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserPreview[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    fetchFriendRequests();
  }, [session, router]);

  const fetchFriendRequests = async () => {
    try {
      const res = await fetch('/api/friends/request/dummy');
      if (res.ok) {
        const data = await res.json();
        setFriendRequests(data);
      }
    } catch (error) {
      console.error('Failed to load friend requests');
    }
  };

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/friends/request?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      }
    } catch (error) {
      setMessage('Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleSendFriendRequest = async (username: string) => {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiverUsername: username }),
      });

      if (res.ok) {
        setMessage('✓ Friend request sent!');
        setSearchQuery('');
        setSearchResults([]);
        setTimeout(() => setMessage(''), 3000);
      } else {
        const error = await res.json();
        setMessage(error.error || 'Failed to send request');
      }
    } catch (error) {
      setMessage('Error sending friend request');
    }
  };

  const handleRespondToRequest = async (
    requestId: number,
    action: 'accept' | 'reject'
  ) => {
    try {
      const res = await fetch(`/api/friends/request/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });

      if (res.ok) {
        setMessage(action === 'accept' ? '✓ Friend added!' : '✗ Request rejected');
        fetchFriendRequests();
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to respond to request');
      }
    } catch (error) {
      setMessage('Error responding to request');
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-8">
        <h1 className="text-4xl font-bold mb-8" style={{ color: 'var(--text-primary)' }}>Find Friends</h1>

        {message && (
          <div className={`mb-6 p-4 rounded font-semibold transition-all`}
            style={{
              backgroundColor: message.includes('✓') ? 'var(--success)' : message.includes('✗') ? 'var(--danger)' : 'var(--accent)',
              color: '#ffffff'
            }}>
            {message}
          </div>
        )}

        {/* Search Users */}
        <div className="rounded p-8 mb-6" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Search Users</h2>
          <p className="mb-4 font-medium" style={{ color: 'var(--text-secondary)' }}>Find your friends by username</p>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by username..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full px-4 py-3 rounded text-base font-medium"
            />
            {searching && (
              <div className="absolute right-4 top-3 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Searching...
              </div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
              <p className="text-lg mb-6 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between py-4 px-4 rounded mb-3 transition"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div className="flex items-center gap-4">
                    {user.avatar ? (
                      <img
                        src={user.avatar}
                        alt={user.username}
                        className="w-12 h-12 rounded-full object-cover border-2"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: 'var(--accent)' }}>
                        {user.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{user.username}</p>
                      {user.nickname && (
                        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>{user.nickname}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendFriendRequest(user.username)}
                    className="px-4 py-2 text-white text-sm font-medium rounded transition"
                    style={{ backgroundColor: 'var(--accent)' }}
                  >
                    Add Friend
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Friend Requests */}
        {friendRequests.length > 0 && (
          <div className="rounded p-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Friend Requests</h2>
            <p className="mb-8 font-medium text-lg" style={{ color: 'var(--text-secondary)' }}>You have {friendRequests.length} pending request{friendRequests.length !== 1 ? 's' : ''}</p>
            <div className="space-y-4">
              {friendRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex items-center justify-between p-4 rounded transition"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div className="flex items-center gap-4">
                    {request.sender.avatar ? (
                      <img
                        src={request.sender.avatar}
                        alt={request.sender.username}
                        className="w-14 h-14 rounded-full object-cover border-2"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: 'var(--accent)' }}>
                        {request.sender.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {request.sender.nickname || request.sender.username}
                      </p>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>@{request.sender.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRespondToRequest(request.id, 'accept')}
                      className="px-4 py-2 text-white text-sm font-medium rounded transition"
                      style={{ backgroundColor: 'var(--success)' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRespondToRequest(request.id, 'reject')}
                      className="px-4 py-2 text-white text-sm font-medium rounded transition"
                      style={{ backgroundColor: 'var(--danger)' }}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {friendRequests.length === 0 && searchQuery === '' && (
          <div className="text-center py-12">
            <p className="text-2xl font-semibold" style={{ color: 'var(--text-secondary)' }}>No friend requests yet</p>
            <p className="mt-4 font-medium" style={{ color: 'var(--text-tertiary)' }}>Search for users above to send friend requests</p>
          </div>
        )}
      </div>
    </div>
  );
}
