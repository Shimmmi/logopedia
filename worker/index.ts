import { Worker, Queue } from "bullmq";
import IORedis from "ioredis";
import { prisma } from "../src/server/db";
import { mailer } from "../src/server/mail";
import { notifyUser } from "../src/server/notify";
import { env } from "../src/server/env";
import { expandEvent } from "../src/server/schedule";
import { chatText, imageModelAvailable } from "../src/server/ai/client";
import { promptDocAnalysis, promptLessonSummary, promptPronunciation, SYSTEM_LOGOPED } from "../src/server/ai/prompts";
import { getStt } from "../src/server/stt";
import { bumpUsage, assertAnalysis } from "../src/server/limits";
import { storage } from "../src/server/storage";
import { extractText } from "../src/server/extract";
import { analyzePmpk, analyzePmpkDraft } from "../src/server/pmpk-analyze";
import { analyzeSchoolFile } from "../src/server/school";
import { generateImageSet } from "../src/server/images";
import { ocrAvailable } from "../src/server/ocr";

const connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });

new Worker(
  "mail",
  async (job) => {
    await mailer.send(job.data);
  },
  { connection }
);

new Worker(
  "ai",
  async (job) => {
    const { userId } = job.data as { userId: string };
    if (job.name === "analyze-doc") {
      const { documentId } = job.data as { documentId: string };
      const doc = await prisma.document.findFirst({ where: { id: documentId, userId } });
      if (!doc) return;
      await assertAnalysis(userId);
      let text = doc.contentText || "";
      if (!text) {
        const buf = await storage.read(doc.filePath);
        text = await extractText(buf, doc.mimeType, doc.fileName);
        await prisma.document.update({ where: { id: doc.id }, data: { contentText: text } });
      }
      const { content, tokens, model, cost } = await chatText(userId, SYSTEM_LOGOPED, promptDocAnalysis(text));
      const analysis = await prisma.aiAnalysis.create({
        data: {
          userId,
          sourceType: "DOC",
          sourceId: documentId,
          modelUsed: model,
          resultJson: tryJson(content),
        },
      });
      await bumpUsage(userId, { tokens, analyses: 1, costRub: typeof cost === "number" ? cost : 10 });
      await notifyUser(userId, "Анализ документа готов", doc.fileName, `/documents?id=${doc.id}`);
      return analysis.id;
    }
    if (job.name === "analyze-pmpk") {
      const { attachmentId } = job.data as { attachmentId: string };
      return analyzePmpk(userId, attachmentId);
    }
    if (job.name === "analyze-pmpk-draft") {
      const { draftId } = job.data as { draftId: string };
      return analyzePmpkDraft(userId, draftId);
    }
    if (job.name === "analyze-school") {
      const { attachmentId, pupilId } = job.data as { attachmentId: string; pupilId: string };
      return analyzeSchoolFile(userId, pupilId, attachmentId);
    }
    if (job.name === "generate-image-set") {
      const { setId } = job.data as { setId: string };
      return generateImageSet(userId, setId);
    }
    if (job.name === "analyze-audio") {
      const { attachmentId, premium } = job.data as { attachmentId: string; premium?: boolean };
      const att = await prisma.pupilAttachment.findFirst({ where: { id: attachmentId, userId } });
      if (!att) return;
      const minutes = Math.max(1, att.sizeBytes / 32000 / 60);
      await assertAnalysis(userId, minutes);
      const buf = await storage.read(att.filePath);
      const transcript = await getStt().transcribe(buf, att.fileName, att.mimeType);
      const summary = await chatText(userId, SYSTEM_LOGOPED, promptLessonSummary(transcript));
      let pronunciation = null;
      if (premium) {
        const p = await chatText(userId, SYSTEM_LOGOPED, promptPronunciation(transcript));
        pronunciation = tryJson(p.content);
      }
      await prisma.aiAnalysis.create({
        data: {
          userId,
          sourceType: "AUDIO",
          sourceId: attachmentId,
          modelUsed: summary.model,
          resultJson: { transcript, summary: summary.content, pronunciation },
        },
      });
      await bumpUsage(userId, {
        tokens: summary.tokens,
        analyses: 1,
        audioMin: minutes,
        costRub: typeof summary.cost === "number" ? summary.cost : 10,
      });
      await notifyUser(userId, "Анализ аудио готов", att.fileName, `/pupils/${att.pupilId}`);
    }
  },
  { connection, lockDuration: 200_000 }
);

