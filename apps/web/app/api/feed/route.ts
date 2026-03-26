import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/app/lib/prisma';

const MAX_CAPTION_LENGTH = 500;

const feedPostInclude = {
  user: {
    select: {
      id: true,
      username: true,
      nickname: true,
      avatar: true,
    },
  },
  likes: {
    select: {
      userId: true,
    },
  },
  _count: {
    select: {
      likes: true,
    },
  },
};

// GET - Fetch feed posts (public or friends, or by userId for profile pages)
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const viewerId = parseInt((session.user as any).id);
    const { searchParams } = new URL(request.url);
    const feedType = searchParams.get('type') || 'friends'; // 'friends' or 'public'
    const targetUserIdParam = searchParams.get('userId');

    // Profile page: fetch posts for a specific user
    if (targetUserIdParam) {
      const targetUserId = parseInt(targetUserIdParam);
      const isOwnProfile = viewerId === targetUserId;

      // Check if viewer is friends with target user
      let isFriend = false;
      if (!isOwnProfile) {
        const friendship = await prisma.friend.findFirst({
          where: {
            OR: [
              { userId: viewerId, friendId: targetUserId },
              { userId: targetUserId, friendId: viewerId },
            ],
          },
        });
        isFriend = !!friendship;
      }

      // Own profile or friends can see all posts; others only see public posts
      const whereClause = isOwnProfile || isFriend
        ? { userId: targetUserId }
        : { userId: targetUserId, isPublic: true };

      const posts = await prisma.feedPost.findMany({
        where: whereClause,
        include: feedPostInclude,
        orderBy: { createdAt: 'desc' },
      });

      return NextResponse.json(posts);
    }

    let posts;

    if (feedType === 'public') {
      posts = await prisma.feedPost.findMany({
        where: { isPublic: true },
        include: feedPostInclude,
        orderBy: { createdAt: 'desc' },
      });
    } else {
      // Fetch posts from the user and their friends (friends-only posts)
      const friends = await prisma.friend.findMany({
        where: { userId: viewerId },
        select: { friendId: true },
      });

      const friendIds = friends.map(f => f.friendId);

      posts = await prisma.feedPost.findMany({
        where: {
          isPublic: false,
          userId: { in: [viewerId, ...friendIds] },
        },
        include: feedPostInclude,
        orderBy: { createdAt: 'desc' },
      });
    }

    return NextResponse.json(posts);
  } catch (error) {
    console.error('Failed to fetch feed posts:', error);
    return NextResponse.json({ error: 'Failed to fetch feed posts' }, { status: 500 });
  }
}

// POST - Create a new feed post
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);
    const { caption, mediaUrl, mediaType, isPublic } = await request.json();

    if (!mediaUrl || !mediaType) {
      return NextResponse.json(
        { error: 'Media URL and type are required' },
        { status: 400 }
      );
    }

    if (!['image', 'video', 'gif'].includes(mediaType)) {
      return NextResponse.json(
        { error: 'Invalid media type. Must be image, video, or gif' },
        { status: 400 }
      );
    }

    if (caption && caption.length > MAX_CAPTION_LENGTH) {
      return NextResponse.json(
        { error: `Caption must be ${MAX_CAPTION_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    const post = await prisma.feedPost.create({
      data: {
        userId,
        caption: caption || null,
        mediaUrl,
        mediaType,
        isPublic: isPublic || false, // Default to friends-only
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        likes: true,
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('Failed to create feed post:', error);
    return NextResponse.json({ error: 'Failed to create feed post' }, { status: 500 });
  }
}
