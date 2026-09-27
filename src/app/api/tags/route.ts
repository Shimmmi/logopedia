import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { TAG_COLORS } from "@/lib/utils";
import { TagCategory } from "@prisma/client";

export const GET = withAuth(async (_req, user) => {
  const tags = await prisma.tag.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } });
  return NextResponse.json({ tags });
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const category = (body.category as TagCategory) || "CUSTOM";
  const tag = await prisma.tag.create({
    data: {
      userId: user.id,
      name: String(body.name).trim(),
      category,
      color: body.color || TAG_COLORS[category] || TAG_COLORS.CUSTOM,
    },
  });
  return NextResponse.json({ tag });
});
