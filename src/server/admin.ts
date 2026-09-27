import { randomBytes } from "crypto";
import { prisma } from "./db";
import { env } from "./env";
import { hashPassword, provisionUser } from "./auth";

export async function ensureAdmin() {
  const email = env.adminEmail.toLowerCase().trim();
  if (!email) return;
  const existing = await prisma.user.findUnique({ where: { email } });
  const password = env.adminPassword || randomBytes(15).toString("base64url").slice(0, 20);
  if (!existing) {
    const user = await provisionUser({
      email,
      name: "Администратор",
      passwordHash: await hashPassword(password),
      emailVerifiedAt: new Date(),
      pdConsentAt: new Date(),
      role: "ADMIN",
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { mustChangePassword: true },
    });
    await prisma.subscription.update({
      where: { userId: user.id },
      data: {
        plan: "PREMIUM",
        status: "ACTIVE",
        currentPeriodEnd: new Date(Date.now() + 10 * 365 * 86400000),
      },
    });
    console.log(`[admin] created ${email}`);
    if (!env.adminPassword) console.log(`[admin] generated password: ${password}`);
    return { email, password: env.adminPassword ? undefined : password };
  }
  const patch: Record<string, unknown> = {
    role: "ADMIN",
    emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
  };
  if (env.adminPassword) {
    patch.passwordHash = await hashPassword(env.adminPassword);
  }
  await prisma.user.update({ where: { id: existing.id }, data: patch });
  await prisma.subscription.upsert({
    where: { userId: existing.id },
    create: {
      userId: existing.id,
      plan: "PREMIUM",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 10 * 365 * 86400000),
    },
    update: {
      plan: "PREMIUM",
      status: "ACTIVE",
      currentPeriodEnd: new Date(Date.now() + 10 * 365 * 86400000),
    },
  });
  console.log(`[admin] ensured ${email}`);
  return { email };
}
