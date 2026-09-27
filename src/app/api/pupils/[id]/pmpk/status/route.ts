import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { pupilOwned } from "@/server/pupils";
import { storage } from "@/server/storage";

export const GET = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const att = await prisma.pupilAttachment.findFirst({
    where: { pupilId: id, fileType: "PMPK" },
    orderBy: { createdAt: "desc" },
  });
  const owner = await prisma.user.findUnique({ where: { id: user.id }, select: { aiPmpkAutoAnalyze: true } });
  const autoAnalyze = owner?.aiPmpkAutoAnalyze !== false;
  if (!att) return NextResponse.json({ status: "NONE", attachment: null, analysis: null, autoAnalyze });
  const analysis = att.analysisId
    ? await prisma.aiAnalysis.findFirst({ where: { id: att.analysisId, userId: user.id } })
    : await prisma.aiAnalysis.findFirst({
        where: { userId: user.id, sourceType: "PMPK", sourceId: att.id },
        orderBy: { createdAt: "desc" },
      });
  return NextResponse.json({
    status: att.analysisStatus,
    error: att.analysisError,
    attachment: {
      id: att.id,
      fileName: att.fileName,
      sizeBytes: att.sizeBytes,
      mimeType: att.mimeType,
      createdAt: att.createdAt,
      url: storage.signedUrl(att.filePath),
    },
    analysis: analysis?.resultJson ?? null,
    autoAnalyze,
  });
});
