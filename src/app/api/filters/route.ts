import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const GET = withAuth(async (_req, user) => {
  const items = await prisma.savedFilter.findMany({ where: { userId: user.id } });
  return NextResponse.json({ items });
});

export const POST = withAuth(async (req, user) => {
  const { name, payload } = await req.json();
  const item = await prisma.savedFilter.create({ data: { userId: user.id, name, payload } });
  return NextResponse.json({ item });
});
