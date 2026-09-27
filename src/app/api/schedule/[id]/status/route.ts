import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { EventStatus } from "@prisma/client";

export const POST = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  const ev = await prisma.scheduleEvent.findFirst({ where: { id, userId: user.id } });
  if (!ev) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const { status, pupilId, reason } = await req.json();
  if (pupilId) {
    await prisma.eventPupil.update({
      where: { eventId_pupilId: { eventId: id, pupilId } },
      data: { attendance: status as EventStatus, reason },
    });
  } else {
    await prisma.scheduleEvent.update({ where: { id }, data: { status: status as EventStatus, notes: reason ?? ev.notes } });
  }
  return NextResponse.json({ ok: true });
});
