import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { hashPassword, passwordOk, jsonError } from "@/server/auth";
import { sha256 } from "@/server/encryption";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = z
      .object({ token: z.string(), password: z.string() })
      .parse(await req.json());
    if (!passwordOk(password)) {
      return NextResponse.json({ error: "Пароль слишком простой" }, { status: 400 });
    }
    const rec = await prisma.passwordReset.findUnique({ where: { tokenHash: sha256(token) } });
    if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
      return NextResponse.json({ error: "Ссылка недействительна" }, { status: 400 });
    }
    await prisma.$transaction([
      prisma.passwordReset.update({ where: { id: rec.id }, data: { usedAt: new Date() } }),
      prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await hashPassword(password) } }),
      prisma.session.deleteMany({ where: { userId: rec.userId } }),
    ]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
