import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { storage } from "@/server/storage";

export const POST = withAuth(async (req, user, ctx) => {
  const set = await prisma.aiImageSet.findFirst({
    where: { id: ctx!.params.id, userId: user.id },
    include: { images: true },
  });
  if (!set) return NextResponse.json({ error: "Набор не найден" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const folder = await prisma.folder.findFirst({ where: { userId: user.id, name: "Методические материалы" } });
  const img = set.images.find((i) => i.filePath);
  if (!img?.filePath) return NextResponse.json({ error: "Лист ещё не готов" }, { status: 409 });
  const dest = `${user.id}/docs/${img.id}.png`;
  await storage.copy(img.filePath, dest);
  const params = set.params as { title?: string };
  const doc = await prisma.document.create({
    data: {
      userId: user.id,
      folderId: folder?.id || null,
      pupilId: body.pupilId || set.pupilId,
      filePath: dest,
      fileName: `${params.title || "Лист A4"}.png`,
      fileType: "IMAGE",
      mimeType: "image/png",
      sizeBytes: await storage.size(dest),
      encrypted: true,
      tags: ["картинки", "A4"],
    },
  });
  return NextResponse.json({ ok: true, count: 1, id: doc.id });
});
