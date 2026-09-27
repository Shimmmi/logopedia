import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { expandEvent } from "@/server/schedule";

export const GET = withAuth(async (_req, user) => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400000);
  const weekEnd = new Date(now.getTime() + 7 * 86400000);
  const [pupils, events, generations] = await Promise.all([
    prisma.pupil.findMany({ where: { userId: user.id, status: { not: "ARCHIVE" } }, include: { consents: true } }),
    prisma.scheduleEvent.findMany({
      where: { userId: user.id },
      include: { exceptions: true, pupils: { include: { pupil: true } } },
    }),
    prisma.aiGeneration.count({ where: { userId: user.id } }),
  ]);
  const today = events.flatMap((e) => expandEvent(e, start, end)).sort((a, b) => a.start.getTime() - b.start.getTime());
  const week = events.flatMap((e) => expandEvent(e, now, weekEnd));
  const attention = pupils
    .filter((p) => (p.pmpkNextAt && p.pmpkNextAt < new Date(Date.now() + 30 * 86400000)) || !p.consents.some((c) => c.given))
    .slice(0, 8)
    .map((p) => ({
      id: p.id,
      href: `/pupils/${p.id}`,
      text: !p.consents.some((c) => c.given) ? `${p.fullName}: нет согласия ОПД` : `${p.fullName}: подходит срок ПМПК`,
    }));
  return NextResponse.json({
    userName: user.name,
    counts: { pupils: pupils.length, generations, upcoming: today.length },
    upcoming: today.map((o) => ({ id: o.id, eventId: o.eventId, title: o.title, start: o.start })),
    attention,
    stats: {
      completed: week.filter((o) => o.status === "COMPLETED").length,
      canceled: week.filter((o) => o.status === "CANCELED").length,
    },
  });
});
