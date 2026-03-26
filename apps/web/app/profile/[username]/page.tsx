'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import FlagEmoji from '@/app/components/FlagEmoji';
import PageLoader from '@/app/components/PageLoader';
import UserAvatar from '@/app/components/UserAvatar';
import personalityTestData from '@/app/lib/personalityTest.json';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faInstagram, faSteam, faXTwitter, faDiscord, faYoutube, faTwitch } from '@fortawesome/free-brands-svg-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface UserProfile {
  id: number;
  username: string;
  nickname: string | null;
  bio: string | null;
  avatar: string | null;
  banner: string | null;
  createdAt: string;
  isFriend: boolean;
  isOwnProfile: boolean;
  country: string | null;
  city: string | null;
  pronouns: string | null;
  birthday: string | null;
  website: string | null;
  socialLinks: string | null;
  status: string | null;
  themeColor: string | null;
  interests: string | null;
  personalityBadge: string | null;
  showPersonalityBadge: boolean;
  steamUsername: string | null;
}

interface SocialLinks {
  twitter?: string;
  github?: string;
  instagram?: string;
  discord?: string;
  youtube?: string;
  twitch?: string;
}

interface FeedPost {
  id: number;
  userId: number;
  caption: string | null;
  mediaUrl: string;
  mediaType: string;
  isPublic: boolean;
  createdAt: string;
  user: { id: number; username: string; nickname: string | null; avatar: string | null };
  likes: { userId: number }[];
  _count: { likes: number };
}

interface UserPreview {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
  themeColor: string | null;
}

