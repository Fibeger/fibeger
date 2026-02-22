'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import PersonalityTestModal from '../components/PersonalityTestModal';
import FlagEmoji from '../components/FlagEmoji';
import PageLoader from '../components/PageLoader';
import UserAvatar from '../components/UserAvatar';
import personalityTestData from '../lib/personalityTest.json';
import { useBrowserNotifications } from '../hooks/useBrowserNotifications';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithub, faInstagram, faLinkedin, faSteam, faXTwitter } from '@fortawesome/free-brands-svg-icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface UserProfile {
  id: number;
  username: string;
  email: string;
  nickname: string | null;
  bio: string | null;
  avatar: string | null;
  banner: string | null;
  lastUsernameChange: string | null;
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
  notificationSoundsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  steamUsername: string | null;
}

interface SocialLinks {
  twitter?: string;
  github?: string;
  instagram?: string;
  linkedin?: string;
  steam?: string;
}

interface BadgeType {
  id: string;
  name: string;
  emoji: string;
  description: string;
  color: string;
}

const countries = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'ES', name: 'Spain' },
  { code: 'IT', name: 'Italy' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' },
  { code: 'DK', name: 'Denmark' },
  { code: 'FI', name: 'Finland' },
  { code: 'PL', name: 'Poland' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'AR', name: 'Argentina' },
  { code: 'JP', name: 'Japan' },
  { code: 'KR', name: 'South Korea' },
  { code: 'CN', name: 'China' },
  { code: 'IN', name: 'India' },
  { code: 'RU', name: 'Russia' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'IE', name: 'Ireland' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' },
  { code: 'TR', name: 'Turkey' },
  { code: 'SG', name: 'Singapore' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' },
  { code: 'PH', name: 'Philippines' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'EG', name: 'Egypt' },
];

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isSupported: browserNotificationsSupported, permission: browserNotificationPermission, requestPermission } = useBrowserNotifications();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showPersonalityTest, setShowPersonalityTest] = useState(false);

  const [formData, setFormData] = useState({
    nickname: '',
    bio: '',
    newUsername: '',
    country: '',
    city: '',
    pronouns: '',
    birthday: '',
    website: '',
    status: '',
    themeColor: '',
    twitter: '',
    github: '',
    instagram: '',
    linkedin: '',
    interests: [] as string[],
    showPersonalityBadge: true,
    notificationSoundsEnabled: true,
    browserNotificationsEnabled: false,
    steamUsername: '',
  });
  const [newInterest, setNewInterest] = useState('');

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if (status === 'loading' || !session) return;
    fetchProfile();
  }, [status, session, router]);

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const data = await res.json();
        setProfile(data);

        let socialLinks: SocialLinks = {};
        if (data.socialLinks) {
          try { socialLinks = JSON.parse(data.socialLinks); } catch {}
        }

        let interests: string[] = [];
        if (data.interests) {
          try { interests = JSON.parse(data.interests); } catch {}
        }

        setFormData({
          nickname: data.nickname || '',
          bio: data.bio || '',
          newUsername: '',
          country: data.country || '',
          city: data.city || '',
          pronouns: data.pronouns || '',
          birthday: data.birthday || '',
          website: data.website || '',
          status: data.status || '',
          themeColor: data.themeColor || '#8B5CF6',
          twitter: socialLinks.twitter || '',
          github: socialLinks.github || '',
          instagram: socialLinks.instagram || '',
          linkedin: socialLinks.linkedin || '',
          interests,
          showPersonalityBadge: data.showPersonalityBadge ?? true,
          notificationSoundsEnabled: data.notificationSoundsEnabled ?? true,
          browserNotificationsEnabled: data.browserNotificationsEnabled ?? false,
          steamUsername: data.steamUsername || '',
        });
      }
    } catch {
      showMessage('Failed to load profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const socialLinks: SocialLinks = {
        twitter: formData.twitter || undefined,
        github: formData.github || undefined,
        instagram: formData.instagram || undefined,
        linkedin: formData.linkedin || undefined,
      };

      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: formData.nickname,
          bio: formData.bio,
          country: formData.country,
          city: formData.city,
          pronouns: formData.pronouns,
          birthday: formData.birthday,
          website: formData.website,
          status: formData.status,
          themeColor: formData.themeColor,
          socialLinks: JSON.stringify(socialLinks),
          interests: JSON.stringify(formData.interests),
          showPersonalityBadge: formData.showPersonalityBadge,
          notificationSoundsEnabled: formData.notificationSoundsEnabled,
          browserNotificationsEnabled: formData.browserNotificationsEnabled,
          steamUsername: formData.steamUsername,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        showMessage('Profile updated successfully', 'success');
        setEditing(false);
      } else {
        showMessage('Failed to update profile', 'error');
      }
    } catch {
      showMessage('Error updating profile', 'error');
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) { showMessage('File size must be less than 5MB', 'error'); return; }
    if (!file.type.startsWith('image/')) { showMessage('Please upload an image file', 'error'); return; }

    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await fetch('/api/profile/avatar', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        showMessage('Profile picture updated successfully', 'success');
      } else {
        const error = await res.json();
        showMessage(error.error || 'Failed to upload image', 'error');
      }
    } catch {
      showMessage('Error uploading image', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { showMessage('Banner size must be less than 10MB', 'error'); return; }
    if (!file.type.startsWith('image/')) { showMessage('Please upload an image file', 'error'); return; }

    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append('banner', file);
      const res = await fetch('/api/profile/banner', { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        showMessage('Banner updated successfully', 'success');
      } else {
        const error = await res.json();
        showMessage(error.error || 'Failed to upload banner', 'error');
      }
    } catch {
      showMessage('Error uploading banner', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleBannerRemove = async () => {
    if (!confirm('Are you sure you want to remove your banner?')) return;
    try {
      const res = await fetch('/api/profile/banner', { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        showMessage('Banner removed successfully', 'success');
      } else {
        showMessage('Failed to remove banner', 'error');
      }
    } catch {
      showMessage('Error removing banner', 'error');
    }
  };

  const handleUsernameChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.newUsername.trim()) { showMessage('New username is required', 'error'); return; }

    try {
      const res = await fetch('/api/profile/username', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newUsername: formData.newUsername }),
      });

      if (res.ok) {
        const data = await res.json();
        setProfile(data.user);
        setFormData({ ...formData, newUsername: '' });
        showMessage('Username changed successfully', 'success');
      } else {
        const error = await res.json();
        showMessage(error.error || 'Failed to change username', 'error');
      }
    } catch {
      showMessage('Error changing username', 'error');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== profile?.username) {
      showMessage('Username does not match. Please try again.', 'error');
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch('/api/profile/delete', { method: 'DELETE' });
      if (res.ok) {
        await signOut({ redirect: false });
        router.push('/auth/login');
      } else {
        const error = await res.json();
        showMessage(error.error || 'Failed to delete account', 'error');
        setDeleting(false);
      }
    } catch {
      showMessage('Error deleting account', 'error');
      setDeleting(false);
    }
  };

  const addInterest = () => {
    if (newInterest.trim() && formData.interests.length < 10 && !formData.interests.includes(newInterest.trim())) {
      setFormData({ ...formData, interests: [...formData.interests, newInterest.trim()] });
      setNewInterest('');
    }
  };

  const removeInterest = (interest: string) => {
    setFormData({ ...formData, interests: formData.interests.filter((i) => i !== interest) });
  };

  const handlePersonalityTestComplete = (badge: BadgeType) => {
    setProfile((prev) => prev ? { ...prev, personalityBadge: badge.id } : null);
    showMessage(`You are ${badge.name}! Badge saved to your profile.`, 'success');
  };

  const getUserBadge = () => {
    if (!profile?.personalityBadge) return null;
    return personalityTestData.badges.find((b) => b.id === profile.personalityBadge);
  };

  if (status === 'loading' || loading) return <PageLoader message="Loading profile..." />;

  const canChangeUsername =
    !profile?.lastUsernameChange ||
    new Date(profile.lastUsernameChange).getTime() + 7 * 24 * 60 * 60 * 1000 < Date.now();

  const accentColor = profile?.themeColor || 'var(--accent)';

  return (
    <div className="min-h-screen py-12 px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-4xl mx-auto space-y-6">
        {message && (
          <Alert variant={messageType === 'error' ? 'destructive' : 'default'}>
            <AlertDescription className="font-semibold">{message}</AlertDescription>
          </Alert>
        )}

        {profile && (
          <>
            {/* Profile Header Card */}
            <Card className="overflow-hidden">
              {/* Banner */}
              <div className="relative w-full h-48 sm:h-64" style={{ backgroundColor: 'var(--bg-primary)' }}>
                {profile.banner ? (
                  <>
                    <img src={profile.banner} alt="Profile banner" className="w-full h-full object-cover" />
                    <div className="absolute top-4 right-4 flex gap-2">
                      <label className="px-4 py-2 text-white rounded-md cursor-pointer transition font-medium text-sm" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
                        <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploadingAvatar} className="hidden" />
                        Change Banner
                      </label>
                      <button onClick={handleBannerRemove} className="px-4 py-2 text-white rounded-md transition font-medium text-sm" style={{ backgroundColor: 'rgba(220,38,38,0.8)' }}>
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <label className="w-full h-full flex items-center justify-center cursor-pointer hover:opacity-80 transition">
                    <input type="file" accept="image/*" onChange={handleBannerUpload} disabled={uploadingAvatar} className="hidden" />
                    <div className="text-center">
                      <div className="text-4xl mb-2"><span className="material-symbols-outlined">panorama</span></div>
                      <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>Click to add a banner</p>
                    </div>
                  </label>
                )}
              </div>

              <CardContent className="p-8 sm:p-10">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8">
                  {/* Avatar */}
                  <div className="flex-shrink-0" style={{ marginTop: profile.banner ? '-5rem' : '0' }}>
                    <div className="relative group">
                      <UserAvatar
                        src={profile.avatar}
                        username={profile.username}
                        size="2xl"
                        className="border-4"
                        themeColor={profile.themeColor}
                        style={{ borderColor: accentColor }}
                      />
                      <label className="absolute bottom-0 right-0 text-white p-3 rounded-full cursor-pointer transition" style={{ backgroundColor: accentColor }}>
                        <input type="file" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} className="hidden" />
                        <span className="material-symbols-outlined">photo_camera_front</span>
                      </label>
                    </div>
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
                      {profile.pronouns && (
                        <Badge variant="secondary">{profile.pronouns}</Badge>
                      )}
                    </div>
                    {profile.status && (
                      <p className="mt-2 text-base font-medium italic" style={{ color: accentColor }}>"{profile.status}"</p>
                    )}
                    <p className="mt-3 text-base" style={{ color: 'var(--text-secondary)' }}>{profile.bio || 'No bio yet'}</p>

                    <div className="flex items-center gap-4 mt-4 flex-wrap text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>
                      {profile.city && (
                        <div className="flex items-center gap-1"><span className="material-symbols-outlined">location_on</span><span>{profile.city}</span></div>
                      )}
                      {profile.birthday && (
                        <div className="flex items-center gap-1"><span className="material-symbols-outlined">cake</span><span>{profile.birthday}</span></div>
                      )}
                      {profile.website && (
                        <a href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:underline" style={{ color: accentColor }}>
                          <span className="material-symbols-outlined">link_2</span><span>{profile.website}</span>
                        </a>
                      )}
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

                  <div className="w-full sm:w-auto flex flex-col gap-3">
                    {editing ? (
                      <Button variant="destructive" onClick={() => setEditing(false)}>Cancel</Button>
                    ) : (
                      <>
                        <Button onClick={() => setEditing(true)} style={{ backgroundColor: accentColor }}>
                          Edit Profile
                        </Button>
                        <Button
                          onClick={() => setShowPersonalityTest(true)}
                          style={{ backgroundColor: profile.personalityBadge ? 'var(--text-tertiary)' : accentColor }}
                        >
                          <span className="material-symbols-outlined mr-2">{profile.personalityBadge ? 'refresh' : 'local_fire_department'}</span>
                          {profile.personalityBadge ? 'Retake Test' : 'Take PEAS Test'}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Edit Profile Form */}
            {editing && (
              <Card>
                <CardHeader>
                  <CardTitle>Edit Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUpdate} className="space-y-8">
                    {/* Basic Information */}
                    <div className="space-y-5">
                      <h3 className="text-lg font-semibold">Basic Information</h3>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Display Name</Label>
                          <span className="text-xs" style={{ color: formData.nickname.length > 25 ? 'var(--danger)' : 'var(--text-tertiary)' }}>{formData.nickname.length}/25</span>
                        </div>
                        <Input value={formData.nickname} onChange={(e) => setFormData({ ...formData, nickname: e.target.value })} placeholder="Your display name" maxLength={25} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Bio</Label>
                          <span className="text-xs" style={{ color: formData.bio.length > 355 ? 'var(--danger)' : 'var(--text-tertiary)' }}>{formData.bio.length}/355</span>
                        </div>
                        <Textarea value={formData.bio} onChange={(e) => setFormData({ ...formData, bio: e.target.value })} placeholder="Tell us about yourself..." maxLength={355} rows={4} />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <Label>Status Message</Label>
                          <span className="text-xs" style={{ color: formData.status.length > 100 ? 'var(--danger)' : 'var(--text-tertiary)' }}>{formData.status.length}/100</span>
                        </div>
                        <Input value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} placeholder="What's on your mind?" maxLength={100} />
                      </div>

                      <div className="space-y-2">
                        <Label>Pronouns</Label>
                        <Input value={formData.pronouns} onChange={(e) => setFormData({ ...formData, pronouns: e.target.value })} placeholder="e.g., he/him, she/her, they/them" maxLength={50} />
                      </div>
                    </div>

                    <Separator />

                    {/* Location */}
                    <div className="space-y-5">
                      <h3 className="text-lg font-semibold">Location</h3>

                      <div className="space-y-2">
                        <Label>Country</Label>
                        <Select value={formData.country || 'none'} onValueChange={(v) => setFormData({ ...formData, country: v === 'none' ? '' : v })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a country" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select a country</SelectItem>
                            {countries.map((country) => (
                              <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {formData.country && (
                          <div className="mt-2 flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                            <FlagEmoji countryCode={formData.country} className="text-2xl" />
                            <span>{countries.find(c => c.code === formData.country)?.name}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} placeholder="Your city" maxLength={100} />
                      </div>

                      <div className="space-y-2">
                        <Label>Birthday (MM-DD)</Label>
                        <Input value={formData.birthday} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} placeholder="e.g., 05-15" maxLength={5} pattern="\d{2}-\d{2}" />
                        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Format: MM-DD (Year not required for privacy)</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Links & Socials */}
                    <div className="space-y-5">
                      <h3 className="text-lg font-semibold">Links & Socials</h3>

                      <div className="space-y-2">
                        <Label>Website</Label>
                        <Input type="url" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://yourwebsite.com" maxLength={200} />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { key: 'twitter', icon: faXTwitter, label: 'Twitter Username' },
                          { key: 'github', icon: faGithub, label: 'GitHub Username' },
                          { key: 'instagram', icon: faInstagram, label: 'Instagram Username' },
                          { key: 'linkedin', icon: faLinkedin, label: 'LinkedIn Username' },
                        ].map(({ key, icon, label }) => (
                          <div key={key} className="space-y-2">
                            <Label><FontAwesomeIcon icon={icon} inverse /> <span className="ml-2">{label}</span></Label>
                            <Input value={(formData as any)[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.value })} placeholder="username" />
                          </div>
                        ))}
                        <div className="space-y-2">
                          <Label><FontAwesomeIcon icon={faSteam} inverse /> <span className="ml-2">Steam Username</span></Label>
                          <Input value={formData.steamUsername} onChange={(e) => setFormData({ ...formData, steamUsername: e.target.value })} placeholder="username" maxLength={100} />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Customization */}
                    <div className="space-y-5">
                      <h3 className="text-lg font-semibold">Customization</h3>

                      <div className="space-y-2">
                        <Label>Theme Color</Label>
                        <div className="flex items-center gap-4">
                          <input type="color" value={formData.themeColor} onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })} className="h-12 w-20 rounded-md cursor-pointer" />
                          <Input value={formData.themeColor} onChange={(e) => setFormData({ ...formData, themeColor: e.target.value })} placeholder="#8B5CF6" className="flex-1" />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Interests & Hobbies (max 10)</Label>
                        <div className="flex gap-2 mb-3">
                          <Input value={newInterest} onChange={(e) => setNewInterest(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInterest(); } }} placeholder="Add an interest..." maxLength={20} />
                          <Button type="button" onClick={addInterest} disabled={formData.interests.length >= 10} style={{ backgroundColor: formData.themeColor }}>
                            Add
                          </Button>
                        </div>
                        {formData.interests.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {formData.interests.map((interest, idx) => (
                              <Badge key={idx} style={{ backgroundColor: formData.themeColor, color: '#fff' }} className="gap-1">
                                {interest}
                                <button type="button" onClick={() => removeInterest(interest)} className="hover:opacity-70 ml-1">✕</button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Privacy & Preferences */}
                    <div className="space-y-5">
                      <h3 className="text-lg font-semibold">Privacy & Preferences</h3>

                      {[
                        {
                          id: 'notification-sounds',
                          icon: 'notifications',
                          label: 'Notification Sounds',
                          desc: 'Play a sound when you receive new messages or notifications',
                          checked: formData.notificationSoundsEnabled,
                          onChange: (v: boolean) => setFormData({ ...formData, notificationSoundsEnabled: v }),
                          disabled: false,
                        },
                        {
                          id: 'browser-notifications',
                          icon: 'desktop_windows',
                          label: 'Browser Notifications',
                          desc: browserNotificationsSupported ? 'Show native notifications even when the tab is not focused' : 'Not supported in your browser',
                          checked: formData.browserNotificationsEnabled && browserNotificationsSupported,
                          onChange: async (v: boolean) => {
                            if (!browserNotificationsSupported) return;
                            if (v && browserNotificationPermission !== 'granted') {
                              const result = await requestPermission();
                              if (result !== 'granted') return;
                            }
                            setFormData({ ...formData, browserNotificationsEnabled: v });
                          },
                          disabled: !browserNotificationsSupported || browserNotificationPermission === 'denied',
                        },
                        {
                          id: 'show-badge',
                          icon: 'trophy',
                          label: 'Show Personality Badge',
                          desc: 'Display your personality quiz badge on your profile',
                          checked: formData.showPersonalityBadge,
                          onChange: (v: boolean) => setFormData({ ...formData, showPersonalityBadge: v }),
                          disabled: false,
                        },
                      ].map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-5 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)' }}>
                          <div className="flex-1">
                            <Label htmlFor={item.id} className="flex items-center gap-2 cursor-pointer font-medium text-base">
                              <span className="material-symbols-outlined">{item.icon}</span>
                              {item.label}
                            </Label>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{item.desc}</p>
                            {item.id === 'browser-notifications' && browserNotificationsSupported && browserNotificationPermission === 'denied' && (
                              <p className="text-xs mt-2 font-semibold" style={{ color: 'var(--danger)' }}>Permission denied. Please enable in your browser settings.</p>
                            )}
                          </div>
                          <Switch id={item.id} checked={item.checked} onCheckedChange={item.onChange} disabled={item.disabled} />
                        </div>
                      ))}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-2">
                      <Button type="submit" className="flex-1 app-btn-success">Save Changes</Button>
                      <Button type="button" variant="destructive" className="flex-1" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Change Username */}
            <Card>
              <CardHeader>
                <CardTitle>Change Username</CardTitle>
                <p className="text-sm font-medium" style={{ color: 'var(--text-tertiary)' }}>You can change your username once every 7 days.</p>
              </CardHeader>
              <CardContent>
                {!canChangeUsername && profile.lastUsernameChange && (
                  <Alert className="mb-6">
                    <AlertDescription className="font-semibold">
                      Available in {Math.ceil((new Date(profile.lastUsernameChange).getTime() + 7 * 24 * 60 * 60 * 1000 - Date.now()) / (24 * 60 * 60 * 1000))} day(s)
                    </AlertDescription>
                  </Alert>
                )}
                <form onSubmit={handleUsernameChange} className="space-y-4">
                  <Input placeholder="New username" value={formData.newUsername} onChange={(e) => setFormData({ ...formData, newUsername: e.target.value })} disabled={!canChangeUsername} />
                  <Button type="submit" disabled={!canChangeUsername} className="w-full" style={{ backgroundColor: canChangeUsername ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                    {canChangeUsername ? 'Change Username' : 'Cooldown Active'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card style={{ borderColor: 'var(--danger)', borderWidth: '2px' }}>
              <CardHeader>
                <CardTitle style={{ color: 'var(--danger)' }}>Danger Zone</CardTitle>
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Once you delete your account, there is no going back. All your data, messages, and connections will be permanently deleted.
                </p>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
                  Delete My Account
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* Delete Account Dialog */}
        <Dialog open={showDeleteConfirm} onOpenChange={(open) => { if (!deleting) { setShowDeleteConfirm(open); if (!open) setDeleteConfirmText(''); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle style={{ color: 'var(--danger)' }}>Delete Account</DialogTitle>
            </DialogHeader>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              This action cannot be undone. This will permanently delete your account, all your messages, friendships, and remove you from all group chats.
            </p>
            <p className="text-sm font-semibold mt-4">
              Please type{' '}
              <span className="font-mono px-2 py-1 rounded text-sm" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--accent)' }}>
                {profile?.username}
              </span>{' '}
              to confirm:
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="Enter your username"
              disabled={deleting}
              className="mt-2"
            />
            <DialogFooter className="gap-3">
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== profile?.username}
              >
                {deleting ? 'Deleting...' : 'Delete Account'}
              </Button>
              <Button variant="secondary" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }} disabled={deleting}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Personality Test Modal */}
        <PersonalityTestModal
          isOpen={showPersonalityTest}
          onClose={() => setShowPersonalityTest(false)}
          onComplete={handlePersonalityTestComplete}
          themeColor={profile?.themeColor || '#8B5CF6'}
        />
      </div>
    </div>
  );
}
