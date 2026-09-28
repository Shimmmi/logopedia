import OpenAI from "openai";
import { env } from "../env";
import { resolveModel } from "../models";

export function aiClient() {
  if (!env.aiApiKey) {
    throw Object.assign(new Error("Не задан AI_API_KEY (RouterAI). Добавьте ключ в .env"), { status: 503 });
  }
  return new OpenAI({ apiKey: env.aiApiKey, baseURL: env.aiBaseUrl });
}

export async function modelFor(userId: string) {
  return resolveModel(userId, "TEXT");
}

export async function chatJson(userId: string, system: string, user: string) {
  const client = aiClient();
  const model = await modelFor(userId);
  const res = await client.chat.completions.create({
    model,
    temperature: 0.4,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = res.choices[0]?.message?.content ?? "";
  const tokens = res.usage?.total_tokens ?? 0;
  return { content, tokens, model, cost: costOf(res.usage) };
}

export async function chatText(userId: string, system: string, user: string) {
  return chatJson(userId, system, user);
}

export async function chatJsonStrict(userId: string, system: string, user: string) {
  const client = aiClient();
  const model = await modelFor(userId);
  const res = await client.chat.completions.create({
    model,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const content = res.choices[0]?.message?.content ?? "{}";
  const tokens = res.usage?.total_tokens ?? 0;
  return { content, tokens, model, cost: costOf(res.usage) };
}

function costOf(usage: unknown) {
  const row = usage as { cost?: number } | null | undefined;
  return typeof row?.cost === "number" ? row.cost : null;
}

function bufferFromB64(raw: string) {
  const trimmed = raw.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "");
  return Buffer.from(trimmed, "base64");
}

function extractImageBuffer(payload: unknown): Buffer | null {
  const data = payload as {
    data?: { b64_json?: string; url?: string }[];
    choices?: {
      message?: {
        images?: { image_url?: { url?: string }; b64_json?: string }[];
        content?: unknown;
      };
    }[];
  };
  const first = data.data?.[0];
  if (first?.b64_json) return bufferFromB64(first.b64_json);
  if (first?.url?.startsWith("data:")) return bufferFromB64(first.url);
  const msg = data.choices?.[0]?.message;
  const img = msg?.images?.[0];
  if (img?.image_url?.url) return bufferFromB64(img.image_url.url);
  if (img?.b64_json) return bufferFromB64(img.b64_json);
  const content = msg?.content;
  if (Array.isArray(content)) {
    for (const part of content) {
      const url = (part as { image_url?: { url?: string } })?.image_url?.url;
      if (url) return bufferFromB64(url);
    }
  }
  return null;
}

function refused(status: number, text: string) {
  return status === 400 || /safety|content|refus/i.test(text);
}

function namedParam(message: string) {
  const m = message.match(/[`'"]([a-zA-Z_][a-zA-Z0-9_]*)[`'"]/);
  return m?.[1] || null;
}

async function generateSunburst(model: string, prompt: string, aspectRatio: string) {
  const headers = {
    Authorization: `Bearer ${env.aiApiKey}`,
    "Content-Type": "application/json",
  };
  const base = env.aiBaseUrl.replace(/\/$/, "");
  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    aspect_ratio: aspectRatio,
    quality: "medium",
    output_format: "png",
  };
  let last = "Не удалось сгенерировать изображение";
  for (let attempt = 0; attempt < 3; attempt++) {
    const rest = await fetch(`${base}/images`, { method: "POST", headers, body: JSON.stringify(body) });
    const payload = (await rest.json().catch(() => ({}))) as {
      error?: { message?: string } | string;
      usage?: { cost?: number };
    };
    const err = payload.error;
    if (!rest.ok || err) {
      const text = typeof err === "string" ? err : err?.message || rest.statusText;
      last = text || last;
      if (refused(rest.status, text)) {
        throw Object.assign(new Error("Модель отказалась рисовать этот объект. Замените слово."), { status: 400 });
      }
      const extra = namedParam(text);
      if (extra && extra in body && extra !== "model" && extra !== "prompt" && extra !== "n") {
        delete body[extra];
        continue;
      }
      throw Object.assign(new Error(last), { status: 502 });
    }
    const buf = extractImageBuffer(payload);
    if (!buf?.length) throw new Error("Модель не вернула изображение");
    return { buffer: buf, model, cost: typeof payload.usage?.cost === "number" ? payload.usage.cost : null };
  }
  throw Object.assign(new Error(last), { status: 502 });
}

export async function generateImage(
  prompt: string,
  opts?: { seed?: number; aspectRatio?: string; size?: string; userId?: string }
) {
  if (!env.aiApiKey) {
    throw Object.assign(new Error("Генерация изображений не настроена"), { status: 503 });
  }
  const aspectRatio = opts?.aspectRatio || "3:4";
  const model = opts?.userId ? await resolveModel(opts.userId, "IMAGE") : env.aiImageModel;
  if (model.startsWith("openai/gpt-image")) {
    return generateSunburst(model, prompt, aspectRatio);
  }
  const size = opts?.size || "1K";
  const headers = {
    Authorization: `Bearer ${env.aiApiKey}`,
    "Content-Type": "application/json",
  };
  const base = env.aiBaseUrl.replace(/\/$/, "");

  const rest = await fetch(`${base}/images`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      aspect_ratio: aspectRatio,
      resolution: size,
      output_format: "png",
    }),
  });
  const restPayload = await rest.json().catch(() => ({}));
  const restErr = (restPayload as { error?: { message?: string } | string }).error;
  if (rest.ok && !restErr) {
    const buf = extractImageBuffer(restPayload);
    const cost = costOf((restPayload as { usage?: unknown }).usage);
    if (buf?.length) return { buffer: buf, model, cost };
  } else {
    const text = typeof restErr === "string" ? restErr : restErr?.message || "";
    if (refused(rest.status, text)) {
      throw Object.assign(new Error("Модель отказалась рисовать этот объект. Замените слово."), { status: 400 });
    }
  }

  const chat = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      modalities: ["image", "text"],
      image_config: { aspect_ratio: aspectRatio, image_size: size },
    }),
  });
  const chatPayload = await chat.json().catch(() => ({}));
  const chatErr = (chatPayload as { error?: { message?: string } | string }).error;
  if (!chat.ok || chatErr) {
    const text = typeof chatErr === "string" ? chatErr : chatErr?.message || "";
    if (refused(chat.status, text)) {
      throw Object.assign(new Error("Модель отказалась рисовать этот объект. Замените слово."), { status: 400 });
    }
    throw Object.assign(new Error("Не удалось сгенерировать изображение"), { status: 502 });
  }
  const buf = extractImageBuffer(chatPayload);
  if (!buf?.length) throw new Error("Модель не вернула изображение");
  return { buffer: buf, model, cost: costOf((chatPayload as { usage?: unknown }).usage) };
}

