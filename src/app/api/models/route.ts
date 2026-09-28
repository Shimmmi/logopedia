import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { ensurePlanModels } from "@/server/models";
import { getPlan } from "@/server/limits";

export const GET = withAuth(async (_req, user) => {
  await ensurePlanModels();
  const plan = await getPlan(user.id);
  const [rows, me] = await Promise.all([
    prisma.planModelAllow.findMany({ where: { plan }, orderBy: { modelId: "asc" } }),
    prisma.user.findUnique({ where: { id: user.id }, select: { textModel: true, imageModel: true } }),
  ]);
  return NextResponse.json({
    plan,
    text: rows.filter((r) => r.kind === "TEXT"),
    image: rows.filter((r) => r.kind === "IMAGE"),
    textModel: me?.textModel || null,
    imageModel: me?.imageModel || null,
  });
});

export const PATCH = withAuth(async (req, user) => {
  await ensurePlanModels();
  const body = await req.json();
  const plan = await getPlan(user.id);
  const data: { textModel?: string | null; imageModel?: string | null } = {};
  if (body.textModel !== undefined) {
    if (!body.textModel) data.textModel = null;
    else {
      const ok = await prisma.planModelAllow.findFirst({ where: { plan, kind: "TEXT", modelId: body.textModel } });
      if (!ok) return NextResponse.json({ error: "Эта текстовая модель недоступна на вашем тарифе" }, { status: 403 });
      data.textModel = body.textModel;
    }
  }
  if (body.imageModel !== undefined) {
    if (!body.imageModel) data.imageModel = null;
    else {
      const ok = await prisma.planModelAllow.findFirst({ where: { plan, kind: "IMAGE", modelId: body.imageModel } });
      if (!ok) return NextResponse.json({ error: "Эта модель картинок недоступна на вашем тарифе" }, { status: 403 });
      data.imageModel = body.imageModel;
    }
  }
  await prisma.user.update({ where: { id: user.id }, data });
  return NextResponse.json({ ok: true });
});
