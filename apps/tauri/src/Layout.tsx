import { useState } from "react";

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Sidebar - matches the web app's sidebar layout */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div className="flex h-full flex-col p-4">
          <h1 className="text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
            Fibeger
          </h1>
          <nav className="flex flex-col gap-1">
            <NavLink href="/feed" label="Feed" />
            <NavLink href="/messages" label="Messages" />
            <NavLink href="/friends" label="Friends" />
            <NavLink href="/profile" label="Profile" />
          </nav>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center h-14 px-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded"
          style={{ color: 'var(--text-primary)' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <span className="ml-3 font-semibold" style={{ color: 'var(--text-primary)' }}>Fibeger</span>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main className="flex-1 ml-0 lg:ml-60 pt-14 lg:pt-0 overflow-auto" style={{ backgroundColor: 'var(--bg-primary)' }}>
        {children}
      </main>
    </div>
  );
}

function NavLink({ href, label }: { href: string; label: string }) {
  const isActive = window.location.pathname.startsWith(href);
  return (
    <a
      href={href}
      className="flex items-center px-3 py-2 rounded text-sm font-medium transition-colors"
      style={{
        backgroundColor: isActive ? 'var(--hover-bg)' : 'transparent',
        color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
      }}
    >
      {label}
    </a>
  );
}
