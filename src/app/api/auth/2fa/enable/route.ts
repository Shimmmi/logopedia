import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const POST = withAuth(async (req: NextRequest, user) => {
  const { code } = await req.json();
  const u = await prisma.user.findUnique({ where: { id: user.id } });
  if (!u?.totpSecret || !authenticator.check(String(code), u.totpSecret)) {
    return NextResponse.json({ error: "Неверный код" }, { status: 400 });
  }
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabled: true } });
  return NextResponse.json({ ok: true });
});
