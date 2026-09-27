import { NextRequest, NextResponse } from "next/server";
import { env, isTest } from "@/server/env";
import { getMailbox } from "@/server/mail";

export async function GET(req: NextRequest) {
  if (!isTest && env.nodeEnv === "production") {
    return NextResponse.json({ error: "Недоступно" }, { status: 404 });
  }
  const to = req.nextUrl.searchParams.get("to") || undefined;
  return NextResponse.json({ items: getMailbox(to) });
}