const countries = [
  { code: 'US', name: 'United States' }, { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' }, { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' }, { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' }, { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' }, { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' }, { code: 'PL', name: 'Poland' },
  { code: 'BR', name: 'Brazil' }, { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' }, { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' }, { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' }, { code: 'RU', name: 'Russia' },
  { code: 'ZA', name: 'South Africa' }, { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' }, { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' }, { code: 'BE', name: 'Belgium' },
  { code: 'PT', name: 'Portugal' }, { code: 'GR', name: 'Greece' },
  { code: 'TR', name: 'Turkey' }, { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' }, { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' }, { code: 'PH', name: 'Philippines' },
  { code: 'ID', name: 'Indonesia' }, { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' }, { code: 'EG', name: 'Egypt' },
];

export default function UserProfilePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const params = useParams();
  const username = params?.username as string;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [profileFeed, setProfileFeed] = useState<FeedPost[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [profileFriends, setProfileFriends] = useState<UserPreview[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [selectedFeedPost, setSelectedFeedPost] = useState<FeedPost | null>(null);

  const currentUserId = parseInt((session?.user as { id?: string })?.id || '0');

  const getUserBadge = () => {
    if (!profile?.personalityBadge) return null;
    return personalityTestData.badges.find((b) => b.id === profile.personalityBadge);
  };

  useEffect(() => {
    if (!session) {
      router.push('/auth/login');
      return;
    }
    if (username) fetchProfile();
  }, [session, username, router]);

  const fetchProfile = async () => {
    try {
      const res = await fetch(`/api/profile/${username}`);
      if (res.ok) {
        const data = await res.json();
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
    } catch {
      setMessage('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.id) return;
    fetchProfileFeed(profile.id);
    fetchProfileFriends(profile.username);
  }, [profile?.id]);

  const fetchProfileFeed = async (userId: number) => {
    setFeedLoading(true);
    try {
      const res = await fetch(`/api/feed?userId=${userId}`);
      if (res.ok) setProfileFeed(await res.json());
    } catch { /* silent */ } finally {
      setFeedLoading(false);
    }
  };

  const fetchProfileFriends = async (uname: string) => {
    setFriendsLoading(true);
    try {
      const res = await fetch(`/api/profile/${uname}/friends`);
      if (res.ok) setProfileFriends(await res.json());
    } catch { /* silent */ } finally {
      setFriendsLoading(false);
    }
  };

  const handleFeedLike = async (postId: number) => {
    try {
      const res = await fetch(`/api/feed/${postId}/like`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setProfileFeed((prev) => prev.map((p) => p.id === postId ? { ...p, likes: updated.likes, _count: updated._count } : p));
        if (selectedFeedPost?.id === postId) setSelectedFeedPost({ ...selectedFeedPost, likes: updated.likes, _count: updated._count });
      }
    } catch { /* silent */ }
  };

  const handleSendMessage = async () => {
    if (!profile) return;
    try {
      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendId: profile.id }),
      });
      if (res.ok) {
        const conversation = await res.json();
        router.push(`/messages?dm=${conversation.id}`);
      } else {
        const error = await res.json();
        setMessage(error.error || 'Failed to open conversation');
        setTimeout(() => setMessage(''), 3000);
      }
    } catch {
      setMessage('Error opening conversation');
      setTimeout(() => setMessage(''), 3000);
    }
  };

  if (loading) return <PageLoader message="Loading profile..." />;

  if (message && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <p className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-secondary)' }}>{message}</p>
          <Button onClick={() => router.back()}>Go Back</Button>
        </div>
      </div>
    );
  }

  const accentColor = profile?.themeColor || 'var(--accent)';

  return (
    <div className="min-h-screen py-6 sm:py-12 px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}

        {profile && (
          <>
            <Card className="overflow-hidden">
              {/* Banner */}
              {profile.banner ? (
                <div className="relative w-full h-48 sm:h-64">
                  <img src={profile.banner} alt="Profile banner" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-full h-32 sm:h-48" style={{ backgroundColor: 'var(--bg-primary)' }} />
              )}

              <CardContent className="p-6 sm:p-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
                  {/* Avatar */}
                  <div className="flex-shrink-0" style={{ marginTop: '-5rem' }}>
                    <UserAvatar
                      src={profile.avatar}
                      username={profile.username}
                      size="2xl"
                      className="border-4"
                      themeColor={profile.themeColor}
                      style={{ borderColor: accentColor }}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h1 className="text-3xl sm:text-4xl font-bold">{profile.nickname || profile.username}</h1>
                      {profile.country && (
                        <FlagEmoji countryCode={profile.country} className="text-3xl" title={countries.find(c => c.code === profile.country)?.name} />
                      )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <p className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>@{profile.username}</p>
                      {profile.pronouns && <Badge variant="secondary">{profile.pronouns}</Badge>}
                      {profile.isFriend && (
                        <Badge className="app-btn-success">✓ Friends</Badge>
                      )}
                    </div>

                    {profile.status && (
                      <p className="mt-2 text-base font-medium italic" style={{ color: accentColor }}>"{profile.status}"</p>
                    )}

                    <p className="mt-3 text-base" style={{ color: 'var(--text-secondary)' }}>{profile.bio || 'No bio yet'}</p>

                    <div className="flex items-center gap-4 mt-4 flex-wrap text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {profile.city && <div className="flex items-center gap-1"><span className="material-symbols-outlined">location_on</span><span>{profile.city}</span></div>}
                      {profile.birthday && <div className="flex items-center gap-1"><span className="material-symbols-outlined">cake</span><span>{profile.birthday}</span></div>}
                      {profile.website && (
                        <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: accentColor }}>
                          <span className="material-symbols-outlined">link_2</span><span>{profile.website}</span>
                        </a>
                      )}
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined">calendar_month</span>
                        <span>Joined {new Date(profile.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    {/* Social Links */}
                    {(profile.socialLinks || profile.steamUsername) && (() => {
                      try {
                        const links = JSON.parse(profile.socialLinks || '{}') as SocialLinks;
                        const hasLinks = Object.values(links).some(v => v) || profile.steamUsername;
                        if (hasLinks) {
                          return (
                            <div className="flex items-center gap-4 mt-4">
                              {links.twitter && <a href={`https://twitter.com/${links.twitter}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition"><FontAwesomeIcon icon={faXTwitter} inverse /></a>}
                              {links.github && <a href={`https://github.com/${links.github}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition"><FontAwesomeIcon icon={faGithub} inverse /></a>}
                              {links.instagram && <a href={`https://instagram.com/${links.instagram}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition"><FontAwesomeIcon icon={faInstagram} inverse /></a>}
                              {links.discord && <a href={`https://discord.com/users/${links.discord}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition"><FontAwesomeIcon icon={faDiscord} inverse /></a>}
                              {links.youtube && <a href={`https://youtube.com/@${links.youtube}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition"><FontAwesomeIcon icon={faYoutube} inverse /></a>}
                              {links.twitch && <a href={`https://twitch.tv/${links.twitch}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition"><FontAwesomeIcon icon={faTwitch} inverse /></a>}
                              {profile.steamUsername && <a href={`https://steamcommunity.com/id/${profile.steamUsername}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition"><FontAwesomeIcon icon={faSteam} inverse /></a>}
                            </div>
                          );
                        }
                      } catch {}
                      return null;
                    })()}

                    {/* Interests */}
                    {profile.interests && (() => {
                      try {
                        const interests = JSON.parse(profile.interests) as string[];
                        if (interests.length > 0) {
                          return (
                            <div className="flex flex-wrap gap-2 mt-4">
                              {interests.map((interest, idx) => (
                                <Badge key={idx} style={{ backgroundColor: accentColor, color: '#fff' }}>{interest}</Badge>
                              ))}
                            </div>
                          );
                        }
                      } catch {}
                      return null;
                    })()}

                  </div>

                  {profile.isFriend && (
                    <div className="flex flex-col gap-3 w-full sm:w-auto">
                      <Button onClick={handleSendMessage} style={{ backgroundColor: accentColor }}>
                        Send Message
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {!profile.isFriend && (
              <Card>
                <CardContent className="p-6 sm:p-10 text-center">
                  <p className="text-lg font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Add {profile.nickname || profile.username} as a friend to interact with them!
                  </p>
                  <Button className="mt-6" onClick={() => router.push('/friends')}>
                    Go to Friends
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Badges Section */}
            {(() => {
              const badge = getUserBadge();
              if (!badge || !profile.showPersonalityBadge) return null;
              return (
                <Card>
                  <CardHeader>
                    <CardTitle>Badges</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-4">
                      <div className="px-5 py-4 rounded-xl flex items-center gap-4" style={{ backgroundColor: `${badge.color}18`, border: `2px solid ${badge.color}40` }}>
                        <span className="text-4xl">{badge.emoji}</span>
                        <div>
                          <p className="font-bold text-base" style={{ color: badge.color }}>{badge.name}</p>
                          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{badge.description}</p>
                          <p className="text-xs mt-1 font-medium" style={{ color: 'var(--text-tertiary)' }}>PEAS Personality Badge</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Feed Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="material-symbols-outlined">camera</span>
                  Posts
                  {!feedLoading && <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>({profileFeed.length})</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {feedLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="material-symbols-outlined animate-spin" style={{ color: 'var(--text-tertiary)' }}>progress_activity</span>
                  </div>
                ) : profileFeed.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl mb-2 block" style={{ color: 'var(--text-tertiary)' }}>camera_alt</span>
                    <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No posts yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                    {profileFeed.slice(0, 15).map((post) => (
                      <button
                        key={post.id}
                        onClick={() => setSelectedFeedPost(post)}
                        className="relative aspect-square overflow-hidden rounded-lg group"
                        style={{ backgroundColor: 'var(--bg-primary)' }}
                      >
                        {post.mediaType === 'video' ? (
                          <video src={post.mediaUrl} className="w-full h-full object-cover" />
                        ) : (
                          <img src={post.mediaUrl} alt={post.caption || 'Post'} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <div className="flex items-center gap-1 text-white text-sm font-semibold">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
                            {post._count.likes}
                          </div>
                        </div>
                        {post.mediaType === 'video' && (
                          <div className="absolute top-1.5 right-1.5 text-white">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Friends Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="material-symbols-outlined">group</span>
                  Friends
                  {!friendsLoading && <span className="text-sm font-normal ml-1" style={{ color: 'var(--text-tertiary)' }}>({profileFriends.length})</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {friendsLoading ? (
                  <div className="flex justify-center py-8">
                    <span className="material-symbols-outlined animate-spin" style={{ color: 'var(--text-tertiary)' }}>progress_activity</span>
                  </div>
                ) : profileFriends.length === 0 ? (
                  <div className="text-center py-8">
                    <span className="material-symbols-outlined text-4xl mb-2 block" style={{ color: 'var(--text-tertiary)' }}>person_add</span>
                    <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No friends yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {profileFriends.map((friend) => (
                      <Link key={friend.id} href={`/profile/${friend.username}`} className="group flex flex-col items-center gap-2 text-center">
                        <div className="transition-transform group-hover:scale-105">
                          <UserAvatar
                            src={friend.avatar}
                            username={friend.username}
                            size="lg"
                            themeColor={friend.themeColor}
                          />
                        </div>
                        <span className="text-xs font-medium truncate w-full text-center" style={{ color: 'var(--text-secondary)' }}>
                          {friend.nickname || friend.username}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Feed Post Detail Dialog */}
            <Dialog open={!!selectedFeedPost} onOpenChange={(open) => !open && setSelectedFeedPost(null)}>
              <DialogContent className="max-w-2xl p-0 overflow-hidden">
                {selectedFeedPost && (
                  <div className="flex flex-col">
                    <div className="bg-black flex items-center justify-center max-h-[60vh]">
                      {selectedFeedPost.mediaType === 'video' ? (
                        <video src={selectedFeedPost.mediaUrl} className="max-h-[60vh] w-full object-contain" controls autoPlay />
                      ) : (
                        <img src={selectedFeedPost.mediaUrl} alt={selectedFeedPost.caption || 'Post'} className="max-h-[60vh] w-full object-contain" />
                      )}
                    </div>
                    <div className="p-5">
                      {selectedFeedPost.caption && (
                        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>{selectedFeedPost.caption}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleFeedLike(selectedFeedPost.id)}
                          className="flex items-center gap-2 transition hover:brightness-125"
                          style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                        >
                          <svg width="22" height="22" viewBox="0 0 24 24"
                            fill={selectedFeedPost.likes.some(l => l.userId === currentUserId) ? '#f23f42' : 'none'}
                            stroke={selectedFeedPost.likes.some(l => l.userId === currentUserId) ? '#f23f42' : 'var(--text-tertiary)'}
                            strokeWidth="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                          <span className="text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }}>{selectedFeedPost._count.likes}</span>
                        </button>
                        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{new Date(selectedFeedPost.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>
    </div>
  );
}
