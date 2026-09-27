import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const GET = withAuth(async (_req, user, ctx) => {
  const draft = await prisma.pmpkDraft.findFirst({ where: { id: ctx!.params.id, userId: user.id } });
  if (!draft) return NextResponse.json({ error: "Разбор не найден" }, { status: 404 });
  return NextResponse.json({
    status: draft.analysisStatus,
    error: draft.analysisError,
    result: draft.resultJson,
  });
});
