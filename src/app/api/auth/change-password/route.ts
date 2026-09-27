import { NextRequest, NextResponse } from "next/server";
import { requireUser, hashPassword, verifyPassword, passwordOk, jsonError } from "@/server/auth";
import { prisma } from "@/server/db";
import { changePasswordSchema } from "@/schemas/auth";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const { currentPassword, password } = changePasswordSchema.parse(await req.json());
    if (!passwordOk(password)) {
      return NextResponse.json({ error: "Пароль: минимум 8 символов, буквы и цифра" }, { status: 400 });
    }
    if (!user.mustChangePassword) {
      if (!currentPassword || !user.passwordHash || !(await verifyPassword(user.passwordHash, currentPassword))) {
        return NextResponse.json({ error: "Неверный текущий пароль" }, { status: 400 });
      }
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), mustChangePassword: false },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
