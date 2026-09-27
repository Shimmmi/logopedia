import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { storage, ALLOWED_EXT, classifyMime } from "@/server/storage";
import { assertStorage } from "@/server/limits";
import { extractText } from "@/server/extract";
import { audit } from "@/server/audit";

export const GET = withAuth(async (req, user) => {
  const q = req.nextUrl.searchParams;
  const search = q.get("q")?.trim();
  const folderId = q.get("folderId");
  const tag = q.get("tag");
  const type = q.get("type");
  const pupilId = q.get("pupilId");
  const trash = q.get("trash") === "1";
  const where: Prisma.DocumentWhereInput = {
    userId: user.id,
    deletedAt: trash ? { not: null } : null,
  };
  if (folderId === "root") where.folderId = null;
  else if (folderId) where.folderId = folderId;
  if (pupilId) where.pupilId = pupilId;
  if (type) where.fileType = type;
  if (tag) where.tags = { has: tag };
  if (search) {
    where.OR = [
      { fileName: { contains: search, mode: "insensitive" } },
      { contentText: { contains: search, mode: "insensitive" } },
      { tags: { has: search } },
    ];
  }
  const docs = await prisma.document.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json({
    documents: docs.map((d) => ({ ...d, url: storage.signedUrl(d.filePath) })),
  });
});

export const POST = withAuth(async (req, user) => {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Файл не выбран" }, { status: 400 });
  if (!ALLOWED_EXT.test(file.name)) return NextResponse.json({ error: "Формат не поддерживается" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());
  await assertStorage(user.id, buf.length);
  const saved = await storage.saveEncrypted(user.id, file.name, buf, "docs");
  const text = await extractText(buf, file.type, file.name);
  const tags = String(form.get("tags") || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const doc = await prisma.document.create({
    data: {
      userId: user.id,
      folderId: (form.get("folderId") as string) || null,
      pupilId: (form.get("pupilId") as string) || null,
      filePath: saved.relativePath,
      fileName: file.name,
      fileType: classifyMime(file.type, file.name),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: saved.size,
      encrypted: true,
      tags,
      contentText: text || null,
      autoTag: (form.get("autoTag") as string) || null,
    },
  });
  await audit({ userId: user.id, action: "create", entity: "document", entityId: doc.id });
  return NextResponse.json({ document: { ...doc, url: storage.signedUrl(doc.filePath) } });
});
