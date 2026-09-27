import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie, jsonError, readSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { sha256 } from "@/server/encryption";
import { jwtVerify } from "jose";
import { env } from "@/server/env";

export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get("lp_session")?.value;
    if (token) {
      try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(env.sessionSecret));
        await prisma.session.deleteMany({ where: { tokenHash: String(payload.sid) } });
      } catch {
        /* ignore */
      }
    }
    await readSession(req);
    const res = NextResponse.json({ ok: true });
    clearSessionCookie(res);
    return res;
  } catch (e) {
    return jsonError(e);
  }
}
