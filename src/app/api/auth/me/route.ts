import { NextRequest, NextResponse } from "next/server";
import { readSession, jsonError } from "@/server/auth";
import { getLimits, getUsage, usedStorage } from "@/server/limits";
import { env } from "@/server/env";

export async function GET(req: NextRequest) {
  try {
    const user = await readSession(req);
    if (!user) return NextResponse.json({ user: null });
    const [limits, usage, storageUsed] = await Promise.all([
      getLimits(user.id),
      getUsage(user.id),
      usedStorage(user.id),
    ]);
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        position: user.position,
        institution: user.institution,
        phone: user.phone,
        photoPath: user.photoPath,
        role: user.role,
        notifyPref: user.notifyPref,
        totpEnabled: user.totpEnabled,
        onboardingDone: user.onboardingDone,
        a11yLargeText: user.a11yLargeText,
        a11yHighContrast: user.a11yHighContrast,
        a11yReduceMotion: user.a11yReduceMotion,
        aiPmpkConsentAt: user.aiPmpkConsentAt,
        aiPmpkAutoAnalyze: user.aiPmpkAutoAnalyze,
        mustChangePassword: user.mustChangePassword,
        timezone: user.timezone,
        backupEmail: user.backupEmail,
        plan: limits.plan,
      },
      limits,
      usage,
      storageUsed,
      vapidPublic: env.vapidPublic || null,
    });
  } catch (e) {
    return jsonError(e);
  }
}
