import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const GET = withAuth(async (_req, user) => {
  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ items });
});

export const POST = withAuth(async (req, user) => {
  const { ids } = await req.json();
  await prisma.notification.updateMany({
    where: { userId: user.id, id: { in: ids || [] } },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
});
