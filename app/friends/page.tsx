'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useFriendsStore } from '@/app/stores/friendsStore';

export default function FriendsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [message, setMessage] = useState('');

  // Get state and actions from store
  const {
    friends,
    friendRequests,
    searchResults,
    isLoading,
    isSearching,
    fetchFriends,
    fetchFriendRequests,
    searchUsers,
    sendFriendRequest,
    respondToRequest,
    removeFriendById,
    clearSearchResults,
  } = useFriendsStore();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push('/auth/login');
      return;
    }

    if (status === "loading" || !session) {
      return;
    }

    // Fetch data on mount (with caching)
    fetchFriendRequests();
    fetchFriends();
  }, [status, session, router, fetchFriendRequests, fetchFriends]);

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    await searchUsers(query);
  };

  const handleSendFriendRequest = async (username: string) => {
    const result = await sendFriendRequest(username);
    if (result.success) {
      setMessage('✓ Friend request sent!');
      setSearchQuery('');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage(result.error || 'Failed to send request');
    }
  };

  const handleRespondToRequest = async (
    requestId: number,
    action: 'accept' | 'reject'
  ) => {
    const result = await respondToRequest(requestId, action);
    if (result.success) {
      setMessage(action === 'accept' ? '✓ Friend added!' : '✗ Request rejected');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage(result.error || 'Failed to respond to request');
    }
  };

  const handleMessageFriend = async (friendId: number) => {
    try {
      // Get or create conversation with this friend
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId }),
      });

      if (res.ok) {
        const conversation = await res.json();
        // Navigate to the DM
        router.push(`/messages?dm=${conversation.id}`);
      } else {
        const error = await res.json();
        setMessage(error.error || 'Failed to open conversation');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      setMessage('Error opening conversation');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  const handleRemoveFriend = async (friendId: number, friendName: string) => {
    if (!confirm(`Are you sure you want to remove ${friendName} from your friends?`)) {
      return;
    }

    const result = await removeFriendById(friendId);
    if (result.success) {
      setMessage('✓ Friend removed successfully');
      setTimeout(() => setMessage(''), 3000);
    } else {
      setMessage(result.error || 'Failed to remove friend');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4" style={{ borderColor: 'var(--accent)', borderTopColor: 'var(--text-primary)' }}></div>
          <p className="mt-6 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>Loading friends...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-12">
        <h1 className="text-4xl font-bold mb-10" style={{ color: 'var(--text-primary)' }}>Find Friends</h1>

        {message && (
          <div className={`mb-8 p-5 rounded-lg font-semibold transition-all`}
            style={{
              backgroundColor: message.includes('✓') ? 'var(--success)' : message.includes('✗') ? 'var(--danger)' : 'var(--accent)',
              color: '#ffffff'
            }}>
            {message}
          </div>
        )}

        {/* Friends List */}
        {friends.length > 0 && (
          <div className="rounded-lg p-10 mb-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Your Friends</h2>
            <p className="mb-10 font-medium text-lg" style={{ color: 'var(--text-secondary)' }}>
              You have {friends.length} friend{friends.length !== 1 ? 's' : ''}
            </p>
            <div className="space-y-4">
              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-lg transition hover:opacity-80 gap-3"
                  style={{ backgroundColor: 'var(--bg-tertiary)' }}
                >
                  <div className="flex items-center gap-4">
                    {friend.avatar ? (
                      <img
                        src={friend.avatar}
                        alt={friend.username}
                        className="w-14 h-14 rounded-full object-cover border-2"
                        style={{ borderColor: 'var(--border-color)' }}
                      />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ backgroundColor: 'var(--accent)' }}>
                        {friend.username.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <button
                        onClick={() => router.push(`/profile/${friend.username}`)}
                        className="font-semibold hover:underline text-left text-lg"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {friend.nickname || friend.username}
                      </button>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>@{friend.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => handleMessageFriend(friend.id)}
                      className="flex-1 sm:flex-none px-5 py-2.5 text-white text-sm font-medium rounded-md transition hover:opacity-90"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      Message
                    </button>
                    <button
                      onClick={() => handleRemoveFriend(friend.id, friend.nickname || friend.username)}
                      className="flex-1 sm:flex-none px-5 py-2.5 text-white text-sm font-medium rounded-md transition hover:opacity-90"
                      style={{ backgroundColor: 'var(--danger)' }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Users */}
        <div className="rounded-lg p-10 mb-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <h2 className="text-2xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Search Users</h2>
          <p className="mb-6 font-medium" style={{ color: 'var(--text-secondary)' }}>Find your friends by username</p>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by username..."
              value={searchQuery}
              onChange={handleSearch}
              className="w-full px-5 py-4 rounded-md text-base font-medium"
            />
            {isSearching && (
              <div className="absolute right-4 top-3 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                Searching...
              </div>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-10 pt-8" style={{ borderTop: '1px solid var(--border-color)' }}>
              <p className="text-lg mb-7 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                Found {searchResults.length} user{searchResults.length !== 1 ? 's' : ''}
              </p>
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between py-5 px-5 rounded-lg mb-4 transition gap-3"
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
                      <button
                        onClick={() => router.push(`/profile/${user.username}`)}
                        className="font-semibold hover:underline text-left"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {user.username}
                      </button>
                      {user.nickname && (
                        <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>{user.nickname}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleSendFriendRequest(user.username)}
                    className="w-full sm:w-auto px-5 py-2.5 text-white text-sm font-medium rounded-md transition"
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
          <div className="rounded-lg p-10" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Friend Requests</h2>
            <p className="mb-10 font-medium text-lg" style={{ color: 'var(--text-secondary)' }}>You have {friendRequests.length} pending request{friendRequests.length !== 1 ? 's' : ''}</p>
            <div className="space-y-5">
              {friendRequests.map((request) => (
                <div
                  key={request.id}
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 rounded-lg transition gap-3"
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
                      <button
                        onClick={() => router.push(`/profile/${request.sender.username}`)}
                        className="font-semibold hover:underline text-left"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {request.sender.nickname || request.sender.username}
                      </button>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>@{request.sender.username}</p>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      onClick={() => handleRespondToRequest(request.id, 'accept')}
                      className="flex-1 sm:flex-none px-5 py-2.5 text-white text-sm font-medium rounded-md transition"
                      style={{ backgroundColor: 'var(--success)' }}
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleRespondToRequest(request.id, 'reject')}
                      className="flex-1 sm:flex-none px-5 py-2.5 text-white text-sm font-medium rounded-md transition"
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
