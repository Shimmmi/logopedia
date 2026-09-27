import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { storage } from "@/server/storage";
import { buildPagePdf } from "@/server/pdf-sheet";

export const GET = withAuth(async (_req, user, ctx) => {
  const set = await prisma.aiImageSet.findFirst({
    where: { id: ctx!.params.id, userId: user.id },
    include: { images: true },
  });
  if (!set) return NextResponse.json({ error: "Набор не найден" }, { status: 404 });
  const img = set.images.find((i) => i.filePath);
  if (!img?.filePath) return NextResponse.json({ error: "Лист ещё не готов" }, { status: 409 });
  const image = await storage.readMaybeEncrypted(img.filePath, true);
  const buf = await buildPagePdf(image);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="list-a4.pdf"',
    },
  });
});
