import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import { z } from "zod";
import { prisma } from "@/server/db";
import { verifyPassword, createSession, setSessionCookie, jsonError } from "@/server/auth";
import { loginSchema } from "@/schemas/auth";
import { rateLimit, clientIp } from "@/server/ratelimit";
import { sha256 } from "@/server/encryption";
import { A11Y_COOKIE, a11yCookieValue } from "@/lib/a11y";

export async function POST(req: NextRequest) {
  try {
    await rateLimit(`login:${clientIp(req)}`, 20, 900);
    const { email, password, totp, remember } = loginSchema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || user.deletedAt || !user.passwordHash) {
      return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
    }
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
    if (!user.emailVerifiedAt) {
      return NextResponse.json({ error: "Подтвердите email", needVerify: true }, { status: 403 });
    }
    if (user.totpEnabled) {
      const codeOk =
        (totp && user.totpSecret && authenticator.check(totp, user.totpSecret)) ||
        (totp &&
          (await prisma.totpBackupCode.findFirst({
            where: { userId: user.id, usedAt: null, codeHash: sha256(totp) },
          })));
      if (!totp) return NextResponse.json({ error: "Введите код 2FA", needTotp: true }, { status: 401 });
      if (!codeOk) return NextResponse.json({ error: "Неверный код 2FA" }, { status: 401 });
      if (totp && !authenticator.check(totp, user.totpSecret || "")) {
        await prisma.totpBackupCode.updateMany({
          where: { userId: user.id, codeHash: sha256(totp), usedAt: null },
          data: { usedAt: new Date() },
        });
      }
    }
    const { jwt, maxAge } = await createSession(user.id, {
      remember: remember !== false,
      userAgent: req.headers.get("user-agent") || undefined,
      ip: clientIp(req),
    });
    const res = NextResponse.json({
      ok: true,
      mustChangePassword: user.mustChangePassword,
    });
    setSessionCookie(res, jwt, maxAge);
    res.cookies.set(A11Y_COOKIE, a11yCookieValue(user), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      httpOnly: false,
    });
    return res;
  } catch (e) {
    if (e instanceof z.ZodError) return NextResponse.json({ error: "Проверьте поля формы" }, { status: 400 });
    return jsonError(e);
  }
}
