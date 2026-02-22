import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/app/lib/prisma';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET - Fetch a user's friends list for profile display
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { username } = await params;

    const targetUser = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const friends = await prisma.friend.findMany({
      where: { userId: targetUser.id },
      include: {
        friend: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true,
            themeColor: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(friends.map((f) => f.friend));
  } catch (error) {
    console.error('Profile friends GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
