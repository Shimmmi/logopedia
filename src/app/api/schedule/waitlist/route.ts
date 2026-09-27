import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const GET = withAuth(async (_req, user) => {
  const items = await prisma.waitlistEntry.findMany({
    where: { userId: user.id },
    include: { pupil: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ items });
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const item = await prisma.waitlistEntry.create({
    data: {
      userId: user.id,
      pupilId: body.pupilId,
      preferredStart: body.preferredStart ? new Date(body.preferredStart) : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json({ item });
});
