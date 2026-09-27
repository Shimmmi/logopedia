import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const PATCH = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  const f = await prisma.folder.findFirst({ where: { id, userId: user.id } });
  if (!f) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const body = await req.json();
  const folder = await prisma.folder.update({
    where: { id },
    data: { name: body.name ?? f.name, parentId: body.parentId === undefined ? f.parentId : body.parentId },
  });
  return NextResponse.json({ folder });
});

export const DELETE = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  const f = await prisma.folder.findFirst({ where: { id, userId: user.id } });
  if (!f) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  if (f.isSystem) return NextResponse.json({ error: "Системную папку нельзя удалить" }, { status: 400 });
  await prisma.folder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
