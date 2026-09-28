import { prisma } from "./db";
import { isProtectedSubject } from "./school";
import { assertSlot, buildRrule, localParts, ScheduleError, zonedDateTime } from "./schedule";
import { isHoliday } from "./calendar-ru";

export type Placed = {
  pupilIds: string[];
  names: string[];
  weekday: number;
  ymd: string;
  startMin: number;
  endMin: number;
  pulled: string[];
  format: "GROUP" | "INDIVIDUAL";
};

export type Missed = { pupilId: string; name: string; reason: string };

function overlaps(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1;
}

function gradeOf(grade: string | null) {
  const n = Number(String(grade || "").replace(/\D/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function ymdInZone(d: Date, tz: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  return parts;
}

export async function proposeWeek(userId: string, weekStart: Date, tz: string) {
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const [hours, pupils, user, events, vacations] = await Promise.all([
    prisma.workingHours.findMany({ where: { userId }, orderBy: { weekday: "asc" } }),
    prisma.pupil.findMany({
      where: { userId, status: "ACTIVE" },
      include: { schoolLessons: { where: { status: "ACCEPTED" } }, tags: { include: { tag: true } } },
    }),
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.scheduleEvent.findMany({
      where: { userId, startAt: { lt: weekEnd }, endAt: { gt: weekStart }, status: { not: "CANCELED" } },
    }),
    prisma.vacation.findMany({ where: { userId } }),
  ]);
  const protectedList = user?.protectedSubjects || "русский язык,математика,алгебра,геометрия";
  const placed: Placed[] = [];
  const missed: Missed[] = [];
  const usedDays = new Map<string, Set<number>>();
  const taken: { ymd: string; startMin: number; endMin: number }[] = [];

  for (const ev of events) {
    const p = localParts(ev.startAt, tz);
    const end = localParts(ev.endAt, tz);
    const buffer = hours.find((h) => h.weekday === p.weekday)?.bufferMinutes ?? 10;
    taken.push({
      ymd: ymdInZone(ev.startAt, tz),
      startMin: p.minutes - buffer,
      endMin: (end.minutes || p.minutes + 40) + buffer,
    });
  }

  function dayDate(weekday: number) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart.getTime() + i * 86400000);
      if (localParts(d, tz).weekday === weekday) return d;
    }
    return weekStart;
  }

  function blockedReason(ymd: string, startMin: number, endMin: number, day: Date) {
    if (isHoliday(day)) return "праздник";
    if (vacations.some((v) => day >= v.startDate && day <= v.endDate)) return "отпуск";
    if (taken.some((t) => t.ymd === ymd && overlaps(startMin, endMin, t.startMin, t.endMin))) return "уже стоит занятие";
    return null;
  }

  function place(members: (typeof pupils)[number][], format: "GROUP" | "INDIVIDUAL") {
    const lead = members[0];
    const minutes = lead.lessonMinutes || (gradeOf(lead.grade) > 0 && gradeOf(lead.grade) <= 4 ? 30 : 40);
    const need = lead.sessionsPerWeek || 2;
    let got = 0;
    const days = hours.filter((h) => h.weekday >= 1 && h.weekday <= 5);
    for (const h of days) {
      if (got >= need) break;
      if (members.some((m) => usedDays.get(m.id)?.has(h.weekday))) continue;
      const day = dayDate(h.weekday);
      const ymd = ymdInZone(day, tz);
      for (let t = h.startMin; t + minutes <= h.endMin; t += 10) {
        if (h.breakStartMin != null && h.breakEndMin != null && overlaps(t, t + minutes, h.breakStartMin, h.breakEndMin)) continue;
        const busy = blockedReason(ymd, t, t + minutes, day);
        if (busy) continue;
        const pulled: string[] = [];
        let hard = false;
        for (const m of members) {
          const hits = m.schoolLessons.filter((s) => s.weekday === h.weekday && overlaps(t, t + minutes, s.startMin, s.endMin));
          if (!m.pullFromLessons && hits.length) {
            hard = true;
            break;
          }
          if (m.pullFromLessons && hits.some((s) => isProtectedSubject(s.subject, protectedList))) {
            hard = true;
            break;
          }
          for (const s of hits) pulled.push(`${m.fullName}: ${s.subject}`);
        }
        if (hard) continue;
        placed.push({
          pupilIds: members.map((m) => m.id),
          names: members.map((m) => m.fullName),
          weekday: h.weekday,
          ymd,
          startMin: t,
          endMin: t + minutes,
          pulled,
          format,
        });
        const buffer = h.bufferMinutes ?? 10;
        taken.push({ ymd, startMin: t - buffer, endMin: t + minutes + buffer });
        for (const m of members) {
          const set = usedDays.get(m.id) || new Set<number>();
          set.add(h.weekday);
          usedDays.set(m.id, set);
        }
        got++;
        break;
      }
    }
    if (got < need) {
      missed.push({
        pupilId: lead.id,
        name: members.map((m) => m.fullName).join(", "),
        reason: got ? `встало ${got} из ${need}` : "нет свободного слота",
      });
    }
  }

  const groups = pupils.filter((p) => p.lessonFormat === "GROUP");
  const individuals = pupils.filter((p) => p.lessonFormat !== "GROUP");
  const byDir = new Map<string, typeof groups>();
  for (const p of groups) {
    const dir = p.tags.find((t) => t.tag.category === "DIRECTION")?.tag.name || "без направления";
    const list = byDir.get(dir) || [];
    list.push(p);
    byDir.set(dir, list);
  }
  const leftover: typeof groups = [];
  for (const list of Array.from(byDir.values())) {
    const sorted = [...list].sort((a, b) => gradeOf(a.grade) - gradeOf(b.grade));
    const used = new Set<string>();
    for (const p of sorted) {
      if (used.has(p.id)) continue;
      const g = gradeOf(p.grade);
      const mates = sorted.filter((m) => !used.has(m.id) && m.id !== p.id && Math.abs(gradeOf(m.grade) - g) <= 1);
      const chunk = [p, ...mates].slice(0, 4);
      if (chunk.length >= 2) {
        chunk.forEach((m) => used.add(m.id));
        place(chunk, "GROUP");
      }
    }
    for (const p of sorted) if (!used.has(p.id)) leftover.push(p);
  }
  for (const p of leftover) place([p], "INDIVIDUAL");
  for (const p of individuals) place([p], "INDIVIDUAL");
  return { placed, missed, weekStart: weekStart.toISOString(), solo: leftover.map((p) => p.fullName) };
}

