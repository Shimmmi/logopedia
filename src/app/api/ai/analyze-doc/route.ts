import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { chatText } from "@/server/ai/client";
import { SYSTEM_LOGOPED, promptDocAnalysis, promptCompare, promptFgocChecklist } from "@/server/ai/prompts";
import { assertAnalysis, bumpUsage, getLimits } from "@/server/limits";
import { extractText } from "@/server/extract";
import { storage } from "@/server/storage";
import { enqueueAiJob } from "@/server/queue";

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  if (body.async && body.documentId) {
    await enqueueAiJob("analyze-doc", { userId: user.id, documentId: body.documentId });
    return NextResponse.json({ queued: true });
  }
  await assertAnalysis(user.id);
  let text = body.text as string | undefined;
  if (!text && body.documentId) {
    const doc = await prisma.document.findFirst({ where: { id: body.documentId, userId: user.id } });
    if (!doc) return NextResponse.json({ error: "Документ не найден" }, { status: 404 });
    text = doc.contentText || "";
    if (!text) {
      const buf = await storage.read(doc.filePath);
      text = await extractText(buf, doc.mimeType, doc.fileName);
    }
  }
  if (!text) return NextResponse.json({ error: "Нет текста для анализа" }, { status: 400 });
  const prompt =
    body.mode === "compare"
      ? promptCompare(text, body.textB || "")
      : body.mode === "fgos"
        ? promptFgocChecklist(text)
        : promptDocAnalysis(text);
  const { content, tokens, model, cost } = await chatText(user.id, SYSTEM_LOGOPED, prompt);
  let parsed: unknown = content;
  try {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch {
    parsed = { text: content };
  }
  const analysis = await prisma.aiAnalysis.create({
    data: {
      userId: user.id,
      sourceType: "DOC",
      sourceId: body.documentId || null,
      modelUsed: model,
      resultJson: parsed as object,
    },
  });
  await bumpUsage(user.id, { tokens, analyses: 1, costRub: typeof cost === "number" ? cost : 10 });
  const limits = await getLimits(user.id);
  return NextResponse.json({ analysis, plan: limits.plan });
});
