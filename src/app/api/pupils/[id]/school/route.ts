import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { pupilOwned } from "@/server/pupils";
import { storage } from "@/server/storage";
import { assertAnalysis, assertStorage, LimitError } from "@/server/limits";
import { enqueueAiJob } from "@/server/queue";
import { bellsOf, ensureDefaultBells, hhmm } from "@/server/bells";

type UploadFile = { name: string; size: number; type: string; arrayBuffer: () => Promise<ArrayBuffer> };

function asUpload(value: FormDataEntryValue | null): UploadFile | null {
  if (!value || typeof value === "string") return null;
  const file = value as Partial<UploadFile>;
  if (typeof file.name !== "string" || typeof file.size !== "number" || typeof file.arrayBuffer !== "function") return null;
  return { name: file.name, size: file.size, type: typeof file.type === "string" ? file.type : "", arrayBuffer: file.arrayBuffer.bind(value) };
}

const ACCEPT = /\.(pdf|docx?|xlsx?|jpe?g|png)$/i;
const MAX = 25 * 1024 * 1024;

function pack(lesson: { id: string; weekday: number; startMin: number; endMin: number; subject: string; parity: string; status: string; warned: boolean }) {
  return { ...lesson, start: hhmm(lesson.startMin), end: hhmm(lesson.endMin) };
}

export const GET = withAuth(async (_req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  await ensureDefaultBells(user.id);
  const [pupil, lessons, bells, file] = await Promise.all([
    prisma.pupil.findUnique({
      where: { id },
      select: {
        pullFromLessons: true,
        sessionsPerWeek: true,
        lessonFormat: true,
        lessonMinutes: true,
        shift: true,
        bellTemplateId: true,
        grade: true,
      },
    }),
    prisma.schoolLesson.findMany({ where: { pupilId: id }, orderBy: [{ weekday: "asc" }, { startMin: "asc" }] }),
    prisma.bellTemplate.findMany({ where: { userId: user.id }, orderBy: { name: "asc" } }),
    prisma.pupilAttachment.findFirst({ where: { pupilId: id, fileType: "SCHOOL" }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({
    pupil,
    lessons: lessons.map(pack),
    bells,
    file: file
      ? { id: file.id, fileName: file.fileName, status: file.analysisStatus, error: file.analysisError, url: storage.signedUrl(file.filePath) }
      : null,
  });
});

export const POST = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const form = await req.formData();
  const file = asUpload(form.get("file"));
  if (!file) return NextResponse.json({ error: "Выберите файл" }, { status: 400 });
  if (file.size <= 0) return NextResponse.json({ error: "Файл пустой" }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "Файл больше 25 МБ" }, { status: 400 });
  if (!ACCEPT.test(file.name)) return NextResponse.json({ error: "Допустимы DOC, DOCX, XLS, XLSX, PDF, JPEG и PNG" }, { status: 400 });
  try {
    await assertStorage(user.id, file.size);
    await assertAnalysis(user.id);
  } catch (e) {
    if (e instanceof LimitError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const stored = await storage.saveEncrypted(user.id, file.name, buf, "school");
  const old = await prisma.pupilAttachment.findMany({ where: { pupilId: id, fileType: "SCHOOL" } });
  for (const a of old) await storage.remove(a.filePath);
  if (old.length) await prisma.pupilAttachment.deleteMany({ where: { pupilId: id, fileType: "SCHOOL" } });
  const att = await prisma.pupilAttachment.create({
    data: {
      pupilId: id,
      userId: user.id,
      filePath: stored.relativePath,
      fileName: file.name,
      fileType: "SCHOOL",
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      encrypted: true,
      analysisStatus: "QUEUED",
    },
  });
  await enqueueAiJob("analyze-school", { userId: user.id, attachmentId: att.id, pupilId: id }, { attempts: 1 });
  return NextResponse.json({ file: { id: att.id, fileName: att.fileName, status: att.analysisStatus } });
});

export const PATCH = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.pullFromLessons === "boolean") data.pullFromLessons = body.pullFromLessons;
  if (typeof body.sessionsPerWeek === "number") data.sessionsPerWeek = Math.min(7, Math.max(1, body.sessionsPerWeek));
  if (body.lessonFormat === "INDIVIDUAL" || body.lessonFormat === "GROUP") data.lessonFormat = body.lessonFormat;
  if (typeof body.lessonMinutes === "number") data.lessonMinutes = Math.min(90, Math.max(20, body.lessonMinutes));
  if (body.shift === 1 || body.shift === 2) data.shift = body.shift;
  if (typeof body.bellTemplateId === "string") {
    const bell = await prisma.bellTemplate.findFirst({ where: { id: body.bellTemplateId, userId: user.id } });
    if (bell) data.bellTemplateId = bell.id;
  }
  if (Object.keys(data).length) await prisma.pupil.update({ where: { id }, data });
  if (Array.isArray(body.rows)) {
    await ensureDefaultBells(user.id);
    const pupil = await prisma.pupil.findUnique({ where: { id }, include: { bellTemplate: true } });
    const template =
      pupil?.bellTemplate ||
      (await prisma.bellTemplate.findFirst({ where: { userId: user.id, isDefault: true } })) ||
      (await prisma.bellTemplate.findFirst({ where: { userId: user.id } }));
    const bells = bellsOf(template?.lessons);
    await prisma.schoolLesson.deleteMany({ where: { pupilId: id, status: "DRAFT" } });
    for (const row of body.rows.slice(0, 80)) {
      if (!row.subject || !row.weekday) continue;
      const startMin = Number(row.startMin);
      const endMin = Number(row.endMin);
      const warned = !bells.some((b) => Math.abs(b.startMin - startMin) <= 5);
      await prisma.schoolLesson.create({
        data: {
          pupilId: id,
          weekday: Number(row.weekday),
          startMin,
          endMin,
          subject: String(row.subject).slice(0, 80),
          parity: row.parity === "NUMERATOR" || row.parity === "DENOMINATOR" ? row.parity : "BOTH",
          status: "DRAFT",
          warned,
        },
      });
    }
  }
  if (body.accept) {
    await prisma.schoolLesson.deleteMany({ where: { pupilId: id, status: "ACCEPTED" } });
    await prisma.schoolLesson.updateMany({ where: { pupilId: id, status: "DRAFT" }, data: { status: "ACCEPTED" } });
  }
  return NextResponse.json({ ok: true });
});
