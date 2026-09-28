import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { assertImages, remainingImages } from "@/server/limits";
import { enqueueAiJob } from "@/server/queue";
import { OPPOSITE } from "@/lib/picture-prompt";
import { imageModelAvailable } from "@/server/ai/client";
import { PicturePosition, ImageSetKind } from "@prisma/client";

export const GET = withAuth(async (_req, user) => {
  const [sets, quota] = await Promise.all([
    prisma.aiImageSet.findMany({
      where: { userId: user.id },
      include: { images: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    remainingImages(user.id),
  ]);
  return NextResponse.json({ sets, quota, enabled: await imageModelAvailable() });
});

export const POST = withAuth(async (req, user) => {
  if (!(await imageModelAvailable())) {
    return NextResponse.json({ error: "Генерация изображений не настроена" }, { status: 503 });
  }
  const body = await req.json();
  const kind = (body.kind || "SOUND_CARDS") as ImageSetKind;
  const style = body.style === "color" ? "color" : "outline";
  const excludeOpposites = body.excludeOpposites !== false;
  const captions = body.captions !== false;
  const count = Math.min(8, Math.max(1, Number(body.count) || 4));
  await assertImages(user.id, 1);

  let words: { word: string; promptEn: string; descriptionRu: string }[] = [];
  if (kind === "SOUND_CARDS" || kind === "ODD_ONE" || kind === "LOTO") {
    const sound = String(body.sound || "Р");
    const position = (body.position || "START") as PicturePosition;
    const where = {
      hidden: false,
      sound,
      ...(body.position ? { position } : {}),
      OR: [{ userId: null }, { userId: user.id }],
    };
    let list = await prisma.pictureWord.findMany({ where, take: 80 });
    if (excludeOpposites) {
      const bad = new Set(OPPOSITE[sound] || []);
      list = list.filter((w) => !w.sounds.some((s) => bad.has(s)));
    }
    list = list.sort(() => Math.random() - 0.5);
    if (kind === "ODD_ONE") {
      const good = list.slice(0, 3);
      const others = await prisma.pictureWord.findMany({
        where: { hidden: false, sound: { not: sound }, OR: [{ userId: null }, { userId: user.id }] },
        take: 20,
      });
      const odd = others[Math.floor(Math.random() * others.length)];
      words = [...good, odd].filter(Boolean).map((w) => ({ word: w.word, promptEn: w.promptEn, descriptionRu: w.descriptionRu }));
    } else {
      words = list.slice(0, count).map((w) => ({ word: w.word, promptEn: w.promptEn, descriptionRu: w.descriptionRu }));
    }
    if (kind === "LOTO" && body.pairs) {
      words = words.flatMap((w) => [w, w]);
    }
  } else {
    const theme = String(body.theme || "животные");
    const themes: Record<string, { word: string; promptEn: string; descriptionRu: string }[]> = {
      животные: [
        { word: "кот", promptEn: "a house cat sitting", descriptionRu: "кот" },
        { word: "собака", promptEn: "a friendly dog", descriptionRu: "собака" },
        { word: "медведь", promptEn: "a brown bear", descriptionRu: "медведь" },
        { word: "лиса", promptEn: "a red fox", descriptionRu: "лиса" },
      ],
      овощи: [
        { word: "морковь", promptEn: "a carrot vegetable", descriptionRu: "морковь" },
        { word: "огурец", promptEn: "a cucumber", descriptionRu: "огурец" },
        { word: "капуста", promptEn: "a cabbage head", descriptionRu: "капуста" },
        { word: "помидор", promptEn: "a tomato", descriptionRu: "помидор" },
      ],
      транспорт: [
        { word: "машина", promptEn: "a passenger car", descriptionRu: "машина" },
        { word: "автобус", promptEn: "a city bus", descriptionRu: "автобус" },
        { word: "самолёт", promptEn: "an airplane", descriptionRu: "самолёт" },
        { word: "поезд", promptEn: "a passenger train", descriptionRu: "поезд" },
      ],
    };
    const pool = themes[theme] || themes.животные;
    if (kind === "STORY") {
      words = [
        {
          word: theme,
          promptEn: `a simple story scene about ${theme} for children aged ${body.age || "5-7"}, one clear composition, no text`,
          descriptionRu: theme,
        },
      ];
    } else {
      words = pool.slice(0, count);
    }
  }
  if (!words.length) return NextResponse.json({ error: "В справочнике нет подходящих слов" }, { status: 400 });
  let odd: { word: string; promptEn: string; descriptionRu: string } | null = null;
  if (kind === "SOUND_CARDS" || kind === "ODD_ONE") {
    const sound = String(body.sound || "Р");
    const others = await prisma.pictureWord.findMany({
      where: { hidden: false, sound: { not: sound }, OR: [{ userId: null }, { userId: user.id }] },
      take: 40,
    });
    const clean = others.filter((w) => !w.sounds.includes(sound) && !words.some((x) => x.word === w.word));
    const pick = clean[Math.floor(Math.random() * Math.max(clean.length, 1))];
    if (pick) odd = { word: pick.word, promptEn: pick.promptEn, descriptionRu: pick.descriptionRu };
  }
  const seed = Math.floor(Math.random() * 1_000_000);
  const title =
    kind === "ODD_ONE"
      ? "Найди лишнее"
      : kind === "LOTO"
        ? "Лото"
        : kind === "COLORING"
          ? `Раскраска: ${body.theme || ""}`
          : kind === "STORY"
            ? `Рассказ: ${body.theme || ""}`
            : `Картинки на звук [${body.sound || "Р"}]`;
  const set = await prisma.aiImageSet.create({
    data: {
      userId: user.id,
      pupilId: body.pupilId || null,
      kind,
      params: {
        style,
        captions,
        theme: body.theme,
        sound: body.sound,
        position: body.position,
        excludeOpposites,
        count,
        words,
        odd,
        age: body.age || "5–8",
        title,
        extra: String(body.extra || "").slice(0, 500),
      },
      seed,
      status: "QUEUED",
      images: {
        create: [
          {
            userId: user.id,
            word: "Лист A4",
            promptEn: title,
            status: "QUEUED",
          },
        ],
      },
    },
    include: { images: true },
  });
  await enqueueAiJob("generate-image-set", { userId: user.id, setId: set.id }, { timeout: 200_000, attempts: 1 });
  return NextResponse.json({ set });
});
