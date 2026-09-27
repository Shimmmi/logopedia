import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { storage } from "@/server/storage";
import { audit } from "@/server/audit";

export const GET = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  const doc = await prisma.document.findFirst({
    where: { id, userId: user.id },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!doc) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  return NextResponse.json({ document: { ...doc, url: storage.signedUrl(doc.filePath) } });
});

export const PATCH = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  if (form && form.get("file")) {
    const file = form.get("file") as File;
    const buf = Buffer.from(await file.arrayBuffer());
    await prisma.documentVersion.create({
      data: { documentId: id, filePath: doc.filePath, version: doc.version },
    });
    const saved = await storage.save(user.id, file.name, buf, "docs");
    const updated = await prisma.document.update({
      where: { id },
      data: {
        filePath: saved.relativePath,
        fileName: file.name,
        sizeBytes: saved.size,
        version: { increment: 1 },
      },
    });
    await audit({ userId: user.id, action: "version", entity: "document", entityId: id });
    return NextResponse.json({ document: updated });
  }
  const body = form ? null : await req.json();
  const updated = await prisma.document.update({
    where: { id },
    data: {
      folderId: body?.folderId === undefined ? undefined : body.folderId,
      tags: body?.tags,
      pupilId: body?.pupilId,
      fileName: body?.fileName,
      deletedAt: body?.restore ? null : undefined,
    },
  });
  return NextResponse.json({ document: updated });
});

export const DELETE = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  const doc = await prisma.document.findFirst({ where: { id, userId: user.id } });
  if (!doc) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  await prisma.document.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit({ userId: user.id, action: "delete", entity: "document", entityId: id });
  return NextResponse.json({ ok: true });
});
