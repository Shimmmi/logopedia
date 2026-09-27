import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "@/server/auth";
import { prisma } from "@/server/db";
import { issueVerification } from "@/server/verify-email";

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
    if (body.action === "resend") {
      const u = await prisma.user.findUnique({ where: { id: body.userId } });
      if (u) await issueVerification(u.id, u.email);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
