'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import FlagEmoji from '@/app/components/FlagEmoji';
import PageLoader from '@/app/components/PageLoader';
import UserAvatar from '@/app/components/UserAvatar';
import personalityTestData from '@/app/lib/personalityTest.json';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faInstagram, faLinkedin, faSteam, faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
  linkedin?: string;
  steam?: string;
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
                              {links.linkedin && <a href={`https://linkedin.com/in/${links.linkedin}`} target="_blank" rel="noopener noreferrer" className="text-2xl hover:opacity-70 transition"><FontAwesomeIcon icon={faLinkedin} inverse /></a>}
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

                    {/* Personality Badge */}
                    {(() => {
                      const badge = getUserBadge();
                      if (badge && profile.showPersonalityBadge) {
                        return (
                          <div className="mt-4 px-4 py-3 rounded-lg inline-flex items-center gap-3" style={{ backgroundColor: `${badge.color}20`, border: `2px solid ${badge.color}` }}>
                            <span className="text-3xl">{badge.emoji}</span>
                            <div>
                              <p className="font-bold text-sm" style={{ color: badge.color }}>{badge.name}</p>
                              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{badge.description}</p>
                            </div>
                          </div>
                        );
                      }
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
          </>
        )}
      </div>
    </div>
  );
}
