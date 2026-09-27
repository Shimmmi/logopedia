import { Plan } from "@prisma/client";
import { env } from "./env";
import { prisma } from "./db";

export const PLAN_PRICES: Record<Exclude<Plan, "FREE">, number> = {
  PRO: 99000,
  PREMIUM: 249000,
};

export interface PaymentProvider {
  name: string;
  createPayment(params: { userId: string; plan: Plan; returnUrl: string }): Promise<{ url: string; id: string }>;
}

class ManualProvider implements PaymentProvider {
  name = "manual";
  async createPayment(params: { userId: string; plan: Plan; returnUrl: string }) {
    const payment = await prisma.payment.create({
      data: {
        userId: params.userId,
        plan: params.plan,
        amountKop: params.plan === "FREE" ? 0 : PLAN_PRICES[params.plan as "PRO" | "PREMIUM"],
        status: "PENDING",
        provider: "manual",
      },
    });
    return { url: `${params.returnUrl}?manual=${payment.id}`, id: payment.id };
  }
}

class YooKassaProvider implements PaymentProvider {
  name = "yookassa";
  async createPayment(params: { userId: string; plan: Plan; returnUrl: string }) {
    const amount = params.plan === "FREE" ? 0 : PLAN_PRICES[params.plan as "PRO" | "PREMIUM"];
    const res = await fetch("https://api.yookassa.ru/v3/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotence-Key": crypto.randomUUID(),
        Authorization: `Basic ${Buffer.from(`${env.yookassaShopId}:${env.yookassaSecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: { value: (amount / 100).toFixed(2), currency: "RUB" },
        capture: true,
        confirmation: { type: "redirect", return_url: params.returnUrl },
        description: `LogoPed тариф ${params.plan}`,
        metadata: { userId: params.userId, plan: params.plan },
      }),
    });
    if (!res.ok) throw new Error("Ошибка ЮKassa");
    const data = await res.json();
    await prisma.payment.create({
      data: {
        userId: params.userId,
        plan: params.plan,
        amountKop: amount,
        status: "PENDING",
        provider: "yookassa",
        providerId: data.id,
      },
    });
    return { url: data.confirmation.confirmation_url as string, id: data.id as string };
  }
}

export const payments: PaymentProvider = env.yookassaShopId ? new YooKassaProvider() : new ManualProvider();

export async function activatePlan(userId: string, plan: Plan, provider = "manual") {
  const end = new Date();
  end.setMonth(end.getMonth() + 1);
  await prisma.subscription.upsert({
    where: { userId },
    create: { userId, plan, status: "ACTIVE", currentPeriodEnd: end, paymentProvider: provider },
    update: { plan, status: "ACTIVE", currentPeriodEnd: end, paymentProvider: provider },
  });
}
