import { NextRequest, NextResponse } from "next/server";
import { authenticator } from "otplib";
import QRCode from "qrcode";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const POST = withAuth(async (_req: NextRequest, user) => {
  const secret = authenticator.generateSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: secret } });
  const otpauth = authenticator.keyuri(user.email, "LogoPed", secret);
  const qr = await QRCode.toDataURL(otpauth);
  return NextResponse.json({ secret, qr });
});
