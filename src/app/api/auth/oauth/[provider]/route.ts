import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { authorizeUrl, enabledProviders, OAuthProviderId } from "@/server/oauth";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider as OAuthProviderId;
  if (!enabledProviders().some((p) => p.id === provider)) {
    return NextResponse.json({ error: "Провайдер не настроен" }, { status: 404 });
  }
  const state = randomBytes(16).toString("hex");
  const url = authorizeUrl(provider, state);
  const res = NextResponse.redirect(url);
  res.cookies.set("lp_oauth_state", state, { httpOnly: true, maxAge: 600, path: "/" });
  return res;
}
