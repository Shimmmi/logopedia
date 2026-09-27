import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const PATCH = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  const gen = await prisma.aiGeneration.findFirst({ where: { id, userId: user.id } });
  if (!gen) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const { content } = await req.json();
  const updated = await prisma.aiGeneration.update({ where: { id }, data: { content } });
  return NextResponse.json({ generation: updated });
});
