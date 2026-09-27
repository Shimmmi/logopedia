import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const GET = withAuth(async (_req, user) => {
  const hours = await prisma.workingHours.findMany({ where: { userId: user.id }, orderBy: { weekday: "asc" } });
  return NextResponse.json({ hours });
});

export const PUT = withAuth(async (req, user) => {
  const { hours } = await req.json();
  await prisma.workingHours.deleteMany({ where: { userId: user.id } });
  if (Array.isArray(hours) && hours.length) {
    await prisma.workingHours.createMany({
      data: hours.map((h: { weekday: number; startMin: number; endMin: number; breakStartMin?: number; breakEndMin?: number; bufferMinutes?: number }) => ({
        userId: user.id,
        weekday: h.weekday,
        startMin: h.startMin,
        endMin: h.endMin,
        breakStartMin: h.breakStartMin ?? null,
        breakEndMin: h.breakEndMin ?? null,
        bufferMinutes: h.bufferMinutes ?? 10,
      })),
    });
  }
  const next = await prisma.workingHours.findMany({ where: { userId: user.id } });
  return NextResponse.json({ hours: next });
});
