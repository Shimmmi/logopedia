import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const POST = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  const versionId = ctx!.params.versionId;
  const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const ver = await prisma.documentVersion.findFirst({ where: { id: versionId, documentId: id } });
  if (!ver) return NextResponse.json({ error: "Версия не найдена" }, { status: 404 });
  await prisma.documentVersion.create({
    data: { documentId: id, filePath: doc.filePath, version: doc.version },
  });
  const updated = await prisma.document.update({
    where: { id },
    data: { filePath: ver.filePath, version: { increment: 1 } },
  });
  return NextResponse.json({ document: updated });
});
