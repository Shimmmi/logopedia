import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { jsonError } from "@/server/auth";
import { issueVerification } from "@/server/verify-email";
import { resendSchema } from "@/schemas/auth";
import { rateLimit, clientIp } from "@/server/ratelimit";

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    const { email } = resendSchema.parse(await req.json());
    const normalized = email.toLowerCase().trim();
    await rateLimit(`resend:${normalized}`, 5, 3600);
    await rateLimit(`resend-ip:${ip}`, 8, 3600);
    await rateLimit(`resend-cd:${normalized}`, 1, 60);
    const user = await prisma.user.findUnique({ where: { email: normalized } });
    if (user && !user.emailVerifiedAt) {
      const issued = await issueVerification(user.id, normalized);
      return NextResponse.json({ ok: true, devCode: issued.devCode });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
