import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const GET = withAuth(async (req, user) => {
  const kind = req.nextUrl.searchParams.get("kind");
  const items = await prisma.aiGeneration.findMany({
    where: { userId: user.id, ...(kind ? { kind: kind as never } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ items });
});
