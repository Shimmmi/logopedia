import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/server/auth";
import { prisma } from "@/server/db";
import { issueVerification } from "@/server/verify-email";
import { ensurePlanModels, JOB_NORM, normFor } from "@/server/models";
import { env } from "@/server/env";
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
      const allows = await prisma.planModelAllow.findMany({ orderBy: [{ plan: "asc" }, { kind: "asc" }, { modelId: "asc" }] });
      let catalog: { id: string; kind: "TEXT" | "IMAGE" }[] = [];
      if (env.aiApiKey) {
        const res = await fetch(`${env.aiBaseUrl.replace(/\/$/, "")}/models`, {
          headers: { Authorization: `Bearer ${env.aiApiKey}` },
        });
        if (res.ok) {
          const data = (await res.json()) as { data?: { id?: string; architecture?: { output_modalities?: string[] } }[] };
          catalog = (data.data || [])
            .filter((m) => m.id)
            .map((m) => ({
              id: m.id as string,
              kind: (m.architecture?.output_modalities || []).includes("image") ? "IMAGE" : "TEXT",
            }));
        }
      }
      return NextResponse.json({ allows, catalog, norms: JOB_NORM });
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
