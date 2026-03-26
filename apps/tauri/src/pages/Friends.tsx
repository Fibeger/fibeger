import { useState, useEffect } from "react";
import { friendsApi, type User } from "@fibeger/api-client";

export default function FriendsPage() {
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    friendsApi.getFriends().then((data) => {
      setFriends(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Friends</h2>
      {friends.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)' }}>No friends yet. Search for users to add!</p>
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => (
            <div key={friend.id} className="flex items-center gap-3 rounded-lg p-3" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
                {friend.avatar ? (
                  <img src={friend.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <span className="text-white font-medium">{friend.username[0].toUpperCase()}</span>
                )}
              </div>
              <div>
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{friend.nickname || friend.username}</p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>@{friend.username}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
