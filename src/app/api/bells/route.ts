import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { bellsOf, ensureDefaultBells } from "@/server/bells";

export const GET = withAuth(async (_req, user) => {
  await ensureDefaultBells(user.id);
  const bells = await prisma.bellTemplate.findMany({ where: { userId: user.id }, orderBy: [{ shift: "asc" }, { name: "asc" }] });
  const me = await prisma.user.findUnique({ where: { id: user.id }, select: { protectedSubjects: true } });
  return NextResponse.json({ bells, protectedSubjects: me?.protectedSubjects || "" });
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const name = String(body.name || "Основная").slice(0, 40);
  const shift = body.shift === 2 ? 2 : 1;
  const lessons = bellsOf(body.lessons);
  if (body.isDefault) await prisma.bellTemplate.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
  const row = await prisma.bellTemplate.create({
    data: { userId: user.id, name, shift, lessons, isDefault: !!body.isDefault },
  });
  return NextResponse.json({ bell: row });
});

export const PATCH = withAuth(async (req, user) => {
  const body = await req.json();
  if (typeof body.protectedSubjects === "string") {
    await prisma.user.update({ where: { id: user.id }, data: { protectedSubjects: body.protectedSubjects.slice(0, 240) } });
  }
  if (body.id) {
    const existing = await prisma.bellTemplate.findFirst({ where: { id: body.id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Шаблон не найден" }, { status: 404 });
    if (body.isDefault) await prisma.bellTemplate.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
    await prisma.bellTemplate.update({
      where: { id: existing.id },
      data: {
        name: body.name ? String(body.name).slice(0, 40) : undefined,
        shift: body.shift === 1 || body.shift === 2 ? body.shift : undefined,
        lessons: body.lessons ? bellsOf(body.lessons) : undefined,
        isDefault: body.isDefault === undefined ? undefined : !!body.isDefault,
      },
    });
  }
  return NextResponse.json({ ok: true });
});