export async function acceptWeek(
  userId: string,
  proposal: { placed: Placed[] },
  tz: string,
  until?: string,
) {
  const created: string[] = [];
  const failed: { name: string; reason: string }[] = [];
  for (const slot of proposal.placed) {
    const start = zonedDateTime(slot.ymd, slot.startMin, tz);
    const end = zonedDateTime(slot.ymd, slot.endMin, tz);
    try {
      await assertSlot({ userId, start, end, tz });
      const rrule = until
        ? buildRrule({ freq: "WEEKLY", byweekday: [slot.weekday], until: new Date(`${until}T23:59:59Z`) })
        : null;
      const ev = await prisma.scheduleEvent.create({
        data: {
          userId,
          title: slot.names.join(", "),
          startAt: start,
          endAt: end,
          rrule,
          type: slot.format === "GROUP" ? "GROUP" : "INDIVIDUAL",
          notes: slot.pulled.length ? `Снятие с уроков: ${slot.pulled.join("; ")}` : null,
          pupils: { create: slot.pupilIds.map((pupilId) => ({ pupilId })) },
        },
      });
      created.push(ev.id);
    } catch (e) {
      failed.push({ name: slot.names.join(", "), reason: e instanceof ScheduleError ? e.message : "не удалось поставить" });
    }
  }
  return { created, failed };
}
