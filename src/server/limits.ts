import { Plan } from "@prisma/client";
import { prisma } from "./db";
import { formatBytes, periodKey } from "@/lib/utils";
import { env, isProd } from "./env";

const UNLIMITED = {
  storageBytes: Number.MAX_SAFE_INTEGER,
  analysesPerMonth: Infinity,
  audioMinutes: Infinity,
  generationsPerMonth: Infinity,
  imagesPerMonth: Infinity,
  advancedModel: true,
  sms: true,
  unlimited: true,
} as const;

export const PLAN_LIMITS = {
  FREE: {
    storageBytes: 500 * 1024 * 1024,
    analysesPerMonth: 5,
    audioMinutes: 3,
    generationsPerMonth: 10,
    imagesPerMonth: 10,
    advancedModel: false,
    sms: false,
  },
  PRO: {
    storageBytes: 5 * 1024 * 1024 * 1024,
    analysesPerMonth: 20,
    audioMinutes: 15,
    generationsPerMonth: 80,
    imagesPerMonth: 60,
    advancedModel: false,
    sms: false,
  },
  PREMIUM: {
    storageBytes: 25 * 1024 * 1024 * 1024,
    analysesPerMonth: Infinity,
    audioMinutes: Infinity,
    generationsPerMonth: Infinity,
    imagesPerMonth: Infinity,
    advancedModel: true,
    sms: true,
  },
} as const;

export async function getPlan(userId: string): Promise<Plan> {
  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub || sub.status !== "ACTIVE") return "FREE";
  if (sub.currentPeriodEnd && sub.currentPeriodEnd < new Date() && sub.plan !== "FREE") {
    return "FREE";
  }
  return sub.plan;
}

export async function getLimits(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  const plan = await getPlan(userId);
  if (user?.role === "ADMIN" || (env.devUnlimited && !isProd)) {
    return { plan, ...UNLIMITED };
  }
  return { plan, ...PLAN_LIMITS[plan], unlimited: false };
}

export async function usedStorage(userId: string) {
  const [docs, atts] = await Promise.all([
    prisma.document.aggregate({ where: { userId, deletedAt: null }, _sum: { sizeBytes: true } }),
    prisma.pupilAttachment.aggregate({ where: { userId }, _sum: { sizeBytes: true } }),
  ]);
  return (docs._sum.sizeBytes ?? 0) + (atts._sum.sizeBytes ?? 0);
}

export async function assertStorage(userId: string, extra = 0) {
  const limits = await getLimits(userId);
  const used = await usedStorage(userId);
  if (used + extra > limits.storageBytes) {
    throw new LimitError(`Хранилище заполнено: ${formatBytes(used)} из ${formatBytes(limits.storageBytes)}`, 413);
  }
}

export async function getUsage(userId: string) {
  const period = periodKey();
  return prisma.aiUsage.upsert({
    where: { userId_period: { userId, period } },
    create: { userId, period },
    update: {},
  });
}

export async function assertGeneration(userId: string) {
  const limits = await getLimits(userId);
  const usage = await getUsage(userId);
  if (usage.generationsCount >= limits.generationsPerMonth) {
    throw new LimitError("Исчерпан лимит ИИ-генераций в этом месяце.");
  }
}

export async function assertAnalysis(userId: string, audioMin = 0) {
  const limits = await getLimits(userId);
  const usage = await getUsage(userId);
  if (usage.analysesCount >= limits.analysesPerMonth) {
    throw new LimitError("Исчерпан лимит ИИ-анализов в этом месяце.");
  }
  if (audioMin && usage.audioMinutesUsed + audioMin > limits.audioMinutes) {
    throw new LimitError("Исчерпан лимит минут транскрибации.");
  }
}

export async function remainingImages(userId: string) {
  const limits = await getLimits(userId);
  const usage = await getUsage(userId);
  return { used: usage.imagesCount, limit: limits.imagesPerMonth, left: limits.imagesPerMonth - usage.imagesCount };
}

export async function assertImages(userId: string, n = 1) {
  const { left, limit } = await remainingImages(userId);
  if (left < n) {
    throw new LimitError(
      Number.isFinite(limit)
        ? `Хватит на ${Math.max(0, left)} из ${n} листов — дождитесь нового месяца.`
        : "Исчерпан лимит листов."
    );
  }
}

export class LimitError extends Error {
  status: number;
  constructor(message: string, status = 402) {
    super(message);
    this.status = status;
  }
}

export async function bumpUsage(
  userId: string,
  patch: { tokens?: number; audioMin?: number; analyses?: number; generations?: number; images?: number }
) {
  const period = periodKey();
  await prisma.aiUsage.upsert({
    where: { userId_period: { userId, period } },
    create: {
      userId,
      period,
      tokensUsed: patch.tokens ?? 0,
      audioMinutesUsed: patch.audioMin ?? 0,
      analysesCount: patch.analyses ?? 0,
      generationsCount: patch.generations ?? 0,
      imagesCount: patch.images ?? 0,
    },
    update: {
      tokensUsed: { increment: patch.tokens ?? 0 },
      audioMinutesUsed: { increment: patch.audioMin ?? 0 },
      analysesCount: { increment: patch.analyses ?? 0 },
      generationsCount: { increment: patch.generations ?? 0 },
      imagesCount: { increment: patch.images ?? 0 },
    },
  });
}
