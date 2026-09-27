import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { pupilOwned } from "@/server/pupils";
import { assertAnalysis, LimitError } from "@/server/limits";
import { enqueueAiJob } from "@/server/queue";

export const POST = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const att = await prisma.pupilAttachment.findFirst({
    where: { pupilId: id, fileType: "PMPK" },
    orderBy: { createdAt: "desc" },
  });
  if (!att) return NextResponse.json({ error: "Файл заключения не найден" }, { status: 404 });
  try {
    await assertAnalysis(user.id);
  } catch (e) {
    if (e instanceof LimitError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  await prisma.pupilAttachment.update({ where: { id: att.id }, data: { analysisStatus: "QUEUED", analysisError: null } });
  await enqueueAiJob("analyze-pmpk", { userId: user.id, attachmentId: att.id, pupilId: id }, { attempts: 2 });
  return NextResponse.json({ ok: true });
});
