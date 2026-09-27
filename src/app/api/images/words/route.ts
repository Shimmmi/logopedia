import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { PicturePosition } from "@prisma/client";

export const GET = withAuth(async (req, user) => {
  const q = req.nextUrl.searchParams;
  const sound = q.get("sound") || undefined;
  const words = await prisma.pictureWord.findMany({
    where: {
      hidden: q.get("hidden") === "1" ? undefined : false,
      sound,
      OR: [{ userId: null }, { userId: user.id }],
    },
    orderBy: [{ sound: "asc" }, { word: "asc" }],
  });
  return NextResponse.json({ words });
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  if (!body.word || !body.sound || !body.promptEn) {
    return NextResponse.json({ error: "Укажите слово, звук и английское описание" }, { status: 400 });
  }
  const word = await prisma.pictureWord.create({
    data: {
      userId: user.id,
      word: String(body.word).trim(),
      sound: String(body.sound),
      position: (body.position || "START") as PicturePosition,
      syllables: Number(body.syllables) || 1,
      ageFrom: Number(body.ageFrom) || 5,
      promptEn: String(body.promptEn),
      descriptionRu: String(body.descriptionRu || body.word),
      sounds: Array.isArray(body.sounds) ? body.sounds : [body.sound],
      verified: false,
      isSystem: false,
    },
  });
  return NextResponse.json({ word });
});
