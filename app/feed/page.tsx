"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

export default function FeedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push("/auth/login");
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4" style={{ borderColor: 'var(--accent)', borderTopColor: 'var(--text-primary)' }}></div>
          <p className="mt-6 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-4 sm:px-6 py-12">
        {/* Welcome Card */}
        <div className="mb-8">
          <div className="rounded-lg p-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <h2 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Welcome back, {(session?.user as any)?.username}
            </h2>
            <p className="mb-8 font-medium" style={{ color: 'var(--text-secondary)' }}>
              Stay connected with your friends and explore your feed.
            </p>
            <div className="flex gap-4 flex-wrap">
              <Link href="/profile" className="inline-flex items-center px-8 py-3 text-white font-medium rounded-md transition" style={{ backgroundColor: 'var(--accent)' }}>
                View Profile
              </Link>
              <Link href="/messages" className="inline-flex items-center px-8 py-3 text-white font-medium rounded-md transition" style={{ backgroundColor: 'var(--hover-bg)' }}>
                Messages
              </Link>
            </div>
          </div>
        </div>

        {/* Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Feed */}
          <div className="md:col-span-2 space-y-6">
            {/* Create Post Card */}
            <div className="rounded-lg p-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="text-xl font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Share Your Thoughts</h3>
              <div className="space-y-5">
                <input
                  type="text"
                  placeholder="What's on your mind?"
                  className="w-full px-5 py-4 rounded-md"
                />
                <div className="flex gap-4">
                  <button className="flex-1 px-5 py-3 text-white rounded-md transition font-medium" style={{ backgroundColor: 'var(--hover-bg)' }}>
                    Upload Photo
                  </button>
                  <button className="flex-1 px-5 py-3 text-white rounded-md transition font-medium" style={{ backgroundColor: 'var(--accent)' }}>
                    Post
                  </button>
                </div>
              </div>
            </div>

            {/* Feed Items */}
            <div className="rounded-lg p-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Your Feed</h3>
              <p className="mb-6 font-medium" style={{ color: 'var(--text-secondary)' }}>
                Posts from users you follow will appear here.
              </p>
              <div className="flex gap-3">
                <Link href="/friends" className="inline-block px-6 py-3 text-white rounded transition font-medium" style={{ backgroundColor: 'var(--accent)' }}>
                  Find Friends
                </Link>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <div className="rounded-lg p-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="text-lg font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Your Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center p-5 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Friends</span>
                  <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>0</span>
                </div>
                <div className="flex justify-between items-center p-5 rounded-lg" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Messages</span>
                  <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>0</span>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="rounded-lg p-8" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <h3 className="text-lg font-bold mb-5" style={{ color: 'var(--text-primary)' }}>Quick Links</h3>
              <div className="space-y-3">
                <Link href="/profile" className="block w-full p-4 rounded-md transition font-medium" style={{ color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                  My Profile
                </Link>
                <Link href="/messages" className="block w-full p-4 rounded-md transition font-medium" style={{ color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                  Messages
                </Link>
                <Link href="/friends" className="block w-full p-4 rounded-md transition font-medium" style={{ color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
                  Friends
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
