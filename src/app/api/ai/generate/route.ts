import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { chatStream } from "@/server/ai/client";
import { SYSTEM_LOGOPED, promptDiagnostics, promptProgram, promptConclusion, promptTasks } from "@/server/ai/prompts";
import { assertGeneration, bumpUsage } from "@/server/limits";
import { GenerationKind } from "@prisma/client";
import { pupilOwned, serializePupil } from "@/server/pupils";
import { pupilMaterials } from "@/server/pupil-materials";

const TITLES: Record<GenerationKind, string> = {
  DIAGNOSTICS: "Протокол диагностики",
  PROGRAM: "Рабочая программа",
  CONCLUSION: "Логопедическое заключение",
  TASKS: "Задания",
};

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const kind = body.kind as GenerationKind;
  await assertGeneration(user.id);
  let pupilData: ReturnType<typeof serializePupil> | null = null;
  if (body.pupilId) {
    const p = await pupilOwned(user.id, body.pupilId);
    pupilData = serializePupil(p);
  }
  const materials = body.pupilId ? await pupilMaterials(user.id, body.pupilId) : "";
  const input = {
    extra: body.extra,
    grade: pupilData?.grade,
    school: pupilData?.school,
    diagnosis: pupilData?.diagnosis,
    aopVariant: pupilData?.aopVariant,
    notes: body.notes,
  };
  const base =
    kind === "DIAGNOSTICS"
      ? promptDiagnostics(input)
      : kind === "PROGRAM"
        ? promptProgram(input)
        : kind === "CONCLUSION"
          ? promptConclusion(input)
          : promptTasks(input);
  const prompt = materials ? `${base}\n\nМатериалы карточки:\n${materials}` : base;
  const title = `${TITLES[kind]}${pupilData ? " — ученик" : ""}`;
  const gen = await prisma.aiGeneration.create({
    data: { userId: user.id, pupilId: body.pupilId || null, kind, title, content: "", modelUsed: "pending" },
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      send("start", { id: gen.id });
      try {
        const { content, tokens, model, cost } = await chatStream(user.id, SYSTEM_LOGOPED, prompt, (delta) => {
          send("delta", { text: delta });
        });
        await prisma.aiGeneration.update({ where: { id: gen.id }, data: { content, modelUsed: model } });
        await bumpUsage(user.id, { tokens, generations: 1, costRub: typeof cost === "number" ? cost : 12 });
        send("done", { id: gen.id, content, title });
      } catch (e) {
        send("error", { message: e instanceof Error ? e.message : "Ошибка генерации" });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
});
