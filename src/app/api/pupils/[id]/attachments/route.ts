import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { pupilOwned } from "@/server/pupils";
import { storage, classifyMime, ALLOWED_EXT } from "@/server/storage";
import { assertStorage } from "@/server/limits";

export const POST = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  if (!ALLOWED_EXT.test(file.name)) {
    return NextResponse.json({ error: "Формат не поддерживается" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  await assertStorage(user.id, buf.length);
  const saved = await storage.save(user.id, file.name, buf, `pupils/${id}`);
  const att = await prisma.pupilAttachment.create({
    data: {
      pupilId: id,
      userId: user.id,
      filePath: saved.relativePath,
      fileName: file.name,
      fileType: classifyMime(file.type, file.name),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: saved.size,
      linkedEventId: (form.get("eventId") as string) || null,
    },
  });
  return NextResponse.json({ attachment: { ...att, url: storage.signedUrl(att.filePath) } });
});
