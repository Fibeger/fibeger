import { useState, useEffect } from "react";
import { conversationsApi, type Conversation } from "@fibeger/api-client";

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    conversationsApi.getConversations().then((data) => {
      setConversations(data);
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
      <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Messages</h2>
      {conversations.length === 0 ? (
        <p style={{ color: 'var(--text-tertiary)' }}>No conversations yet.</p>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv: any) => (
            <div key={conv.id} className="rounded-lg p-3 cursor-pointer hover:opacity-80" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <div className="flex items-center justify-between">
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {conv.members?.map((m: any) => m.user?.username).filter(Boolean).join(", ") || "Conversation"}
                </span>
                {conv.unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs text-white" style={{ backgroundColor: 'var(--accent)' }}>
                    {conv.unreadCount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
