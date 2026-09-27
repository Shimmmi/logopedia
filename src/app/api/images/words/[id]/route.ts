import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";

export const PATCH = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  const word = await prisma.pictureWord.findFirst({
    where: { id, OR: [{ userId: user.id }, { userId: null, isSystem: true }] },
  });
  if (!word) return NextResponse.json({ error: "Не найдено" }, { status: 404 });
  const body = await req.json();
  if (word.userId !== user.id && word.isSystem) {
    const copy = await prisma.pictureWord.create({
      data: {
        userId: user.id,
        word: word.word,
        sound: word.sound,
        position: word.position,
        syllables: word.syllables,
        ageFrom: word.ageFrom,
        promptEn: word.promptEn,
        descriptionRu: word.descriptionRu,
        sounds: word.sounds,
        verified: word.verified,
        hidden: body.hidden ?? word.hidden,
        isSystem: false,
      },
    });
    return NextResponse.json({ word: copy });
  }
  const updated = await prisma.pictureWord.update({
    where: { id },
    data: {
      hidden: body.hidden,
      verified: body.verified,
      promptEn: body.promptEn,
      descriptionRu: body.descriptionRu,
    },
  });
  return NextResponse.json({ word: updated });
});
