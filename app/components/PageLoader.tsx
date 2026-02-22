interface PageLoaderProps {
  message?: string;
}

export default function PageLoader({ message = 'Loading...' }: PageLoaderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="text-center">
        <div
          className="inline-block animate-spin rounded-full h-12 w-12 border-4"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'var(--text-primary)' }}
        />
        <p className="mt-6 text-xl font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {message}
        </p>
      </div>
    </div>
  );
}
