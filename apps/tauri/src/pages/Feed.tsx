import { useState, useEffect } from "react";
import { feedApi, type FeedPost } from "@fibeger/api-client";

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    feedApi.getFeed({ type: "friends" }).then((data) => {
      setPosts(data);
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
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Feed</h2>
      {posts.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)' }}>No posts yet. Add some friends to see their posts!</p>
      ) : (
        <div className="space-y-4">
          {posts.map((post: any) => (
            <div key={post.id} className="rounded-lg p-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {post.user?.username || "Unknown"}
                </span>
              </div>
              {post.caption && (
                <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>{post.caption}</p>
              )}
              {post.mediaUrl && (
                <img src={post.mediaUrl} alt="" className="rounded max-w-full" />
              )}
              <div className="mt-2 flex items-center gap-4">
                <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {post._count?.likes || 0} likes
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
