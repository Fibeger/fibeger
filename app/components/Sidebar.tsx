'use client';

import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();

  if (!session) {
    return null;
  }

  const isActive = (href: string) => pathname === href;

  const navItems = [
    { href: '/feed', label: 'Home', icon: '🏠' },
    { href: '/messages', label: 'Messages', icon: '💬' },
    { href: '/friends', label: 'Friends', icon: '👥' },
    { href: '/groups', label: 'Groups', icon: '👨‍💼' },
  ];

  return (
    <aside 
      className="fixed left-0 top-0 h-screen w-60 flex flex-col border-r"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
      }}
      aria-label="Sidebar navigation"
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <Link 
          href="/feed" 
          className="flex items-center gap-3 rounded-lg px-2 py-1 focus:outline-2 focus:outline-offset-2 transition-all hover:bg-opacity-50"
          style={{ 
            outline: '2px solid transparent',
            outlineColor: 'var(--accent)',
          }}
          aria-label="Dicsord - Home"
        >
          <div 
            className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-base"
            style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
          >
            D
          </div>
          <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>Dicsord</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3" aria-label="Main navigation">
        <div className="space-y-0.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-2 py-1.5 rounded transition-all focus:outline-2 focus:outline-offset-2 group"
              style={{
                backgroundColor: isActive(item.href) ? 'var(--hover-bg)' : 'transparent',
                color: isActive(item.href) ? 'var(--text-primary)' : 'var(--text-secondary)',
                outlineColor: 'var(--accent)',
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.href)) {
                  e.currentTarget.style.backgroundColor = 'var(--focus-color)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.href)) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
              aria-current={isActive(item.href) ? 'page' : undefined}
            >
              <span className="text-lg" aria-hidden="true">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Profile Section */}
      <div className="mt-auto">
        {/* Profile Button */}
        <Link
          href="/profile"
          className="flex items-center gap-3 mx-2 mb-2 px-2 py-2 rounded transition-all focus:outline-2 focus:outline-offset-2"
          style={{
            backgroundColor: isActive('/profile') ? 'var(--hover-bg)' : 'var(--bg-tertiary)',
            outlineColor: 'var(--accent)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--hover-bg)';
          }}
          onMouseLeave={(e) => {
            if (!isActive('/profile')) {
              e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
            }
          }}
          aria-current={isActive('/profile') ? 'page' : undefined}
        >
          <div 
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
            style={{ backgroundColor: 'var(--accent)', color: '#ffffff' }}
          >
            👤
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
              {(session.user as any)?.username || session.user?.email}
            </div>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Online</div>
          </div>
        </Link>

        {/* Sign Out Button */}
        <div className="px-2 pb-2">
          <button
            onClick={() => signOut()}
            className="w-full px-3 py-2 rounded font-medium transition-all focus:outline-2 focus:outline-offset-2 text-xs"
            style={{
              backgroundColor: 'var(--danger)',
              color: '#ffffff',
              outlineColor: 'var(--accent)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--danger-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--danger)';
            }}
            aria-label="Sign out of your account"
          >
            Sign Out
          </button>
        </div>
      </div>
    </aside>
  );
}
