import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { activatePlan } from "@/server/payments";
import { Plan } from "@prisma/client";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const obj = body.object ?? body;
  const id = obj.id as string | undefined;
  const status = obj.status as string | undefined;
  const meta = obj.metadata ?? {};
  if (!id) return NextResponse.json({ ok: true });
  const payment = await prisma.payment.findFirst({ where: { providerId: id } });
  if (!payment) return NextResponse.json({ ok: true });
  if (status === "succeeded") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "SUCCEEDED" } });
    await activatePlan(payment.userId, (meta.plan as Plan) || payment.plan, "yookassa");
  } else if (status === "canceled") {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "CANCELED" } });
  }
  return NextResponse.json({ ok: true });
}
