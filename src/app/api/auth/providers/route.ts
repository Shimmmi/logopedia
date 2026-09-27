import { NextResponse } from "next/server";
import { enabledProviders } from "@/server/oauth";

export async function GET() {
  return NextResponse.json({ providers: enabledProviders() });
}
