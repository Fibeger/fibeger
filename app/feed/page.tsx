"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageLoader from "@/app/components/PageLoader";
import EmptyState from "@/app/components/EmptyState";
import UserAvatar from "@/app/components/UserAvatar";

const MAX_CAPTION_LENGTH = 140;

interface User {
  id: number;
  username: string;
  nickname: string | null;
  avatar: string | null;
}

interface FeedPost {
  id: number;
  userId: number;
  caption: string | null;
  mediaUrl: string;
  mediaType: string;
  isPublic: boolean;
  createdAt: string;
  user: User;
  likes: { userId: number }[];
  _count: { likes: number };
}

export default function FeedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [caption, setCaption] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<FeedPost | null>(null);
  const [feedType, setFeedType] = useState<"friends" | "public">("friends");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchPosts();
    }
  }, [session, feedType]);

  const fetchPosts = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/feed?type=${feedType}`);
      if (res.ok) {
        const data = await res.json();
        setPosts(data);
      }
    } catch (error) {
      console.error("Failed to fetch posts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/webm",
    ];
    if (!validTypes.includes(file.type)) {
      alert(
        "Please select a valid image or video file (JPEG, PNG, GIF, WebP, MP4, WebM)"
      );
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      alert("File size must be less than 50MB");
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setMediaPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file");
      return;
    }

    if (caption.length > MAX_CAPTION_LENGTH) {
      alert(`Caption must be ${MAX_CAPTION_LENGTH} characters or less`);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("folder", "feed");

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadRes.ok) throw new Error("Failed to upload file");
      const { url } = await uploadRes.json();

      let mediaType = "image";
      if (selectedFile.type.startsWith("video/")) mediaType = "video";
      else if (selectedFile.type === "image/gif") mediaType = "gif";

      const postRes = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, mediaUrl: url, mediaType, isPublic }),
      });

      if (!postRes.ok) throw new Error("Failed to create post");

      setCaption("");
      setSelectedFile(null);
      setMediaPreview(null);
      setIsPublic(false);
      setShowUploadModal(false);
      await fetchPosts();
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Failed to upload post. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleLike = async (postId: number) => {
    try {
      const res = await fetch(`/api/feed/${postId}/like`, { method: "POST" });
      if (res.ok) {
        setPosts(
          posts.map((post) => {
            if (post.id === postId) {
              const currentUserId = parseInt(
                (session?.user as any)?.id || "0"
              );
              const isLiked = post.likes.some(
                (like) => like.userId === currentUserId
              );
              return {
                ...post,
                likes: isLiked
                  ? post.likes.filter((like) => like.userId !== currentUserId)
                  : [...post.likes, { userId: currentUserId }],
                _count: {
                  likes: isLiked
                    ? post._count.likes - 1
                    : post._count.likes + 1,
                },
              };
            }
            return post;
          })
        );
      }
    } catch (error) {
      console.error("Failed to like post:", error);
    }
  };

  const handleDelete = async (postId: number) => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch(`/api/feed/${postId}`, { method: "DELETE" });
      if (res.ok) {
        setPosts(posts.filter((post) => post.id !== postId));
      } else {
        alert("Failed to delete post");
      }
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Failed to delete post");
    }
  };

  const isLikedByCurrentUser = (post: FeedPost) => {
    const currentUserId = parseInt((session?.user as any)?.id || "0");
    return post.likes.some((like) => like.userId === currentUserId);
  };

  if (status === "loading" || loading) {
    return <PageLoader message="Loading feed..." />;
  }

  const currentUserId = parseInt((session?.user as any)?.id || "0");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--bg-primary)" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10"
        style={{
          backgroundColor: "var(--bg-secondary)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">Feed</h1>
            <Button onClick={() => setShowUploadModal(true)}>+ Upload</Button>
          </div>

          <Tabs
            value={feedType}
            onValueChange={(v) => setFeedType(v as "friends" | "public")}
          >
            <TabsList>
              <TabsTrigger value="friends">Friends</TabsTrigger>
              <TabsTrigger value="public">Public</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-4 py-6">
        {posts.length === 0 ? (
          <EmptyState
            icon="📷"
            title="No posts yet"
            description="Be the first to share something!"
            action={{ label: "Upload Your First Post", onClick: () => setShowUploadModal(true) }}
          />
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {posts.map((post) => (
              <Card
                key={post.id}
                className="mb-4 break-inside-avoid overflow-hidden transition hover:brightness-90"
              >
                {/* Media */}
                <div
                  className="relative bg-black cursor-pointer"
                  onClick={() => setSelectedPost(post)}
                >
                  {post.mediaType === "video" ? (
                    <video
                      src={post.mediaUrl}
                      className="w-full object-contain"
                      controls
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <img
                      src={post.mediaUrl}
                      alt={post.caption || "Post"}
                      className="w-full object-contain"
                    />
                  )}
                </div>

                <CardContent className="p-4">
                  {/* User Info */}
                  <div className="flex items-center gap-2 mb-3">
                    <Link href={`/profile/${post.user.username}`}>
                      <UserAvatar
                        src={post.user.avatar}
                        username={post.user.username}
                        size="sm"
                      />
                    </Link>
                    <Link
                      href={`/profile/${post.user.username}`}
                      className="flex-1"
                    >
                      <p
                        className="text-sm font-semibold hover:underline"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {post.user.nickname || post.user.username}
                      </p>
                      <p
                        className="text-xs"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </Link>
                    {post.userId === currentUserId && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(post.id)}
                        title="Delete post"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                        </svg>
                      </Button>
                    )}
                  </div>

                  {/* Caption */}
                  {post.caption && (
                    <p
                      className="text-sm mb-3"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {post.caption}
                    </p>
                  )}

                  {/* Like */}
                  <button
                    onClick={() => handleLike(post.id)}
                    className="flex items-center gap-2 transition hover:brightness-125"
                    style={{ border: "none", background: "none", padding: 0 }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill={isLikedByCurrentUser(post) ? "#f23f42" : "none"}
                      stroke={
                        isLikedByCurrentUser(post) ? "#f23f42" : "var(--text-tertiary)"
                      }
                      strokeWidth="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: isLikedByCurrentUser(post)
                          ? "#f23f42"
                          : "var(--text-tertiary)",
                      }}
                    >
                      {post._count.likes}
                    </span>
                  </button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Post Detail Dialog */}
      <Dialog
        open={!!selectedPost}
        onOpenChange={(open) => !open && setSelectedPost(null)}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto p-0">
          {selectedPost && (
            <div className="flex flex-col lg:flex-row">
              {/* Media */}
              <div className="flex-1 bg-black flex items-center justify-center p-4">
                {selectedPost.mediaType === "video" ? (
                  <video
                    src={selectedPost.mediaUrl}
                    className="max-w-full max-h-[80vh] object-contain"
                    controls
                    autoPlay
                  />
                ) : (
                  <img
                    src={selectedPost.mediaUrl}
                    alt={selectedPost.caption || "Post"}
                    className="max-w-full max-h-[80vh] object-contain"
                  />
                )}
              </div>

              {/* Info */}
              <div className="lg:w-96 p-6 flex flex-col" style={{ backgroundColor: "var(--bg-secondary)" }}>
                <div
                  className="flex items-center gap-3 mb-6 pb-6"
                  style={{ borderBottom: "1px solid var(--border-color)" }}
                >
                  <Link
                    href={`/profile/${selectedPost.user.username}`}
                    onClick={() => setSelectedPost(null)}
                  >
                    <UserAvatar
                      src={selectedPost.user.avatar}
                      username={selectedPost.user.username}
                      size="lg"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/profile/${selectedPost.user.username}`}
                      onClick={() => setSelectedPost(null)}
                      className="block"
                    >
                      <p
                        className="font-semibold hover:underline truncate"
                        style={{ color: "var(--text-primary)" }}
                      >
                        {selectedPost.user.nickname || selectedPost.user.username}
                      </p>
                      <p
                        className="text-sm truncate"
                        style={{ color: "var(--text-tertiary)" }}
                      >
                        @{selectedPost.user.username}
                      </p>
                    </Link>
                  </div>
                  {selectedPost.userId === currentUserId && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedPost(null);
                        handleDelete(selectedPost.id);
                      }}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                    >
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                      </svg>
                    </Button>
                  )}
                </div>

                {selectedPost.caption && (
                  <p className="mb-4" style={{ color: "var(--text-secondary)" }}>
                    {selectedPost.caption}
                  </p>
                )}

                <p
                  className="text-sm mb-6"
                  style={{ color: "var(--text-tertiary)" }}
                >
                  {new Date(selectedPost.createdAt).toLocaleString()}
                </p>

                <div
                  className="mt-auto pt-6"
                  style={{ borderTop: "1px solid var(--border-color)" }}
                >
                  <button
                    onClick={() => handleLike(selectedPost.id)}
                    className="flex items-center gap-3 w-full transition hover:brightness-125"
                    style={{ border: "none", background: "none", padding: 0 }}
                  >
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill={isLikedByCurrentUser(selectedPost) ? "#f23f42" : "none"}
                      stroke={
                        isLikedByCurrentUser(selectedPost)
                          ? "#f23f42"
                          : "var(--text-tertiary)"
                      }
                      strokeWidth="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                    <span
                      className="text-lg font-semibold"
                      style={{
                        color: isLikedByCurrentUser(selectedPost)
                          ? "#f23f42"
                          : "var(--text-tertiary)",
                      }}
                    >
                      {selectedPost._count.likes}{" "}
                      {selectedPost._count.likes === 1 ? "like" : "likes"}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog
        open={showUploadModal}
        onOpenChange={(open) => !uploading && !open && setShowUploadModal(false)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload to Feed</DialogTitle>
          </DialogHeader>

          {/* File Input */}
          <div className="mb-4">
            <label
              className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:brightness-90 transition"
              style={{
                borderColor: "var(--border-color)",
                backgroundColor: "var(--secondary)",
              }}
            >
              {mediaPreview ? (
                <div className="w-full h-full">
                  {selectedFile?.type.startsWith("video/") ? (
                    <video
                      src={mediaPreview}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <img
                      src={mediaPreview}
                      alt="Preview"
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-6">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--text-tertiary)"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p
                    className="mt-2 text-sm"
                    style={{ color: "var(--text-tertiary)" }}
                  >
                    Click to upload photo or video
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--text-muted)" }}
                  >
                    PNG, JPG, GIF, WebP, MP4, WebM (max 50MB)
                  </p>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Caption */}
          <div className="mb-4">
            <Textarea
              placeholder="Write a caption..."
              value={caption}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CAPTION_LENGTH) {
                  setCaption(e.target.value);
                }
              }}
              rows={3}
              disabled={uploading}
              maxLength={MAX_CAPTION_LENGTH}
            />
            <div
              className="mt-2 text-sm text-right"
              style={{
                color:
                  caption.length > MAX_CAPTION_LENGTH * 0.9
                    ? "var(--danger)"
                    : "var(--text-tertiary)",
              }}
            >
              {caption.length} / {MAX_CAPTION_LENGTH}
            </div>
          </div>

          {/* Public Toggle */}
          <div
            className="mb-6 flex items-center gap-3 p-3 rounded-md"
            style={{ backgroundColor: "var(--secondary)" }}
          >
            <div className="flex-1">
              <Label
                htmlFor="public-toggle"
                className="font-semibold cursor-pointer"
              >
                Make this post public
              </Label>
              <p
                className="text-sm mt-0.5"
                style={{ color: "var(--text-tertiary)" }}
              >
                {isPublic
                  ? "Everyone can see this post"
                  : "Only your friends can see this post"}
              </p>
            </div>
            <Switch
              id="public-toggle"
              checked={isPublic}
              onCheckedChange={setIsPublic}
              disabled={uploading}
            />
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full"
          >
            {uploading ? "Uploading..." : "Post"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
