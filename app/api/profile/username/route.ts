import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const DAYS_BETWEEN_USERNAME_CHANGE = 7;

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { newUsername } = body;

    if (!newUsername || newUsername.trim().length === 0) {
      return NextResponse.json(
        { error: "New username is required" },
        { status: 400 }
      );
    }

    const userId = parseInt(session.user.id);

    // Get user to check last username change
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check cooldown
    if (user.lastUsernameChange) {
      const daysSinceChange = Math.floor(
        (Date.now() - user.lastUsernameChange.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceChange < DAYS_BETWEEN_USERNAME_CHANGE) {
        const daysRemaining =
          DAYS_BETWEEN_USERNAME_CHANGE - daysSinceChange;
        return NextResponse.json(
          {
            error: `You can change your username again in ${daysRemaining} day(s)`,
            daysRemaining,
          },
          { status: 429 }
        );
      }
    }

    // Check if new username is already taken
    const existingUser = await prisma.user.findUnique({
      where: { username: newUsername },
    });

    if (existingUser && existingUser.id !== userId) {
      return NextResponse.json(
        { error: "Username already taken" },
        { status: 400 }
      );
    }

    // Record the username change
    await prisma.usernameHistory.create({
      data: {
        userId,
        oldUsername: user.username,
        newUsername,
      },
    });

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        username: newUsername,
        lastUsernameChange: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
      },
    });

    return NextResponse.json({
      message: "Username changed successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Username change error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
