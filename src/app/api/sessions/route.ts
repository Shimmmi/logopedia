import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { prisma } from "@/server/db";
import { env } from "@/server/env";
import { requireUser, jsonError } from "@/server/auth";

const secret = () => new TextEncoder().encode(env.sessionSecret || "dev-session-secret-change");

async function currentSid() {
  const token = cookies().get("lp_session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return String(payload.sid);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const sid = await currentSid();
    const items = await prisma.session.findMany({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { lastSeenAt: "desc" },
    });
    return NextResponse.json({
      items: items.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ip: s.ip,
        lastSeenAt: s.lastSeenAt,
        current: s.tokenHash === sid,
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { id, all } = await req.json().catch(() => ({ all: true }));
    const sid = await currentSid();
    if (all) {
      await prisma.session.deleteMany({ where: { userId: user.id, tokenHash: { not: sid || "" } } });
    } else if (id) {
      await prisma.session.deleteMany({ where: { id, userId: user.id } });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
