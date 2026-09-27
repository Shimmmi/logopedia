import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { hashPassword, passwordOk, provisionUser, jsonError } from "@/server/auth";
import { issueVerification } from "@/server/verify-email";
import { registerSchema } from "@/schemas/auth";
import { rateLimit, clientIp } from "@/server/ratelimit";

export async function POST(req: NextRequest) {
  try {
    await rateLimit(`register:${clientIp(req)}`, 8, 3600);
    const body = registerSchema.parse(await req.json());
    if (!passwordOk(body.password)) {
      return NextResponse.json({ error: "Пароль: минимум 8 символов, буквы и цифра" }, { status: 400 });
    }
    const email = body.email.toLowerCase().trim();
    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) {
      return NextResponse.json({ error: "Этот email уже зарегистрирован" }, { status: 409 });
    }
    const user = await provisionUser({
      email,
      name: body.name,
      institution: body.institution,
      passwordHash: await hashPassword(body.password),
      pdConsentAt: new Date(),
      timezone: body.timezone,
    });
    if (body.position) {
      await prisma.user.update({ where: { id: user.id }, data: { position: body.position } });
    }
    const issued = await issueVerification(user.id, email);
    return NextResponse.json({
      ok: true,
      userId: user.id,
      devCode: issued.devCode,
    });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message || "Проверьте поля формы" }, { status: 400 });
    }
    return jsonError(e);
  }
}
