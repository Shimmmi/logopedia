import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { prisma } from "@/server/db";
import { sha256 } from "@/server/encryption";
import { sendResetEmail } from "@/server/mail";
import { env } from "@/server/env";
import { jsonError } from "@/server/auth";
import { rateLimit, clientIp } from "@/server/ratelimit";

export async function POST(req: NextRequest) {
  try {
    await rateLimit(`forgot:${clientIp(req)}`, 8, 3600);
    const { email } = z.object({ email: z.string().email() }).parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (user) {
      const raw = randomBytes(32).toString("hex");
      await prisma.passwordReset.create({
        data: {
          userId: user.id,
          tokenHash: sha256(raw),
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
      try {
        await sendResetEmail(user.email, `${env.appUrl}/reset?token=${raw}`);
      } catch {
        return NextResponse.json({ error: "Сервис почты недоступен. Попробуйте позже." }, { status: 503 });
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
