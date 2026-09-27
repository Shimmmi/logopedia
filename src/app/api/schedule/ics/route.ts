import { NextResponse } from "next/server";
import { createEvents, EventAttributes } from "ics";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { expandEvent } from "@/server/schedule";

export const GET = withAuth(async (_req, user) => {
  const from = new Date();
  const to = new Date();
  to.setFullYear(to.getFullYear() + 1);
  const events = await prisma.scheduleEvent.findMany({
    where: { userId: user.id, status: { not: "CANCELED" } },
    include: { exceptions: true },
  });
  const occs = events.flatMap((e) => expandEvent(e, from, to));
  const icsEvents: EventAttributes[] = occs.map((o) => ({
    title: o.title,
    start: [
      o.start.getFullYear(),
      o.start.getMonth() + 1,
      o.start.getDate(),
      o.start.getHours(),
      o.start.getMinutes(),
    ],
    end: [
      o.end.getFullYear(),
      o.end.getMonth() + 1,
      o.end.getDate(),
      o.end.getHours(),
      o.end.getMinutes(),
    ],
  }));
  const { error, value } = createEvents(icsEvents);
  if (error) return NextResponse.json({ error: String(error) }, { status: 500 });
  return new NextResponse(value, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="logoped.ics"',
    },
  });
});
