import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { eventManager } from "@/app/lib/events";

// POST - Join the active call
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

    // Verify group membership
    const member = await prisma.groupChatMember.findUnique({
      where: { groupChatId_userId: { groupChatId, userId } },
    });
    if (!member) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const activeCall = await prisma.groupCall.findFirst({
      where: { groupChatId, status: "active" },
      include: {
        participants: {
          where: { leftAt: null },
          select: { userId: true },
        },
      },
    });

    if (!activeCall) {
      return NextResponse.json({ error: "No active call" }, { status: 404 });
    }

    // Upsert participant - handle re-joins (user left and rejoins)
    await prisma.groupCallParticipant.upsert({
      where: { callId_userId: { callId: activeCall.id, userId } },
      update: { leftAt: null, joinedAt: new Date() },
      create: { callId: activeCall.id, userId },
    });

    // Get current participant user IDs (before this join, to send them offer signals)
    const existingParticipantIds = activeCall.participants
      .map((p) => p.userId)
      .filter((id) => id !== userId);

    // Fetch updated call state to return
    const updatedCall = await prisma.groupCall.findUnique({
      where: { id: activeCall.id },
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

    const joiningUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, nickname: true, avatar: true },
    });

    // Notify existing participants that someone joined
    eventManager.emitToMany(existingParticipantIds, "call_participant_joined", {
      groupChatId,
      callId: activeCall.id,
      user: joiningUser,
    });

    return NextResponse.json({
      call: updatedCall,
      existingParticipantIds,
    });
  } catch (error) {
    console.error("POST /call/join error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
