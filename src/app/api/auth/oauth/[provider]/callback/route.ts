import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { exchangeCode, OAuthProviderId } from "@/server/oauth";
import { createSession, provisionUser, setSessionCookie } from "@/server/auth";
import { env } from "@/server/env";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  const provider = params.provider as OAuthProviderId;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const expected = req.cookies.get("lp_oauth_state")?.value;
  if (!code || !state || state !== expected) {
    return NextResponse.redirect(`${env.appUrl}/login?error=oauth`);
  }
  try {
    const profile = await exchangeCode(provider, code);
    const identity = await prisma.authIdentity.findUnique({
      where: { provider_providerUid: { provider, providerUid: profile.id } },
    });
    let userId = identity?.userId;
    if (!userId) {
      const email = profile.email?.toLowerCase();
      if (email) {
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          userId = existing.id;
          await prisma.authIdentity.create({
            data: { userId, provider, providerUid: profile.id },
          });
        }
      }
      if (!userId) {
        const user = await provisionUser({
          email: email || `${provider}-${profile.id}@oauth.logoped.site`,
          name: profile.name || "Логопед",
          emailVerifiedAt: email ? new Date() : null,
          pdConsentAt: new Date(),
        });
        userId = user.id;
        await prisma.authIdentity.create({
          data: { userId, provider, providerUid: profile.id },
        });
      }
    }
    const { jwt, maxAge } = await createSession(userId);
    const res = NextResponse.redirect(`${env.appUrl}/dashboard`);
    setSessionCookie(res, jwt, maxAge);
    res.cookies.set("lp_oauth_state", "", { maxAge: 0, path: "/" });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.redirect(`${env.appUrl}/login?error=oauth`);
  }
}
