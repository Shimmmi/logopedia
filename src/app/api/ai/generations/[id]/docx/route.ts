import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { markdownToDocx } from "@/server/docx";

export const GET = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  const gen = await prisma.aiGeneration.findFirst({ where: { id, userId: user.id } });
  if (!gen) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const buf = await markdownToDocx(gen.title, gen.content);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(gen.title)}.docx"`,
    },
  });
});
