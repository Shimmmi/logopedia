import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/server/auth";
import { prisma } from "@/server/db";
import { issueVerification } from "@/server/verify-email";
import { ensurePlanModels, hideCatalogModel, JOB_NORM, loadCatalog, normFor, restoreCatalogModel } from "@/server/models";
import { ModelKind, Plan } from "@prisma/client";

async function admin(req: NextRequest) {
  const user = await requireUser(req);
  if (user.role !== "ADMIN") throw Object.assign(new Error("Недостаточно прав."), { status: 403 });
  return user;
}

export async function GET(req: NextRequest) {
  try {
    await admin(req);
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      include: { subscription: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    if (req.nextUrl.searchParams.get("part") === "models") {
      await ensurePlanModels();
      const force = req.nextUrl.searchParams.get("refresh") === "1";
      const [allows, all, hiddenRows] = await Promise.all([
        prisma.planModelAllow.findMany({ orderBy: [{ plan: "asc" }, { kind: "asc" }, { modelId: "asc" }] }),
        loadCatalog(force),
        prisma.modelCatalogHide.findMany({ orderBy: { modelId: "asc" } }),
      ]);
      const hiddenKeys = new Set(hiddenRows.map((h) => `${h.kind}:${h.modelId}`));
      const catalog = all.filter((m) => !hiddenKeys.has(`${m.kind}:${m.id}`));
      return NextResponse.json({
        allows,
        catalog,
        hidden: hiddenRows.map((h) => ({ id: h.modelId, kind: h.kind })),
        norms: JOB_NORM,
      });
    }
    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        verified: !!u.emailVerifiedAt,
        plan: u.subscription?.plan ?? "FREE",
        createdAt: u.createdAt,
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    await admin(req);
    const body = await req.json();
    if (body.action === "plan") {
      await prisma.subscription.upsert({
        where: { userId: body.userId },
        create: { userId: body.userId, plan: body.plan, status: "ACTIVE" },
        update: { plan: body.plan, status: "ACTIVE" },
      });
    }
    if (body.action === "hide" || body.action === "restore") {
      const kind = body.kind as ModelKind;
      const modelId = String(body.modelId || "");
      if (!modelId || (kind !== "TEXT" && kind !== "IMAGE")) {
        return NextResponse.json({ error: "Не указана модель" }, { status: 400 });
      }
      if (body.action === "hide") await hideCatalogModel(modelId, kind);
      else await restoreCatalogModel(modelId, kind);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "model") {
      const plan = body.plan as Plan;
      const kind = body.kind as ModelKind;
      const modelId = String(body.modelId || "");
      if (!modelId || (kind !== "TEXT" && kind !== "IMAGE")) {
        return NextResponse.json({ error: "Не указана модель" }, { status: 400 });
      }
      if (!body.enabled) {
        await prisma.planModelAllow.deleteMany({ where: { plan, modelId, kind } });
        return NextResponse.json({ ok: true });
      }
      const fallbackRub = Number(body.fallbackRub) || normFor(kind);
      if (fallbackRub > normFor(kind)) {
        return NextResponse.json({ error: `Запасная цена выше нормы тарифа (${normFor(kind)} ₽)` }, { status: 400 });
      }
      if (body.isDefault) {
        await prisma.planModelAllow.updateMany({ where: { plan, kind }, data: { isDefault: false } });
      }
      await prisma.planModelAllow.upsert({
        where: { plan_modelId_kind: { plan, modelId, kind } },
        create: { plan, modelId, kind, isDefault: !!body.isDefault, fallbackRub },
        update: { isDefault: !!body.isDefault, fallbackRub },
      });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "resend") {
      const u = await prisma.user.findUnique({ where: { id: body.userId } });
      if (u) await issueVerification(u.id, u.email);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
