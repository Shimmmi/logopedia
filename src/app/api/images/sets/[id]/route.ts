import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { storage } from "@/server/storage";
import { assertImages } from "@/server/limits";
import { enqueueAiJob } from "@/server/queue";

export const GET = withAuth(async (_req, user, ctx) => {
  const set = await prisma.aiImageSet.findFirst({
    where: { id: ctx!.params.id, userId: user.id },
    include: { images: true },
  });
  if (!set) return NextResponse.json({ error: "Набор не найден" }, { status: 404 });
  return NextResponse.json({
    set: {
      ...set,
      images: set.images.map((i) => ({
        ...i,
        url: i.filePath ? storage.signedUrl(i.filePath) : null,
      })),
    },
  });
});

export const POST = withAuth(async (req, user, ctx) => {
  const body = await req.json();
  const set = await prisma.aiImageSet.findFirst({ where: { id: ctx!.params.id, userId: user.id } });
  if (!set) return NextResponse.json({ error: "Набор не найден" }, { status: 404 });
  if (body.action === "regenerate") {
    await assertImages(user.id, 1);
    await prisma.aiImage.updateMany({
      where: { setId: set.id, userId: user.id },
      data: { status: "QUEUED", error: null },
    });
    await prisma.aiImageSet.update({ where: { id: set.id }, data: { status: "QUEUED" } });
    await enqueueAiJob("generate-image-set", { userId: user.id, setId: set.id }, { timeout: 200_000, attempts: 1 });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Неизвестное действие" }, { status: 400 });
});
