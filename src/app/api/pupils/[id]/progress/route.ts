import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { pupilOwned } from "@/server/pupils";

export const POST = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const { area, score, note, recordedAt } = await req.json();
  const row = await prisma.pupilProgress.create({
    data: {
      pupilId: id,
      userId: user.id,
      area,
      score: Number(score),
      note,
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    },
  });
  return NextResponse.json({ progress: row });
});
