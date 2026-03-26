import { useAuth } from "../lib/auth";

export default function ProfilePage() {
  const { user, logout } = useAuth();

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
        {user.banner && (
          <div className="h-32 bg-cover bg-center" style={{ backgroundImage: `url(${user.banner})` }} />
        )}
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              {user.avatar ? (
                <img src={user.avatar} alt="" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <span className="text-white text-2xl font-bold">{user.username[0].toUpperCase()}</span>
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {user.nickname || user.username}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>@{user.username}</p>
            </div>
          </div>
          {user.bio && <p className="mb-4" style={{ color: 'var(--text-secondary)' }}>{user.bio}</p>}
          <button
            onClick={logout}
            className="px-4 py-2 rounded font-medium text-white"
            style={{ backgroundColor: 'var(--danger)' }}
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
