import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { eventManager } from "@/app/lib/events";

async function getMemberAndGroup(userId: number, groupChatId: number) {
  const member = await prisma.groupChatMember.findUnique({
    where: { groupChatId_userId: { groupChatId, userId } },
  });
  if (!member) return null;

  const group = await prisma.groupChat.findUnique({
    where: { id: groupChatId },
    include: {
      members: {
        select: { userId: true },
      },
    },
  });
  return group ? { member, group } : null;
}

// GET - Get active call for a group
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(session.user.id);
    const groupChatId = parseInt(id);

    const ctx = await getMemberAndGroup(userId, groupChatId);
    if (!ctx) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const activeCall = await prisma.groupCall.findFirst({
      where: { groupChatId, status: "active" },
      include: {
        startedBy: { select: { id: true, username: true, nickname: true, avatar: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, username: true, nickname: true, avatar: true } },
          },
        },
      },
    });

    return NextResponse.json({ call: activeCall });
  } catch (error) {
    console.error("GET /call error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Start a new call
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(session.user.id);
    const groupChatId = parseInt(id);

    const ctx = await getMemberAndGroup(userId, groupChatId);
    if (!ctx) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Check if there's already an active call
    const existingCall = await prisma.groupCall.findFirst({
      where: { groupChatId, status: "active" },
    });
    if (existingCall) {
      return NextResponse.json({ error: "A call is already active in this group" }, { status: 409 });
    }

    const call = await prisma.groupCall.create({
      data: {
        groupChatId,
        startedById: userId,
        participants: {
          create: { userId },
        },
      },
      include: {
        startedBy: { select: { id: true, username: true, nickname: true, avatar: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, username: true, nickname: true, avatar: true } },
          },
        },
      },
    });

    const memberIds = ctx.group.members.map((m) => m.userId);
    eventManager.emitToMany(memberIds, "call_started", {
      groupChatId,
      call,
    });

    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    console.error("POST /call error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Force-end the active call (admin or call starter only)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(session.user.id);
    const groupChatId = parseInt(id);

    const ctx = await getMemberAndGroup(userId, groupChatId);
    if (!ctx) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const activeCall = await prisma.groupCall.findFirst({
      where: { groupChatId, status: "active" },
    });
    if (!activeCall) {
      return NextResponse.json({ error: "No active call" }, { status: 404 });
    }

    const isAdmin = ctx.member.role === "admin";
    const isStarter = activeCall.startedById === userId;
    if (!isAdmin && !isStarter) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.groupCall.update({
      where: { id: activeCall.id },
      data: { status: "ended", endedAt: new Date() },
    });

    const memberIds = ctx.group.members.map((m) => m.userId);
    eventManager.emitToMany(memberIds, "call_ended", {
      groupChatId,
      callId: activeCall.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /call error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
