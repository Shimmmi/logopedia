import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { pupilOwned } from "@/server/pupils";
import { storage } from "@/server/storage";
import { assertAnalysis, assertStorage, LimitError } from "@/server/limits";
import { enqueueAiJob } from "@/server/queue";
import { audit } from "@/server/audit";

type UploadFile = { name: string; size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer> };

function asUpload(value: FormDataEntryValue | null): UploadFile | null {
  if (!value || typeof value === "string") return null;
  const file = value as Partial<UploadFile>;
  if (typeof file.name !== "string" || typeof file.size !== "number" || typeof file.arrayBuffer !== "function") return null;
  return { name: file.name, size: file.size, type: typeof file.type === "string" ? file.type : "", arrayBuffer: file.arrayBuffer.bind(value) };
}

const ACCEPT = /\.(pdf|docx?|jpe?g|png)$/i;
const ANALYZE = /\.(pdf|docx|jpe?g|png)$/i;
const MAX = 25 * 1024 * 1024;

export const POST = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const form = await req.formData();
  const raw = form.get("file");
  const file = asUpload(raw);
  if (!file) return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Файл больше 25 МБ" }, { status: 400 });
  if (!ACCEPT.test(file.name)) {
    return NextResponse.json({ error: "Допустимы PDF, DOC, DOCX, JPEG и PNG" }, { status: 400 });
  }
  try {
    await assertStorage(user.id, file.size);
  } catch (e) {
    if (e instanceof LimitError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const analyze = form.get("analyze") !== "0" && ANALYZE.test(file.name);
  let canAnalyze = analyze;
  if (analyze) {
    try {
      await assertAnalysis(user.id);
    } catch (e) {
      if (e instanceof LimitError) canAnalyze = false;
      else throw e;
    }
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const stored = await storage.saveEncrypted(user.id, file.name, buf, "pmpk");
  const old = await prisma.pupilAttachment.findMany({ where: { pupilId: id, fileType: "PMPK" } });
  for (const a of old) await storage.remove(a.filePath);
  if (old.length) await prisma.pupilAttachment.deleteMany({ where: { pupilId: id, fileType: "PMPK" } });
  const att = await prisma.pupilAttachment.create({
    data: {
      pupilId: id,
      userId: user.id,
      filePath: stored.relativePath,
      fileName: file.name,
      fileType: "PMPK",
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      encrypted: true,
      analysisStatus: canAnalyze ? "QUEUED" : "NONE",
    },
  });
  if (canAnalyze) {
    await enqueueAiJob("analyze-pmpk", { userId: user.id, attachmentId: att.id, pupilId: id }, { attempts: 2 });
  }
  await audit({ userId: user.id, action: "pmpk_upload", entity: "pupil", entityId: id, meta: { fileName: file.name, analyze: canAnalyze } });
  return NextResponse.json({
    attachment: { ...att, url: storage.signedUrl(att.filePath) },
    analyze: canAnalyze,
    analyzeSkipped: analyze && !canAnalyze ? "Лимит анализов исчерпан. Файл сохранён." : null,
  });
});

export const DELETE = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const atts = await prisma.pupilAttachment.findMany({ where: { pupilId: id, fileType: "PMPK" } });
  for (const a of atts) await storage.remove(a.filePath);
  await prisma.pupilAttachment.deleteMany({ where: { pupilId: id, fileType: "PMPK" } });
  return NextResponse.json({ ok: true });
});
