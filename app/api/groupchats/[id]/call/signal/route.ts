import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { eventManager } from "@/app/lib/events";

// POST - Relay WebRTC signaling data to a specific participant
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

    const body = await req.json();
    const { targetUserId, type, payload } = body;

    if (!targetUserId || !type || payload === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["offer", "answer", "ice-candidate"].includes(type)) {
      return NextResponse.json({ error: "Invalid signal type" }, { status: 400 });
    }

    // Verify sender is a member of the group
    const senderMember = await prisma.groupChatMember.findUnique({
      where: { groupChatId_userId: { groupChatId, userId } },
    });
    if (!senderMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Verify target is also a member of the group
    const targetMember = await prisma.groupChatMember.findUnique({
      where: { groupChatId_userId: { groupChatId, userId: parseInt(targetUserId) } },
    });
    if (!targetMember) {
      return NextResponse.json({ error: "Target user not in group" }, { status: 403 });
    }

    // Relay signal to target user
    eventManager.emit(parseInt(targetUserId), "call_signal", {
      groupChatId,
      fromUserId: userId,
      type,
      payload,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /call/signal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
