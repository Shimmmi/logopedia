import { createCipheriv, createDecipheriv, randomBytes, createHash, createHmac, timingSafeEqual } from "crypto";
import { env } from "./env";

function key(): Buffer {
  const raw = env.encryptionKey || "dev-insecure-key-please-change-now-32b";
  return createHash("sha256").update(raw).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

const FILE_MAGIC = Buffer.from("LP1");

export function encryptBuffer(data: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([FILE_MAGIC, iv, tag, enc]);
}

export function isEncryptedFile(data: Buffer): boolean {
  return data.length >= 3 && data.subarray(0, 3).equals(FILE_MAGIC);
}

export function decryptBuffer(data: Buffer): Buffer {
  if (!isEncryptedFile(data)) return data;
  const iv = data.subarray(3, 15);
  const tag = data.subarray(15, 31);
  const payload = data.subarray(31);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]);
}

export function decrypt(payload: string | null | undefined): string | null {
  if (!payload) return null;
  try {
    const buf = Buffer.from(payload, "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacSign(value: string, ttlSec = 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${value}.${exp}`;
  const sig = createHmac("sha256", key()).update(payload).digest("hex");
  return Buffer.from(`${payload}.${sig}`).toString("base64url");
}

export function hmacVerify(token: string): { value: string; exp: number } | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const lastDot = decoded.lastIndexOf(".");
    const payload = decoded.slice(0, lastDot);
    const sig = decoded.slice(lastDot + 1);
    const expected = createHmac("sha256", key()).update(payload).digest("hex");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const expDot = payload.lastIndexOf(".");
    const value = payload.slice(0, expDot);
    const expStr = payload.slice(expDot + 1);
    const exp = Number(expStr);
    if (!value || !exp || exp < Math.floor(Date.now() / 1000)) return null;
    return { value, exp };
  } catch {
    return null;
  }
}
