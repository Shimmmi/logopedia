import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { expandEvent, parseDateParam } from "@/server/schedule";
import { attendanceXlsx, markdownToDocx } from "@/server/docx";

export const GET = withAuth(async (req, user) => {
  let from: Date;
  let to: Date;
  try {
    from = parseDateParam(req.nextUrl.searchParams.get("from"), new Date(Date.now() - 90 * 86400000));
    to = parseDateParam(req.nextUrl.searchParams.get("to"), new Date());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const format = req.nextUrl.searchParams.get("format") || "xlsx";
  const events = await prisma.scheduleEvent.findMany({
    where: { userId: user.id },
    include: { exceptions: true, pupils: { include: { pupil: true } } },
  });
  const rows: { date: string; pupil: string; title: string; status: string; minutes: number }[] = [];
  for (const ev of events) {
    for (const o of expandEvent(ev, from, to)) {
      const mins = Math.round((o.end.getTime() - o.start.getTime()) / 60000);
      const pupils = ev.pupils.length ? ev.pupils : [null];
      for (const p of pupils) {
        rows.push({
          date: o.start.toLocaleString("ru-RU"),
          pupil: p?.pupil.fullName ?? "—",
          title: o.title,
          status: o.status,
          minutes: o.status === "COMPLETED" ? mins : 0,
        });
      }
    }
  }
  if (format === "docx") {
    const md = rows.map((r) => `- ${r.date} · ${r.pupil} · ${r.title} · ${r.status} · ${r.minutes} мин`).join("\n");
    const buf = await markdownToDocx("Отчёт о посещаемости", md);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="attendance.docx"',
      },
    });
  }
  const buf = await attendanceXlsx(rows);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="attendance.xlsx"',
    },
  });
});
