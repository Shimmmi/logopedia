import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { encrypt } from "@/server/encryption";
import { pupilOwned, serializePupil } from "@/server/pupils";
import { audit } from "@/server/audit";
import { storage } from "@/server/storage";

export const GET = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  const p = await pupilOwned(user.id, id);
  await audit({ userId: user.id, action: "view", entity: "pupil", entityId: id });
  const pFull = await prisma.pupil.findFirst({
    where: { id, userId: user.id },
    include: { tags: { include: { tag: true } }, consents: true, contacts: true },
  });
  if (!pFull) throw Object.assign(new Error("Ученик не найден"), { status: 404 });
  const [notes, progress, attachments, events, generations, analyses] = await Promise.all([
    prisma.pupilNote.findMany({ where: { pupilId: id }, orderBy: { createdAt: "desc" } }),
    prisma.pupilProgress.findMany({ where: { pupilId: id }, orderBy: { recordedAt: "asc" } }),
    prisma.pupilAttachment.findMany({ where: { pupilId: id }, orderBy: { createdAt: "desc" } }),
    prisma.eventPupil.findMany({
      where: { pupilId: id },
      include: { event: true },
      orderBy: { event: { startAt: "desc" } },
      take: 50,
    }),
    prisma.aiGeneration.findMany({ where: { pupilId: id }, orderBy: { createdAt: "desc" } }),
    prisma.document.findMany({ where: { pupilId: id, deletedAt: null } }),
  ]);
  return NextResponse.json({
    pupil: serializePupil(pFull),
    notes,
    progress,
    attachments: attachments.map((a) => ({ ...a, url: storage.signedUrl(a.filePath) })),
    events: events.map((e) => ({
      id: e.event.id,
      title: e.event.title,
      startAt: e.event.startAt,
      endAt: e.event.endAt,
      type: e.event.type,
      recurring: !!e.event.rrule,
      rrule: e.event.rrule,
      notes: e.event.notes,
      status: e.attendance ?? e.event.status,
    })),
    generations,
    documents: analyses,
  });
});

export const PATCH = withAuth(async (req: NextRequest, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const body = await req.json();
  await prisma.pupil.update({
    where: { id },
    data: {
      fullName: body.fullName,
      birthDate: body.birthDate ? new Date(body.birthDate) : body.birthDate === null ? null : undefined,
      gender: body.gender,
      school: body.school,
      grade: body.grade,
      enrolledAt: body.enrolledAt ? new Date(body.enrolledAt) : undefined,
      diagnosisEnc: body.diagnosis !== undefined ? (body.diagnosis ? encrypt(body.diagnosis) : null) : undefined,
      pmpkDate: body.pmpkDate ? new Date(body.pmpkDate) : body.pmpkDate === null ? null : undefined,
      pmpkNumber: body.pmpkNumber,
      aopVariant: body.aopVariant,
      pmpkNextAt: body.pmpkNextAt ? new Date(body.pmpkNextAt) : undefined,
      status: body.status,
    },
  });
  if (Array.isArray(body.tagIds)) {
    await prisma.pupilTag.deleteMany({ where: { pupilId: id } });
    if (body.tagIds.length) {
      await prisma.pupilTag.createMany({
        data: body.tagIds.map((tagId: string) => ({ pupilId: id, tagId })),
      });
    }
  }
  if (body.contacts) {
    const { syncContacts } = await import("@/server/pupils");
    await syncContacts(id, body.contacts);
  }
  if (body.consent) {
    await prisma.consent.deleteMany({ where: { pupilId: id } });
    await prisma.consent.create({
      data: {
        pupilId: id,
        given: !!body.consent.given,
        givenAt: body.consent.givenAt ? new Date(body.consent.givenAt) : null,
        signedBy: body.consent.signedBy || null,
      },
    });
  }
  await audit({ userId: user.id, action: "update", entity: "pupil", entityId: id });
  const full = await prisma.pupil.findUniqueOrThrow({
    where: { id },
    include: { tags: { include: { tag: true } }, consents: true, contacts: true },
  });
  return NextResponse.json({ pupil: serializePupil(full) });
});

export const DELETE = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  await prisma.pupil.update({ where: { id }, data: { status: "ARCHIVE" } });
  await audit({ userId: user.id, action: "archive", entity: "pupil", entityId: id });
  return NextResponse.json({ ok: true });
});
