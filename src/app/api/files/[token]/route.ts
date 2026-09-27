import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/server/storage";
import { prisma } from "@/server/db";
import { readSession } from "@/server/auth";

function inlineKind(mime: string) {
  return mime.startsWith("image/") || mime === "application/pdf";
}

function sniffMime(buf: Buffer, fallback: string) {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return fallback;
}

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const user = await readSession(req);
  if (!user) return NextResponse.json({ error: "Нет доступа" }, { status: 401 });
  const verified = storage.verifyToken(params.token);
  if (!verified) return NextResponse.json({ error: "Ссылка истекла" }, { status: 403 });
  const path = verified.value;
  if (!path.startsWith(user.id)) {
    return NextResponse.json({ error: "Нет доступа" }, { status: 403 });
  }
  const doc = await prisma.document.findFirst({ where: { filePath: path, userId: user.id } });
  const att = doc
    ? null
    : await prisma.pupilAttachment.findFirst({ where: { filePath: path, userId: user.id } });
  const img = doc || att ? null : await prisma.aiImage.findFirst({ where: { filePath: path, userId: user.id } });
  const name = doc?.fileName || att?.fileName || (img ? `${img.word || "image"}.png` : "file");
  const fallback = doc?.mimeType || att?.mimeType || (img ? "image/png" : "application/octet-stream");
  const encrypted = !!(doc?.encrypted || att?.encrypted || img);
  const buf = await storage.readMaybeEncrypted(path, encrypted);
  const mime = sniffMime(buf, fallback);
  const disposition = inlineKind(mime) ? "inline" : "attachment";
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Accept-Ranges": "none",
      "Cache-Control": "private, no-store",
    },
  });
}
