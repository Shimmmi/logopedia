import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { getLimits, getUsage, usedStorage } from "@/server/limits";

export const GET = withAuth(async (_req, user) => {
  const [limits, usage, storageUsed] = await Promise.all([
    getLimits(user.id),
    getUsage(user.id),
    usedStorage(user.id),
  ]);
  return NextResponse.json({ limits, usage, storageUsed });
});
