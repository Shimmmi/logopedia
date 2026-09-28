import { Plan, ModelKind } from "@prisma/client";
import { prisma } from "./db";
import { env } from "./env";
import { getPlan } from "./limits";

export const SUNBURST = "openai/gpt-image-2.5-sunburst";
export const JOB_NORM = { IMAGE: 8, TEXT: 12, ANALYSIS: 10 } as const;

export async function ensurePlanModels() {
  const text = env.aiModelBasic;
  const plans: Plan[] = ["FREE", "PRO", "PREMIUM"];
  for (const plan of plans) {
    await prisma.planModelAllow.upsert({
      where: { plan_modelId_kind: { plan, modelId: text, kind: "TEXT" } },
      create: { plan, modelId: text, kind: "TEXT", isDefault: true, fallbackRub: JOB_NORM.TEXT },
      update: {},
    });
    const imageDefault = await prisma.planModelAllow.findFirst({ where: { plan, kind: "IMAGE", isDefault: true } });
    await prisma.planModelAllow.upsert({
      where: { plan_modelId_kind: { plan, modelId: SUNBURST, kind: "IMAGE" } },
      create: { plan, modelId: SUNBURST, kind: "IMAGE", isDefault: !imageDefault, fallbackRub: JOB_NORM.IMAGE },
      update: {},
    });
  }
}

export async function resolveModel(userId: string, kind: ModelKind) {
  await ensurePlanModels();
  const plan = await getPlan(userId);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { textModel: true, imageModel: true } });
  const chosen = kind === "TEXT" ? user?.textModel : user?.imageModel;
  const rows = await prisma.planModelAllow.findMany({ where: { plan, kind } });
  if (chosen) {
    if (!rows.some((r) => r.modelId === chosen)) {
      throw Object.assign(new Error("Эта модель недоступна на вашем тарифе"), { status: 403 });
    }
    return chosen;
  }
  const def = rows.find((r) => r.isDefault) || rows[0];
  if (def) return def.modelId;
  return kind === "IMAGE" ? SUNBURST : env.aiModelBasic;
}

export function normFor(kind: ModelKind) {
  return kind === "IMAGE" ? JOB_NORM.IMAGE : JOB_NORM.TEXT;
}
