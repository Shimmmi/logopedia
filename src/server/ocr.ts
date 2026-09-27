import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, readFile, rm, writeFile, readdir } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { env } from "./env";
import { aiClient } from "./ai/client";

const exec = promisify(execFile);
const PDFTOPPM = "/usr/bin/pdftoppm";

let ocrBin: boolean | null = null;

export async function ocrAvailable() {
  if (ocrBin !== null) return ocrBin;
  try {
    await exec(PDFTOPPM, ["-v"]);
    ocrBin = true;
  } catch (e: unknown) {
    const err = e as { stderr?: string; message?: string };
    ocrBin = /pdftoppm/i.test(String(err.stderr || err.message || ""));
  }
  return ocrBin;
}

async function compressPage(buf: Buffer) {
  const sharp = (await import("sharp")).default;
  return sharp(buf).resize({ width: 1200, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
}

export async function pdfPagesToJpeg(pdf: Buffer, maxPages = 6): Promise<Buffer[]> {
  if (!(await ocrAvailable())) {
    throw Object.assign(new Error("OCR недоступен на сервере"), { status: 503 });
  }
  const dir = await mkdtemp(path.join(tmpdir(), "lp-ocr-"));
  try {
    const src = path.join(dir, "in.pdf");
    await writeFile(src, pdf);
    await exec(PDFTOPPM, ["-r", "150", "-jpeg", "-l", String(maxPages), src, path.join(dir, "p")]);
    const files = (await readdir(dir)).filter((f) => f.startsWith("p") && f.endsWith(".jpg")).sort();
    const out: Buffer[] = [];
    for (const f of files.slice(0, maxPages)) {
      out.push(await compressPage(await readFile(path.join(dir, f))));
    }
    return out;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function imageToJpeg(buf: Buffer) {
  return compressPage(buf);
}

export async function visionOcr(pages: Buffer[], userId: string) {
  if (!env.aiApiKey) throw Object.assign(new Error("Не задан AI_API_KEY"), { status: 503 });
  const client = aiClient();
  const content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: "Распознай текст документа дословно. Верни только текст, без комментариев." },
  ];
  for (const page of pages) {
    content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${page.toString("base64")}` } });
  }
  const res = await client.chat.completions.create({
    model: env.aiModelAdvanced,
    temperature: 0,
    messages: [{ role: "user", content }],
  });
  return {
    text: res.choices[0]?.message?.content || "",
    tokens: res.usage?.total_tokens ?? 0,
    model: env.aiModelAdvanced,
    userId,
  };
}