let imageModelOk: boolean | null = null;

export async function imageModelAvailable() {
  if (imageModelOk !== null) return imageModelOk;
  if (!env.aiApiKey || !env.aiImageModel) {
    imageModelOk = false;
    return false;
  }
  try {
    const res = await fetch(`${env.aiBaseUrl.replace(/\/$/, "")}/models`, {
      headers: { Authorization: `Bearer ${env.aiApiKey}` },
    });
    if (!res.ok) {
      imageModelOk = true;
      return true;
    }
    const data = (await res.json()) as { data?: { id?: string; architecture?: { output_modalities?: string[] } }[] };
    const found = (data.data || []).find((m) => m.id === env.aiImageModel);
    imageModelOk = !found || (found.architecture?.output_modalities || []).includes("image") || true;
  } catch {
    imageModelOk = true;
  }
  return imageModelOk;
}

export async function chatStream(
  userId: string,
  system: string,
  user: string,
  onDelta: (text: string) => void
) {
  if (!env.aiApiKey) {
    const stub = "Черновик недоступен: не задан ключ генерации. Добавьте AI_API_KEY.";
    onDelta(stub);
    return { content: stub, tokens: 0, model: "stub", cost: null as number | null };
  }
  const client = aiClient();
  const model = await modelFor(userId);
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
  const stream = await client.chat.completions
    .create({
      model,
      temperature: 0.4,
      stream: true,
      stream_options: { include_usage: true },
      messages,
    })
    .catch(() =>
      client.chat.completions.create({
        model,
        temperature: 0.4,
        stream: true,
        messages,
      }),
    );
  let content = "";
  let tokens = 0;
  let cost: number | null = null;
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || "";
    if (delta) {
      content += delta;
      onDelta(delta);
    }
    const usage = (chunk as { usage?: { total_tokens?: number; cost?: number } }).usage;
    if (usage?.total_tokens) tokens = usage.total_tokens;
    if (typeof usage?.cost === "number") cost = usage.cost;
  }
  return { content, tokens, model, cost };
}
