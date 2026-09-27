import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { jsonError, readSession } from "@/server/auth";

export async function POST(req: Request) {
  try {
    const user = await readSession();
    const { message, page } = await req.json();
    await prisma.feedback.create({
      data: { userId: user?.id, message: String(message), page },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return jsonError(e);
  }
}
