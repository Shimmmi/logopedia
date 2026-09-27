import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { randomInt, randomBytes } from "crypto";
import { prisma } from "./db";
import { env } from "./env";
import { sha256 } from "./encryption";
import { SYSTEM_FOLDERS, TAG_COLORS } from "@/lib/utils";
import { Role } from "@prisma/client";

const COOKIE = "lp_session";
const secret = () => new TextEncoder().encode(env.sessionSecret || "dev-session-secret-change");

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(hash: string, password: string) {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

export function passwordOk(password: string) {
  return password.length >= 8 && /[0-9]/.test(password) && /[A-Za-zА-Яа-я]/.test(password);
}

export function randomCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export async function createSession(
  userId: string,
  opts?: { remember?: boolean; userAgent?: string; ip?: string }
) {
  const raw = randomBytes(32).toString("hex");
  const tokenHash = sha256(raw);
  const days = opts?.remember === false ? 1 : 30;
  const expiresAt = new Date(Date.now() + days * 24 * 3600 * 1000);
  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: opts?.userAgent?.slice(0, 300),
      ip: opts?.ip,
      lastSeenAt: new Date(),
    },
  });
  const jwt = await new SignJWT({ uid: userId, sid: tokenHash })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${days}d`)
    .sign(secret());
  return { jwt, maxAge: days * 24 * 3600 };
}

export function setSessionCookie(res: NextResponse, jwt: string, maxAge = 30 * 24 * 3600) {
  res.cookies.set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https"),
    path: "/",
    maxAge,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export async function readSession(req?: NextRequest) {
  const token = req ? req.cookies.get(COOKIE)?.value : cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const uid = String(payload.uid);
    const sid = String(payload.sid);
    const session = await prisma.session.findUnique({ where: { tokenHash: sid } });
    if (!session || session.expiresAt < new Date() || session.userId !== uid) return null;
    if (Date.now() - session.lastSeenAt.getTime() > 10 * 60_000) {
      await prisma.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
    }
    const user = await prisma.user.findFirst({
      where: { id: uid, deletedAt: null },
      include: { subscription: true },
    });
    return user;
  } catch {
    return null;
  }
}

export async function requireUser(req?: NextRequest) {
  const user = await readSession(req);
  if (!user) {
    throw new AuthError("Требуется вход", 401);
  }
  return user;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status = 401
  ) {
    super(message);
  }
}

export async function provisionUser(params: {
  email: string;
  name: string;
  institution?: string;
  passwordHash?: string;
  emailVerifiedAt?: Date | null;
  pdConsentAt?: Date | null;
  role?: Role;
  timezone?: string;
}) {
  const user = await prisma.user.create({
    data: {
      email: params.email.toLowerCase().trim(),
      name: params.name,
      institution: params.institution ?? "",
      passwordHash: params.passwordHash,
      emailVerifiedAt: params.emailVerifiedAt ?? null,
      pdConsentAt: params.pdConsentAt ?? null,
      role: params.role ?? "SPEECH_THERAPIST",
      timezone: params.timezone || "Europe/Moscow",
      subscription: { create: { plan: "FREE", status: "ACTIVE" } },
    },
  });

  await prisma.folder.createMany({
    data: SYSTEM_FOLDERS.map((name) => ({ userId: user.id, name, isSystem: true })),
  });

  const presets: { name: string; category: "DIAGNOSIS" | "DIRECTION" | "ORGANIZATIONAL"; color: string }[] = [
    { name: "ТНР", category: "DIAGNOSIS", color: TAG_COLORS.DIAGNOSIS },
    { name: "ЗПР", category: "DIAGNOSIS", color: TAG_COLORS.DIAGNOSIS },
    { name: "УО", category: "DIAGNOSIS", color: TAG_COLORS.DIAGNOSIS },
    { name: "РАС", category: "DIAGNOSIS", color: TAG_COLORS.DIAGNOSIS },
    { name: "ОНР I", category: "DIAGNOSIS", color: TAG_COLORS.DIAGNOSIS },
    { name: "ОНР II", category: "DIAGNOSIS", color: TAG_COLORS.DIAGNOSIS },
    { name: "ОНР III", category: "DIAGNOSIS", color: TAG_COLORS.DIAGNOSIS },
    { name: "ФФНР", category: "DIAGNOSIS", color: TAG_COLORS.DIAGNOSIS },
    { name: "Постановка [Р]", category: "DIRECTION", color: TAG_COLORS.DIRECTION },
    { name: "Автоматизация [Ш]", category: "DIRECTION", color: TAG_COLORS.DIRECTION },
    { name: "Дисграфия", category: "DIRECTION", color: TAG_COLORS.DIRECTION },
    { name: "Дислексия", category: "DIRECTION", color: TAG_COLORS.DIRECTION },
    { name: "ЗРР", category: "DIRECTION", color: TAG_COLORS.DIRECTION },
    { name: "Группа", category: "ORGANIZATIONAL", color: TAG_COLORS.ORGANIZATIONAL },
    { name: "Индивидуально", category: "ORGANIZATIONAL", color: TAG_COLORS.ORGANIZATIONAL },
    { name: "ПМПК пройдено", category: "ORGANIZATIONAL", color: TAG_COLORS.ORGANIZATIONAL },
    { name: "ПМПК ожидается", category: "ORGANIZATIONAL", color: TAG_COLORS.ORGANIZATIONAL },
  ];
  await prisma.tag.createMany({ data: presets.map((t) => ({ ...t, userId: user.id })) });

  const days = [1, 2, 3, 4, 5];
  await prisma.workingHours.createMany({
    data: days.map((weekday) => ({
      userId: user.id,
      weekday,
      startMin: 9 * 60,
      endMin: 18 * 60,
      bufferMinutes: 10,
    })),
  });

  return user;
}

export function jsonError(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  const status = (err as { status?: number }).status;
  if (typeof status === "number") {
    return NextResponse.json({ error: (err as Error).message }, { status });
  }
  console.error(err);
  return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
}
