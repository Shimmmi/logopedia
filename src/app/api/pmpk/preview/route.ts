import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { storage } from "@/server/storage";
import { assertAnalysis, assertStorage, LimitError } from "@/server/limits";
import { enqueueAiJob } from "@/server/queue";

const ACCEPT = /\.(pdf|docx|jpe?g|png)$/i;
const MAX = 25 * 1024 * 1024;

type UploadFile = { name: string; size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer> };

function asUpload(value: FormDataEntryValue | null): UploadFile | null {
  if (!value || typeof value === "string") return null;
  const file = value as Partial<UploadFile>;
  if (typeof file.name !== "string" || typeof file.size !== "number" || typeof file.arrayBuffer !== "function") return null;
  return { name: file.name, size: file.size, type: typeof file.type === "string" ? file.type : "", arrayBuffer: file.arrayBuffer.bind(value) };
}

export const POST = withAuth(async (req, user) => {
  const form = await req.formData();
  const file = asUpload(form.get("file"));
  if (!file) return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Файл больше 25 МБ" }, { status: 400 });
  if (!ACCEPT.test(file.name)) {
    return NextResponse.json({ error: "Анализ доступен для PDF, DOCX и фото" }, { status: 400 });
  }
  try {
    await assertStorage(user.id, file.size);
    await assertAnalysis(user.id);
  } catch (e) {
    if (e instanceof LimitError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const stored = await storage.saveEncrypted(user.id, file.name, buf, "pmpk-draft");
  const draft = await prisma.pmpkDraft.create({
    data: {
      userId: user.id,
      filePath: stored.relativePath,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      encrypted: true,
      analysisStatus: "QUEUED",
    },
  });
  await enqueueAiJob("analyze-pmpk-draft", { userId: user.id, draftId: draft.id }, { attempts: 1 });
  return NextResponse.json({ id: draft.id });
});
