import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { acceptWeek, proposeWeek } from "@/server/auto-schedule";
import { hhmm } from "@/server/bells";

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const tz = typeof body.tz === "string" ? body.tz : user.timezone || "Europe/Moscow";
  const weekStart = new Date(body.weekStart || Date.now());
  if (Number.isNaN(weekStart.getTime())) return NextResponse.json({ error: "Некорректная неделя" }, { status: 400 });
  if (body.accept && Array.isArray(body.placed)) {
    const result = await acceptWeek(user.id, { placed: body.placed }, tz, body.until || undefined);
    return NextResponse.json(result);
  }
  const proposal = await proposeWeek(user.id, weekStart, tz);
  return NextResponse.json({
    ...proposal,
    placed: proposal.placed.map((p) => ({ ...p, start: hhmm(p.startMin), end: hhmm(p.endMin) })),
  });
});
