import { prisma } from "./db";
import { storage } from "./storage";
import { extractText } from "./extract";
import { imageToJpeg, ocrAvailable, pdfPagesToJpeg, visionOcr } from "./ocr";
import { chatJsonStrict } from "./ai/client";
import { promptPmpk, SYSTEM_LOGOPED } from "./ai/prompts";
import { encrypt } from "./encryption";
import { bumpUsage } from "./limits";
import { audit } from "./audit";
import { notifyUser } from "./notify";

function tryJson(s: string) {
  try {
    const m = s.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { text: s };
  } catch {
    return { text: s };
  }
}

export async function interpretPmpkFile(userId: string, buf: Buffer, mime: string, fileName: string) {
  let text = await extractText(buf, mime, fileName);
  const isImage = mime.startsWith("image/") || /\.(jpe?g|png)$/i.test(fileName);
  const isPdf = mime.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
  let tokens = 0;
  if (text.trim().length < 200 || isImage) {
    if (isPdf) {
      if (!(await ocrAvailable())) throw new Error("OCR недоступен на сервере");
      const pages = await pdfPagesToJpeg(buf, 6);
      const ocr = await visionOcr(pages, userId);
      text = ocr.text;
      tokens += ocr.tokens;
    } else if (isImage) {
      const page = await imageToJpeg(buf);
      const ocr = await visionOcr([page], userId);
      text = ocr.text;
      tokens += ocr.tokens;
    }
  }
  if (text.trim().length < 40) {
    throw new Error("В файле не нашли текст. Попробуйте более чёткий скан");
  }
  const tags = await prisma.tag.findMany({
    where: { userId, category: { in: ["DIAGNOSIS", "DIRECTION"] } },
    select: { id: true, name: true, category: true },
  });
  const { content, tokens: t2, model, cost } = await chatJsonStrict(userId, SYSTEM_LOGOPED, promptPmpk(text, tags));
  tokens += t2;
  const parsed = tryJson(content) as Record<string, unknown>;
  parsed.anonymizedPreview = text.replace(/\s+/g, " ").trim().slice(0, 300);
  await bumpUsage(userId, { tokens, analyses: 1, costRub: typeof cost === "number" ? cost : 10 });
  return { parsed, model, text };
}

export async function analyzePmpkDraft(userId: string, draftId: string) {
  const draft = await prisma.pmpkDraft.findFirst({ where: { id: draftId, userId } });
  if (!draft) return;
  await prisma.pmpkDraft.update({ where: { id: draft.id }, data: { analysisStatus: "RUNNING", analysisError: null } });
  try {
    const buf = await storage.readMaybeEncrypted(draft.filePath, draft.encrypted);
    const { parsed } = await interpretPmpkFile(userId, buf, draft.mimeType, draft.fileName);
    await prisma.pmpkDraft.update({
      where: { id: draft.id },
      data: { analysisStatus: "DONE", resultJson: parsed as object, analysisError: null },
    });
    await notifyUser(userId, "Заключение разобрано", "Проверьте поля карточки и сохраните ученика", "/pupils/new");
  } catch (e) {
    const message = (e as Error).message || "Не удалось проанализировать";
    await prisma.pmpkDraft.update({ where: { id: draft.id }, data: { analysisStatus: "FAILED", analysisError: message } });
    throw e;
  }
}

export async function analyzePmpk(userId: string, attachmentId: string) {
  const att = await prisma.pupilAttachment.findFirst({
    where: { id: attachmentId, userId, fileType: "PMPK" },
    include: { pupil: { include: { contacts: true } } },
  });
  if (!att) return;
  await prisma.pupilAttachment.update({ where: { id: att.id }, data: { analysisStatus: "RUNNING", analysisError: null } });
  try {
    const buf = await storage.readMaybeEncrypted(att.filePath, att.encrypted);
    const { parsed, model, text } = await interpretPmpkFile(userId, buf, att.mimeType, att.fileName);
    await prisma.pupilAttachment.update({ where: { id: att.id }, data: { textEnc: encrypt(text) } });
    const analysis = await prisma.aiAnalysis.create({
      data: { userId, sourceType: "PMPK", sourceId: att.id, modelUsed: model, resultJson: parsed as object },
    });
    await prisma.pupilAttachment.update({
      where: { id: att.id },
      data: { analysisStatus: "DONE", analysisId: analysis.id, analysisError: null },
    });
    await audit({ userId, action: "ai_pmpk_analyze", entity: "pupil", entityId: att.pupilId, meta: { analysisId: analysis.id } });
    await notifyUser(userId, "Заключение проанализировано — есть предложения", att.fileName, `/pupils/${att.pupilId}?tab=pmpk`);
    return analysis.id;
  } catch (e) {
    const message = (e as Error).message || "Не удалось проанализировать";
    await prisma.pupilAttachment.update({
      where: { id: att.id },
      data: { analysisStatus: "FAILED", analysisError: message },
    });
    throw e;
  }
}
