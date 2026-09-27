import { prisma } from "./db";
import { generateImage } from "./ai/client";
import { storage } from "./storage";
import { bumpUsage } from "./limits";
import { sheetPrompt, type SheetWord } from "@/lib/picture-prompt";
import { notifyUser } from "./notify";

const SHEET_TIMEOUT_MS = 180_000;

function setWords(set: { params: unknown; images: { word: string | null; promptEn: string }[] }): SheetWord[] {
  const params = set.params as { words?: SheetWord[] };
  if (params.words?.length) return params.words;
  return set.images
    .filter((i) => i.word)
    .map((i) => ({ word: i.word as string, promptEn: i.promptEn }));
}

function titleOf(kind: string, params: { sound?: string; theme?: string }) {
  if (kind === "ODD_ONE") return "Найди лишнее";
  if (kind === "LOTO") return "Лото";
  if (kind === "COLORING") return `Раскраска: ${params.theme || ""}`.trim();
  if (kind === "STORY") return `Рассказ: ${params.theme || ""}`.trim();
  return params.sound ? `Картинки на звук [${params.sound}]` : "Картинки для занятий";
}

async function toPng(buf: Buffer) {
  const sharp = (await import("sharp")).default;
  return sharp(buf).rotate().png().toBuffer();
}

async function renderSheet(set: {
  kind: string;
  seed: number;
  params: unknown;
  images: { word: string | null; promptEn: string }[];
}) {
  const params = set.params as {
    style?: "outline" | "color";
    captions?: boolean;
    sound?: string;
    theme?: string;
    age?: string;
    title?: string;
    words?: SheetWord[];
    odd?: SheetWord | null;
  };
  const style = params.style === "color" ? "color" : "outline";
  const words = setWords(set);
  const prompt = sheetPrompt({
    kind: set.kind,
    style,
    captions: params.captions !== false,
    title: params.title || titleOf(set.kind, params),
    sound: params.sound,
    age: params.age,
    words: words.length ? words : [{ word: "предмет", promptEn: "a simple everyday object" }],
    odd: params.odd || null,
  });
  const result = await Promise.race([
    generateImage(prompt, { seed: set.seed, aspectRatio: "3:4", size: "1K" }),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), SHEET_TIMEOUT_MS)),
  ]);
  return { buffer: await toPng(result.buffer), model: result.model, prompt };
}

export async function generateImageSet(userId: string, setId: string) {
  const set = await prisma.aiImageSet.findFirst({ where: { id: setId, userId }, include: { images: true } });
  if (!set) return;
  await prisma.aiImageSet.update({ where: { id: setId }, data: { status: "RUNNING" } });
  const target = set.images[0];
  if (!target) {
    await prisma.aiImageSet.update({ where: { id: setId }, data: { status: "FAILED" } });
    return;
  }
  await prisma.aiImage.update({ where: { id: target.id }, data: { status: "RUNNING", error: null } });
  try {
    const result = await renderSheet(set);
    const saved = await storage.saveEncrypted(userId, `${setId}-a4.png`, result.buffer, "images");
    await prisma.aiImage.update({
      where: { id: target.id },
      data: {
        status: "DONE",
        filePath: saved.relativePath,
        modelUsed: result.model,
        promptEn: result.prompt,
        error: null,
        word: "Лист A4",
      },
    });
    await bumpUsage(userId, { images: 1 });
    await prisma.aiImageSet.update({ where: { id: setId }, data: { status: "DONE" } });
    await notifyUser(userId, "Лист готов", "Страница с заданиями в библиотеке", "/library");
  } catch (e) {
    const msg = (e as Error).message === "timeout" ? "Время ожидания истекло. Повторите." : (e as Error).message;
    await prisma.aiImage.update({ where: { id: target.id }, data: { status: "FAILED", error: msg } });
    await prisma.aiImageSet.update({ where: { id: setId }, data: { status: "FAILED" } });
  }
}

export async function regenerateOne(userId: string, imageId: string) {
  const img = await prisma.aiImage.findFirst({ where: { id: imageId, userId }, include: { set: { include: { images: true } } } });
  if (!img) throw Object.assign(new Error("Картинка не найдена"), { status: 404 });
  await prisma.aiImage.update({ where: { id: img.id }, data: { status: "RUNNING", error: null } });
  await prisma.aiImageSet.update({ where: { id: img.setId }, data: { status: "RUNNING" } });
  try {
    const result = await renderSheet({ ...img.set, seed: Date.now() % 1_000_000 });
    const saved = await storage.saveEncrypted(userId, `${img.setId}-a4.png`, result.buffer, "images");
    await prisma.aiImage.update({
      where: { id: img.id },
      data: {
        status: "DONE",
        filePath: saved.relativePath,
        modelUsed: result.model,
        promptEn: result.prompt,
        error: null,
        word: "Лист A4",
      },
    });
    await bumpUsage(userId, { images: 1 });
    await prisma.aiImageSet.update({ where: { id: img.setId }, data: { status: "DONE" } });
  } catch (e) {
    const msg = (e as Error).message === "timeout" ? "Время ожидания истекло. Повторите." : (e as Error).message;
    await prisma.aiImage.update({ where: { id: img.id }, data: { status: "FAILED", error: msg } });
    await prisma.aiImageSet.update({ where: { id: img.setId }, data: { status: "FAILED" } });
    throw e;
  }
  return img.id;
}
