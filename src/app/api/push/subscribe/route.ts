import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const POST = withAuth(async (req, user) => {
  const { endpoint, keys } = await req.json();
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { p256dh: keys.p256dh, auth: keys.auth, userId: user.id },
  });
  return NextResponse.json({ ok: true });
});
