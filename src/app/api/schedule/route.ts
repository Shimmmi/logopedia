import { NextResponse } from "next/server";

/** «Повторять до» включительно: конец дня в UTC, чтобы не потерять последнее занятие. */
function endOfDay(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T23:59:59Z`) : new Date(v);
}
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { assertSlot, buildRrule, expandEvent, parseDateParam, ScheduleError } from "@/server/schedule";
import { EVENT_COLORS } from "@/lib/utils";
import { EventType } from "@prisma/client";

export const GET = withAuth(async (req, user) => {
  let from: Date;
  let to: Date;
  try {
    from = parseDateParam(req.nextUrl.searchParams.get("from"), new Date());
    to = parseDateParam(req.nextUrl.searchParams.get("to"), new Date(Date.now() + 7 * 86400000));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const events = await prisma.scheduleEvent.findMany({
    where: { userId: user.id },
    include: { exceptions: true, pupils: { include: { pupil: true } } },
  });
  const occs = events.flatMap((ev) =>
    expandEvent(ev, from, to).map((o) => ({
      ...o,
      recurring: !!ev.rrule,
      rrule: ev.rrule,
      seriesStart: ev.startAt,
      seriesEnd: ev.endAt,
      color: EVENT_COLORS[ev.type],
      pupils: ev.pupils.map((p) => ({ id: p.pupil.id, fullName: p.pupil.fullName })),
    }))
  );
  return NextResponse.json({ events: occs });
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const start = new Date(body.startAt);
  const end = new Date(body.endAt);
  let rrule: string | null = null;
  if (body.recurring) {
    rrule = buildRrule({
      freq: "WEEKLY",
      interval: body.interval || 1,
      byweekday: body.byweekday,
      until: body.until ? endOfDay(body.until) : undefined,
    });
  }
  try {
    await assertSlot({
      userId: user.id,
      start,
      end,
      bufferMinutes: body.bufferMinutes,
      tz: typeof body.tz === "string" ? body.tz : undefined,
    });
  } catch (e) {
    if (e instanceof ScheduleError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
  const ev = await prisma.scheduleEvent.create({
    data: {
      userId: user.id,
      title: body.title || "Занятие",
      startAt: start,
      endAt: end,
      rrule,
      type: (body.type as EventType) || "INDIVIDUAL",
      notes: body.notes || null,
      skipHolidays: body.skipHolidays !== false,
      bufferMinutes: body.bufferMinutes ?? 10,
      pupils: body.pupilIds?.length
        ? { create: (body.pupilIds as string[]).map((pupilId) => ({ pupilId })) }
        : undefined,
    },
    include: { pupils: { include: { pupil: true } } },
  });
  return NextResponse.json({ event: ev });
});
