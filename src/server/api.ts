import { NextRequest, NextResponse } from "next/server";
import { requireUser, jsonError } from "./auth";
import { User } from "@prisma/client";

type Authed = (req: NextRequest, user: User, ctx?: { params: Record<string, string> }) => Promise<NextResponse | Response>;

export function withAuth(handler: Authed) {
  return async (req: NextRequest, ctx?: { params: Record<string, string> }) => {
    try {
      const user = await requireUser(req);
      return await handler(req, user, ctx);
    } catch (e) {
      return jsonError(e);
    }
  };
}

export async function readJson<T>(req: NextRequest): Promise<T> {
  return req.json() as Promise<T>;
}
