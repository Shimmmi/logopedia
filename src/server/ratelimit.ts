import { getRedis } from "./queue";

export async function rateLimit(key: string, limit: number, windowSec: number) {
  const redis = getRedis();
  const k = `rl:${key}`;
  const n = await redis.incr(k);
  if (n === 1) await redis.expire(k, windowSec);
  const ttl = await redis.ttl(k);
  if (n > limit) {
    const err = Object.assign(new Error("Слишком много попыток. Подождите минуту."), { status: 429, retryAfter: ttl });
    throw err;
  }
  return { remaining: Math.max(0, limit - n), reset: ttl };
}

export function clientIp(req: { headers: Headers }) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "0.0.0.0";
}
