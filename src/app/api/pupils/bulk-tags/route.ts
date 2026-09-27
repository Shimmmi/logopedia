import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const POST = withAuth(async (req, user) => {
  const { pupilIds, tagIds } = await req.json();
  const owned = await prisma.pupil.findMany({
    where: { userId: user.id, id: { in: pupilIds } },
    select: { id: true },
  });
  const ids = owned.map((p) => p.id);
  const data = ids.flatMap((pupilId: string) => (tagIds as string[]).map((tagId) => ({ pupilId, tagId })));
  await prisma.pupilTag.createMany({ data, skipDuplicates: true });
  return NextResponse.json({ ok: true, count: data.length });
});
