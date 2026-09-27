import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { PLAN_LIMITS } from "@/server/limits";
import { PLAN_PRICES, payments, activatePlan } from "@/server/payments";
import { env } from "@/server/env";
import { Plan } from "@prisma/client";
import { prisma } from "@/server/db";

export const GET = withAuth(async (_req, user) => {
  const history = await prisma.payment.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({
    plans: PLAN_LIMITS,
    prices: PLAN_PRICES,
    provider: payments.name,
    history,
  });
});

export const POST = withAuth(async (req, user) => {
  const { plan, manual } = await req.json();
  if (manual && payments.name === "manual") {
    await activatePlan(user.id, plan as Plan, "manual");
    await prisma.payment.create({
      data: {
        userId: user.id,
        plan,
        amountKop: plan === "FREE" ? 0 : PLAN_PRICES[plan as "PRO" | "PREMIUM"] || 0,
        status: "SUCCEEDED",
        provider: "manual",
      },
    });
    return NextResponse.json({ ok: true, activated: plan });
  }
  const created = await payments.createPayment({
    userId: user.id,
    plan,
    returnUrl: `${env.appUrl}/settings/billing`,
  });
  return NextResponse.json(created);
});
