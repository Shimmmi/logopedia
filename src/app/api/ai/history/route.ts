import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const GET = withAuth(async (req, user) => {
  const sourceType = req.nextUrl.searchParams.get("sourceType");
  const items = await prisma.aiAnalysis.findMany({
    where: { userId: user.id, ...(sourceType ? { sourceType: sourceType as "DOC" | "AUDIO" } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return NextResponse.json({ items });
});
