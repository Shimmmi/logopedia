import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const GET = withAuth(async (req, user) => {
  const q = req.nextUrl.searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json({ pupils: [], documents: [], events: [] });
  const [pupils, documents, events] = await Promise.all([
    prisma.pupil.findMany({
      where: { userId: user.id, fullName: { contains: q, mode: "insensitive" }, status: { not: "ARCHIVE" } },
      take: 5,
      select: { id: true, fullName: true, grade: true },
    }),
    prisma.document.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        OR: [{ fileName: { contains: q, mode: "insensitive" } }, { contentText: { contains: q, mode: "insensitive" } }],
      },
      take: 5,
      select: { id: true, fileName: true },
    }),
    prisma.scheduleEvent.findMany({
      where: { userId: user.id, title: { contains: q, mode: "insensitive" } },
      take: 5,
      select: { id: true, title: true, startAt: true },
    }),
  ]);
  return NextResponse.json({ pupils, documents, events });
});
