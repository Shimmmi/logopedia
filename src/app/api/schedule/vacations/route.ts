import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { expandEvent } from "@/server/schedule";

export const GET = withAuth(async (_req, user) => {
  const items = await prisma.vacation.findMany({ where: { userId: user.id }, orderBy: { startDate: "desc" } });
  return NextResponse.json({ items });
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const startDate = new Date(body.startDate);
  const endDate = new Date(body.endDate);
  const vac = await prisma.vacation.create({
    data: {
      userId: user.id,
      startDate,
      endDate,
      autoReschedule: body.autoReschedule !== false,
      reason: body.reason || null,
    },
  });
  if (vac.autoReschedule) {
    const events = await prisma.scheduleEvent.findMany({
      where: { userId: user.id, status: "SCHEDULED" },
      include: { exceptions: true },
    });
    for (const ev of events) {
      const occs = expandEvent(ev, startDate, endDate);
      for (const o of occs) {
        await prisma.eventException.create({
          data: { eventId: ev.id, originalStart: o.occurrenceStart, action: "SKIP" },
        });
      }
    }
  }
  return NextResponse.json({ vacation: vac });
});
