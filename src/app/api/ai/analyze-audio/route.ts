import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { enqueueAiJob } from "@/server/queue";
import { getLimits } from "@/server/limits";

export const POST = withAuth(async (req, user) => {
  const { attachmentId } = await req.json();
  const att = await prisma.pupilAttachment.findFirst({ where: { id: attachmentId, userId: user.id } });
  if (!att) return NextResponse.json({ error: "Файл не найден" }, { status: 404 });
  const limits = await getLimits(user.id);
  await enqueueAiJob("analyze-audio", {
    userId: user.id,
    attachmentId,
    premium: limits.advancedModel,
  });
  return NextResponse.json({ queued: true });
});
