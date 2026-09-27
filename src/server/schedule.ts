import { RRule, rrulestr } from "rrule";
import { prisma } from "./db";
import { isHoliday } from "./calendar-ru";
import { EventStatus, EventType } from "@prisma/client";
import { timezoneLabel } from "@/lib/timezones";

export class ScheduleError extends Error {
  status = 409;
}

/** Локальные компоненты даты в часовом поясе пользователя (сервер работает в UTC). */
function localParts(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, weekday: "short", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  const hour = Number(get("hour")) % 24;
  return { weekday, minutes: hour * 60 + Number(get("minute")) };
}

function fmtMin(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export async function loadHours(userId: string) {
  return prisma.workingHours.findMany({ where: { userId } });
}

export function parseDateParam(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw Object.assign(new Error("Некорректный диапазон дат"), { status: 400 });
  }
  return d;
}

export async function assertSlot(params: {
  userId: string;
  start: Date;
  end: Date;
  ignoreEventId?: string;
  bufferMinutes?: number;
  tz?: string;
}) {
  if (params.end <= params.start) throw Object.assign(new Error("Конец раньше начала"), { status: 400 });

  const [hours, owner] = await Promise.all([
    loadHours(params.userId),
    prisma.user.findUnique({ where: { id: params.userId }, select: { timezone: true } }),
  ]);
  const tz = params.tz || owner?.timezone || "Europe/Moscow";
  const startLocal = localParts(params.start, tz);
  const wh = hours.find((h) => h.weekday === startLocal.weekday);
  if (hours.length && !wh) {
    throw new ScheduleError("Этот день не входит в рабочие дни. Изменить их можно в настройках → «График».");
  }
  if (wh) {
    const s = startLocal.minutes;
    const e = localParts(params.end, tz).minutes;
    if (s < wh.startMin || e > wh.endMin) {
      throw new ScheduleError(
        `Вне рабочих часов (${fmtMin(wh.startMin)}–${fmtMin(wh.endMin)}, ${timezoneLabel(tz)}). Изменить — Настройки → «График».`
      );
    }
    // Перерывы намеренно не проверяем: логопед сам решает, ставить ли занятие на обед.
  }

  const buffer = params.bufferMinutes ?? wh?.bufferMinutes ?? 10;
  const from = new Date(params.start.getTime() - buffer * 60_000);
  const to = new Date(params.end.getTime() + buffer * 60_000);

  const candidates = await prisma.scheduleEvent.findMany({
    where: {
      userId: params.userId,
      id: params.ignoreEventId ? { not: params.ignoreEventId } : undefined,
      status: { not: "CANCELED" },
      startAt: { lte: to },
    },
  });

  for (const ev of candidates) {
    const occs = expandEvent(ev, from, to);
    for (const o of occs) {
      if (o.status === "CANCELED") continue;
      if (o.start < to && o.end > from) {
        throw new ScheduleError("Это время занято другим занятием");
      }
    }
  }
}

export function expandEvent(
  ev: {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    rrule: string | null;
    type: EventType;
    status: EventStatus;
    notes: string | null;
    skipHolidays: boolean;
    exceptions?: {
      originalStart: Date;
      action: "SKIP" | "MODIFY";
      newStart: Date | null;
      newEnd: Date | null;
      status: EventStatus | null;
      notes: string | null;
    }[];
  },
  rangeStart: Date,
  rangeEnd: Date
) {
  const duration = ev.endAt.getTime() - ev.startAt.getTime();
  const exceptions = ev.exceptions ?? [];
  const skip = new Set(exceptions.filter((e) => e.action === "SKIP").map((e) => e.originalStart.toISOString()));
  const modify = new Map(exceptions.filter((e) => e.action === "MODIFY").map((e) => [e.originalStart.toISOString(), e]));

  const starts: Date[] = [];
  if (ev.rrule) {
    try {
      const rule = rrulestr(ev.rrule, { dtstart: ev.startAt });
      starts.push(...rule.between(rangeStart, rangeEnd, true));
    } catch {
      starts.push(ev.startAt);
    }
  } else if (ev.startAt >= rangeStart && ev.startAt <= rangeEnd) {
    starts.push(ev.startAt);
  }

  const out: {
    id: string;
    eventId: string;
    title: string;
    start: Date;
    end: Date;
    type: EventType;
    status: EventStatus;
    notes: string | null;
    occurrenceStart: Date;
  }[] = [];

  for (const s of starts) {
    if (ev.skipHolidays && isHoliday(s)) continue;
    const key = s.toISOString();
    if (skip.has(key)) continue;
    const mod = modify.get(key);
    const start = mod?.newStart ?? s;
    const end = mod?.newEnd ?? new Date(start.getTime() + duration);
    out.push({
      id: `${ev.id}:${key}`,
      eventId: ev.id,
      title: ev.title,
      start,
      end,
      type: ev.type,
      status: mod?.status ?? ev.status,
      notes: mod?.notes ?? ev.notes,
      occurrenceStart: s,
    });
  }
  return out;
}

export function buildRrule(opts: { freq: "WEEKLY"; interval?: number; byweekday?: number[]; until?: Date }) {
  const byweekday = (opts.byweekday ?? []).map((d) => {
    const map = [RRule.SU, RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA];
    return map[d];
  });
  const rule = new RRule({
    freq: RRule.WEEKLY,
    interval: opts.interval ?? 1,
    byweekday: byweekday.length ? byweekday : undefined,
    until: opts.until,
  });
  return rule.toString().replace("RRULE:", "");
}
