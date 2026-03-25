import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { eventManager } from "@/app/lib/events";

// POST - Leave the active call
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

    // Mark participant as left
    await prisma.groupCallParticipant.updateMany({
      where: { callId: activeCall.id, userId, leftAt: null },
      data: { leftAt: new Date() },
    });

    const remainingParticipantIds = activeCall.participants
      .map((p) => p.userId)
      .filter((id) => id !== userId);

    const leavingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, nickname: true, avatar: true },
    });

    if (remainingParticipantIds.length === 0) {
      // Last person left - end the call
      await prisma.groupCall.update({
        where: { id: activeCall.id },
        data: { status: "ended", endedAt: new Date() },
      });

      // Notify all group members the call has ended
      const groupMembers = await prisma.groupChatMember.findMany({
        where: { groupChatId },
        select: { userId: true },
      });
      const allMemberIds = groupMembers.map((m) => m.userId);
      eventManager.emitToMany(allMemberIds, "call_ended", {
        groupChatId,
        callId: activeCall.id,
      });
    } else {
      // Notify remaining participants that this user left
      eventManager.emitToMany(remainingParticipantIds, "call_participant_left", {
        groupChatId,
        callId: activeCall.id,
        userId,
        user: leavingUser,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /call/leave error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