new Worker(
  "maintenance",
  async (job) => {
    if (job.name === "purge-trash") {
      const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000);
      const dead = await prisma.document.findMany({ where: { deletedAt: { lte: cutoff } } });
      for (const d of dead) {
        await storage.remove(d.filePath);
        await prisma.document.delete({ where: { id: d.id } });
      }
    }
    if (job.name === "pmpk-reminders") {
      const soon = new Date();
      soon.setDate(soon.getDate() + 14);
      const pupils = await prisma.pupil.findMany({
        where: { pmpkNextAt: { lte: soon, gte: new Date() } },
      });
      for (const p of pupils) {
        await notifyUser(
          p.userId,
          "Приближается срок ПМПК",
          `${p.fullName}: повторная диагностика/ПМПК`,
          `/pupils/${p.id}`
        );
      }
    }
  },
  { connection }
);

async function sendReminders(minutes: number) {
  const from = new Date(Date.now() + (minutes - 2) * 60_000);
  const to = new Date(Date.now() + (minutes + 3) * 60_000);
  const events = await prisma.scheduleEvent.findMany({
    where: { status: "SCHEDULED" },
    include: { exceptions: true, pupils: { include: { pupil: true } } },
  });
  for (const ev of events) {
    const occs = expandEvent(ev, from, to);
    for (const o of occs) {
      if (o.status !== "SCHEDULED") continue;
      await notifyUser(
        ev.userId,
        `Занятие через ${minutes} мин`,
        `${o.title} · ${o.start.toLocaleTimeString("ru-RU")}`,
        "/schedule"
      );
    }
  }
}

async function morningDigest() {
  const users = await prisma.user.findMany({ where: { deletedAt: null, notifyPref: "EMAIL" } });
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  for (const u of users) {
    const events = await prisma.scheduleEvent.findMany({
      where: { userId: u.id, status: { not: "CANCELED" } },
      include: { exceptions: true, pupils: { include: { pupil: true } } },
    });
    const today = events.flatMap((e) => expandEvent(e, start, end));
    if (!today.length) continue;
    const lines = today
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((o) => `${o.start.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })} — ${o.title}`)
      .join("\n");
    await mailer.send({
      to: u.email,
      subject: "Сводка занятий на сегодня — LogoPed",
      text: lines,
    });
  }
}

const reminders = new Queue("reminders-repeat", { connection });

async function setupRepeats() {
  await reminders.obliterate({ force: true }).catch(() => undefined);
  new Worker(
    "reminders-repeat",
    async (job) => {
      if (job.name === "r30") await sendReminders(30);
      if (job.name === "r60") await sendReminders(60);
      if (job.name === "digest") await morningDigest();
      if (job.name === "trash") {
        await new Queue("maintenance", { connection }).add("purge-trash", {});
      }
      if (job.name === "pmpk") {
        await new Queue("maintenance", { connection }).add("pmpk-reminders", {});
      }
    },
    { connection }
  );

  await reminders.add("r30", {}, { repeat: { every: 60_000 } });
  await reminders.add("r60", {}, { repeat: { every: 60_000 } });
  await reminders.add("digest", {}, { repeat: { pattern: "0 7 * * *", tz: "Europe/Moscow" } });
  await reminders.add("trash", {}, { repeat: { pattern: "0 3 * * *", tz: "Europe/Moscow" } });
  await reminders.add("pmpk", {}, { repeat: { pattern: "0 8 * * *", tz: "Europe/Moscow" } });
}

function tryJson(s: string) {
  try {
    const m = s.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { text: s };
  } catch {
    return { text: s };
  }
}

setupRepeats()
  .then(async () => {
    const ocr = await ocrAvailable();
    if (!ocr) console.warn("pdftoppm not found — OCR for PMPK scans is unavailable");
    const images = await imageModelAvailable();
    if (!images) console.warn("image model is not available");
    console.log("LogoPed worker started");
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
