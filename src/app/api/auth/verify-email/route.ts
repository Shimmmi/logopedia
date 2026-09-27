import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { jsonError, createSession, setSessionCookie } from "@/server/auth";
import { sha256 } from "@/server/encryption";
import { clientIp } from "@/server/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").toLowerCase().trim();
    const code = body.code ? String(body.code) : "";
    const token = body.token ? String(body.token) : "";
    if (!email || (!code && !token)) {
      return NextResponse.json({ error: "Укажите код или ссылку" }, { status: 400 });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
    const rec = await prisma.emailCode.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
        codeHash: sha256(token || code),
        purpose: token ? "verify-link" : "verify",
      },
      orderBy: { createdAt: "desc" },
    });
    if (!rec) return NextResponse.json({ error: "Неверный или просроченный код" }, { status: 400 });
    await prisma.$transaction([
      prisma.emailCode.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }),
    ]);
    const { jwt, maxAge } = await createSession(user.id, {
      userAgent: req.headers.get("user-agent") || undefined,
      ip: clientIp(req),
    });
    const res = NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword });
    setSessionCookie(res, jwt, maxAge);
    return res;
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Проверьте поля формы" }, { status: 400 });
    return jsonError(e);
  }
}
