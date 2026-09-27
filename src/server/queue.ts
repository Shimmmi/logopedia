import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

let connection: IORedis | null = null;
let q: {
  mail: Queue;
  reminders: Queue;
  ai: Queue;
  maintenance: Queue;
} | null = null;

export function getRedis() {
  if (!connection) {
    connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function getQueues() {
  if (!q) {
    const connection = getRedis();
    q = {
      mail: new Queue("mail", { connection }),
      reminders: new Queue("reminders", { connection }),
      ai: new Queue("ai", { connection }),
      maintenance: new Queue("maintenance", { connection }),
    };
  }
  return q;
}

export async function enqueueAiJob(name: string, data: Record<string, unknown>, opts?: { timeout?: number; attempts?: number }) {
  return getQueues().ai.add(name, data, {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: opts?.attempts ?? 2,
    backoff: { type: "exponential", delay: 4000 },
  });
}

export async function enqueueMail(data: { to: string; subject: string; text: string; html?: string }) {
  return getQueues().mail.add("send", data, {
    removeOnComplete: 200,
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}
