import { NextResponse } from "next/server";

/** «Повторять до» включительно: конец дня в UTC, чтобы не потерять последнее занятие. */
function endOfDay(v: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T23:59:59Z`) : new Date(v);
}
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { assertSlot, buildRrule, ScheduleError } from "@/server/schedule";
import { notifyUser } from "@/server/notify";
import { EventStatus } from "@prisma/client";

export const PATCH = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  const ev = await prisma.scheduleEvent.findFirst({ where: { id, userId: user.id } });
  if (!ev) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const body = await req.json();

  if (body.occurrenceStart && (body.newStart || body.skip || body.status)) {
    const originalStart = new Date(body.occurrenceStart);
    const existing = await prisma.eventException.findFirst({ where: { eventId: id, originalStart } });
    if (body.skip) {
      if (existing) await prisma.eventException.update({ where: { id: existing.id }, data: { action: "SKIP" } });
      else await prisma.eventException.create({ data: { eventId: id, originalStart, action: "SKIP" } });
      return NextResponse.json({ ok: true });
    }
    const newStart = body.newStart ? new Date(body.newStart) : existing?.newStart ?? null;
    const newEnd = body.newEnd ? new Date(body.newEnd) : existing?.newEnd ?? null;
    if (body.newStart && newStart && newEnd) {
      try {
        await assertSlot({
          userId: user.id,
          start: newStart,
          end: newEnd,
          ignoreEventId: id,
          tz: typeof body.tz === "string" ? body.tz : undefined,
        });
      } catch (e) {
        if (e instanceof ScheduleError) return NextResponse.json({ error: e.message }, { status: 409 });
        throw e;
      }
    }
    const data = {
      action: "MODIFY" as const,
      newStart,
      newEnd,
      status: (body.status as EventStatus | undefined) ?? existing?.status ?? null,
      notes: body.notes ?? existing?.notes ?? null,
    };
    if (existing) await prisma.eventException.update({ where: { id: existing.id }, data });
    else await prisma.eventException.create({ data: { eventId: id, originalStart, ...data } });
    if (body.status === "CANCELED") await notifyUser(user.id, "Занятие отменено", ev.title, "/schedule");
    return NextResponse.json({ ok: true });
  }

  const start = body.startAt ? new Date(body.startAt) : ev.startAt;
  const end = body.endAt ? new Date(body.endAt) : ev.endAt;
  try {
    await assertSlot({
      userId: user.id,
      start,
      end,
      ignoreEventId: id,
      tz: typeof body.tz === "string" ? body.tz : undefined,
    });
  } catch (e) {
    if (e instanceof ScheduleError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
  let rrule: string | null | undefined = undefined;
  if (typeof body.recurring === "boolean") {
    rrule = body.recurring
      ? buildRrule({
          freq: "WEEKLY",
          interval: body.interval || 1,
          byweekday: body.byweekday,
          until: body.until ? endOfDay(body.until) : undefined,
        })
      : null;
  }
  const updated = await prisma.scheduleEvent.update({
    where: { id },
    data: {
      title: body.title,
      startAt: start,
      endAt: end,
      type: body.type,
      notes: body.notes,
      rrule,
      status: body.status as EventStatus | undefined,
    },
  });
  if (body.status === "CANCELED") {
    await notifyUser(user.id, "Занятие отменено", updated.title, "/schedule");
  }
  if (Array.isArray(body.pupilIds)) {
    await prisma.eventPupil.deleteMany({ where: { eventId: id } });
    if (body.pupilIds.length) {
      await prisma.eventPupil.createMany({
        data: body.pupilIds.map((pupilId: string) => ({ eventId: id, pupilId })),
      });
    }
  }
  return NextResponse.json({ event: updated });
});

export const DELETE = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  const ev = await prisma.scheduleEvent.findFirst({ where: { id, userId: user.id } });
  if (!ev) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  await prisma.scheduleEvent.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
