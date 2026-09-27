import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { pupilOwned } from "@/server/pupils";

export const POST = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const { toUserEmail } = await req.json();
  const dest = await prisma.user.findUnique({ where: { email: String(toUserEmail).toLowerCase() } });
  if (!dest) return NextResponse.json({ error: "Получатель не найден" }, { status: 404 });
  await prisma.pupil.update({ where: { id }, data: { userId: dest.id } });
  return NextResponse.json({ ok: true });
});
