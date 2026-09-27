import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

async function depth(folderId: string | null, userId: string): Promise<number> {
  let d = 0;
  let id = folderId;
  while (id) {
    d++;
    const f = await prisma.folder.findFirst({ where: { id, userId } });
    id = f?.parentId ?? null;
    if (d > 8) break;
  }
  return d;
}

export const GET = withAuth(async (_req, user) => {
  const folders = await prisma.folder.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } });
  return NextResponse.json({ folders });
});

export const POST = withAuth(async (req, user) => {
  const { name, parentId } = await req.json();
  const d = await depth(parentId || null, user.id);
  if (d >= 5) return NextResponse.json({ error: "Максимум 5 уровней папок" }, { status: 400 });
  const folder = await prisma.folder.create({
    data: { userId: user.id, name, parentId: parentId || null },
  });
  return NextResponse.json({ folder });
});
