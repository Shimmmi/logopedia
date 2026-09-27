import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { encrypt } from "@/server/encryption";
import { serializePupil, syncContacts } from "@/server/pupils";
import { audit } from "@/server/audit";
import { expandEvent } from "@/server/schedule";

export const GET = withAuth(async (req, user) => {
  const q = req.nextUrl.searchParams;
  const search = q.get("q")?.trim() || "";
  const status = q.get("status");
  const tags = q.get("tags")?.split(",").filter(Boolean) ?? [];
  const sort = q.get("sort") || "name";
  const cursor = q.get("cursor");
  const take = Math.min(50, Number(q.get("take") || 30));

  const where: Prisma.PupilWhereInput = { userId: user.id };
  if (status) where.status = status as Prisma.EnumPupilStatusFilter["equals"];
  else where.status = { not: "ARCHIVE" };
  if (search) where.fullName = { contains: search, mode: "insensitive" };
  if (tags.length) where.tags = { some: { tagId: { in: tags } } };

  const orderBy: Prisma.PupilOrderByWithRelationInput =
    sort === "enrolled" ? { enrolledAt: "desc" } : sort === "grade" ? { grade: "asc" } : sort === "updated" ? { updatedAt: "desc" } : { fullName: "asc" };

  const pupils = await prisma.pupil.findMany({
    where,
    include: { tags: { include: { tag: true } }, consents: true, contacts: true },
    orderBy,
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });
  const hasMore = pupils.length > take;
  const page = hasMore ? pupils.slice(0, take) : pupils;

  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 86400000);
  const events = await prisma.scheduleEvent.findMany({
    where: { userId: user.id, pupils: { some: { pupilId: { in: page.map((p) => p.id) } } } },
    include: { pupils: true, exceptions: true },
  });
  const nextMap = new Map<string, Date>();
  for (const ev of events) {
    const occs = expandEvent(ev, now, horizon).filter((o) => o.status !== "CANCELED");
    for (const link of ev.pupils) {
      const first = occs[0];
      if (!first) continue;
      const prev = nextMap.get(link.pupilId);
      if (!prev || first.start < prev) nextMap.set(link.pupilId, first.start);
    }
  }

  const total = await prisma.pupil.count({ where });
  return NextResponse.json({
    pupils: page.map((p) => serializePupil({ ...p, nextEventAt: nextMap.get(p.id) ?? null })),
    nextCursor: hasMore ? page[page.length - 1]?.id : null,
    total,
  });
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  if (!body.fullName?.trim()) return NextResponse.json({ error: "Укажите ФИО" }, { status: 400 });
  const pupil = await prisma.pupil.create({
    data: {
      userId: user.id,
      fullName: body.fullName,
      birthDate: body.birthDate ? new Date(body.birthDate) : null,
      gender: body.gender || null,
      school: body.school || null,
      grade: body.grade || null,
      enrolledAt: body.enrolledAt ? new Date(body.enrolledAt) : undefined,
      diagnosisEnc: body.diagnosis ? encrypt(body.diagnosis) : null,
      pmpkDate: body.pmpkDate ? new Date(body.pmpkDate) : null,
      pmpkNumber: body.pmpkNumber || null,
      aopVariant: body.aopVariant || null,
      pmpkNextAt: body.pmpkNextAt ? new Date(body.pmpkNextAt) : null,
      status: body.status || "ACTIVE",
    },
  });
  if (Array.isArray(body.tagIds) && body.tagIds.length) {
    await prisma.pupilTag.createMany({
      data: body.tagIds.map((tagId: string) => ({ pupilId: pupil.id, tagId })),
      skipDuplicates: true,
    });
  }
  await syncContacts(pupil.id, body.contacts);
  if (body.consent?.given) {
    await prisma.consent.create({
      data: {
        pupilId: pupil.id,
        given: true,
        givenAt: body.consent.givenAt ? new Date(body.consent.givenAt) : null,
        signedBy: body.consent.signedBy || null,
      },
    });
  }
  await audit({ userId: user.id, action: "create", entity: "pupil", entityId: pupil.id });
  const full = await prisma.pupil.findUniqueOrThrow({
    where: { id: pupil.id },
    include: { tags: { include: { tag: true } }, consents: true, contacts: true },
  });
  return NextResponse.json({ pupil: serializePupil(full) });
});
