'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';

interface UserProfile {
  id: number;
  username: string;
  nickname: string | null;
  bio: string | null;
  avatar: string | null;
  createdAt: string;
  isFriend: boolean;
  isOwnProfile: boolean;
}

export default function UserProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const username = params?.username as string;
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }

    if (username) {
      fetchProfile();
    }
  }, [session, username, router]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/profile/${username}`);
      if (res.ok) {
        const data = await res.json();
        
        // If it's the user's own profile, redirect to the main profile page
        if (data.isOwnProfile) {
          router.push('/profile');
          return;
        }
        
        setProfile(data);
      } else if (res.status === 404) {
        setMessage('User not found');
      } else {
        setMessage('Failed to load profile');
      }
    } catch (error) {
      setMessage('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = () => {
    // Navigate to messages page - the user can start a conversation there
    router.push('/messages');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div 
            className="inline-block animate-spin rounded-full h-12 w-12 border-4" 
            style={{ borderColor: 'var(--accent)', borderTopColor: 'var(--text-primary)' }}
          ></div>
          <p className="mt-6 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Loading profile...
          </p>
        </div>
      </div>
    );
  }

  if (message && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-2xl font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {message}
          </p>
          <button
            onClick={() => router.back()}
            className="mt-6 px-6 py-3 text-white rounded-md transition font-medium"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {message && (
          <div 
            className={`mb-8 p-5 rounded-lg font-semibold transition-all`}
            style={{
              backgroundColor: message.includes('✓') ? 'var(--success)' : 'var(--accent)',
              color: '#ffffff',
            }}
          >
            {message}
          </div>
        )}

        {profile && (
          <div className="space-y-6">
            {/* Profile Header */}
            <div 
              className="rounded-lg p-10"
              style={{
                backgroundColor: 'var(--bg-secondary)',
              }}
            >
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
                {/* Avatar Section */}
                <div className="flex-shrink-0">
                  {profile.avatar ? (
                    <img
                      src={profile.avatar}
                      alt={profile.username}
                      className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover border-4"
                      style={{ borderColor: 'var(--accent)' }}
                    />
                  ) : (
                    <div 
                      className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-white text-5xl font-bold" 
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {profile.username.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* User Info */}
                <div className="flex-1">
                  <h1 className="text-3xl sm:text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
                    {profile.nickname || profile.username}
                  </h1>
                  <p className="text-lg mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>
                    @{profile.username}
                  </p>
                  <p className="mt-3 text-base" style={{ color: 'var(--text-secondary)' }}>
                    {profile.bio || 'No bio yet'}
                  </p>
                  <p className="text-sm mt-4 font-medium" style={{ color: 'var(--text-tertiary)' }}>
                    Member since {new Date(profile.createdAt).toLocaleDateString()}
                  </p>
                  
                  {profile.isFriend && (
                    <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ backgroundColor: 'var(--success)', color: 'white' }}>
                      <span className="font-semibold">✓ Friends</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {profile.isFriend && (
                  <div className="flex flex-col gap-3">
                    <button
                      onClick={handleSendMessage}
                      className="px-8 py-3 text-white rounded-md transition font-medium"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      Send Message
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Info */}
            {!profile.isFriend && (
              <div 
                className="rounded-lg p-10 text-center"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <p className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Add {profile.nickname || profile.username} as a friend to interact with them!
                </p>
                <button
                  onClick={() => router.push('/friends')}
                  className="mt-6 px-8 py-3 text-white rounded-md transition font-medium"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  Go to Friends
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
