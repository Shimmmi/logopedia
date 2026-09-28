import JSZip from "jszip";
import { prisma } from "./db";
import { storage } from "./storage";
import { extractText } from "./extract";
import { imageToJpeg, pdfPagesToJpeg, visionOcr } from "./ocr";
import { chatJsonStrict } from "./ai/client";
import { bumpUsage } from "./limits";
import { bellsOf, ensureDefaultBells, hhmm, type BellRow } from "./bells";

const MATH = /математ|алгебр|геометр/i;

export function isProtectedSubject(subject: string, list: string) {
  const parts = list.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const s = subject.toLowerCase();
  if (parts.some((p) => p && s.includes(p))) return true;
  return MATH.test(s) && parts.some((p) => p.includes("математ"));
}

function oleStrings(buf: Buffer) {
  const text = buf.toString("utf16le");
  const parts = text.match(/[А-Яа-яЁёA-Za-z0-9][А-Яа-яЁёA-Za-z0-9 .:\-]{2,40}/g) || [];
  return Array.from(new Set(parts)).join("\n").slice(0, 12000);
}

async function xlsxText(buf: Buffer) {
  const zip = await JSZip.loadAsync(buf);
  const shared = await zip.file("xl/sharedStrings.xml")?.async("string");
  const strings: string[] = [];
  if (shared) {
    for (const m of Array.from(shared.matchAll(/<t[^>]*>([^<]*)<\/t>/g))) strings.push(m[1]);
  }
  const sheet = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
  if (!sheet) return "";
  const rows: string[] = [];
  for (const row of Array.from(sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g))) {
    const cells: string[] = [];
    for (const c of Array.from(row[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g))) {
      const ref = /t="s"/.test(c[1]);
      const v = c[2].match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
      cells.push(ref ? strings[Number(v)] ?? "" : v);
    }
    if (cells.some(Boolean)) rows.push(cells.join("\t"));
  }
  return rows.join("\n");
}

export async function textFromTimetable(buf: Buffer, mime: string, name: string, userId: string) {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
    if (buf.subarray(0, 2).toString() === "PK") return xlsxText(buf);
    return oleStrings(buf);
  }
  let text = await extractText(buf, mime, name);
  if (text.trim().length < 40 || mime.startsWith("image/") || /\.(jpe?g|png)$/i.test(name)) {
    if (mime.includes("pdf") || lower.endsWith(".pdf")) {
      const pages = await pdfPagesToJpeg(buf, 2);
      const ocr = await visionOcr(pages, userId);
      text = `${text}\n${ocr.text}`.trim();
    } else if (mime.startsWith("image/") || /\.(jpe?g|png)$/i.test(name)) {
      const page = await imageToJpeg(buf);
      const ocr = await visionOcr([page], userId);
      text = `${text}\n${ocr.text}`.trim();
    }
  }
  return text.slice(0, 12000);
}

type RawRow = { weekday?: number; start?: string; end?: string; lesson?: number; subject?: string; parity?: string };

function parityOf(v?: string) {
  if (v === "NUMERATOR" || v === "DENOMINATOR") return v;
  return "BOTH" as const;
}

function minutesOf(v?: string) {
  if (!v || !/^\d{1,2}:\d{2}$/.test(v)) return null;
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}

export async function analyzeSchoolFile(userId: string, pupilId: string, attachmentId: string) {
  const att = await prisma.pupilAttachment.findFirst({ where: { id: attachmentId, pupilId, userId } });
  const pupil = await prisma.pupil.findFirst({
    where: { id: pupilId, userId },
    include: { bellTemplate: true },
  });
  if (!att || !pupil) return;
  await prisma.pupilAttachment.update({ where: { id: att.id }, data: { analysisStatus: "RUNNING", analysisError: null } });
  try {
    await ensureDefaultBells(userId);
    const fresh = pupil.bellTemplate
      ? pupil
      : await prisma.pupil.findFirst({
          where: { id: pupilId },
          include: { bellTemplate: true },
        });
    const template =
      fresh?.bellTemplate ||
      (await prisma.bellTemplate.findFirst({ where: { userId, isDefault: true } })) ||
      (await prisma.bellTemplate.findFirst({ where: { userId } }));
    const buf = await storage.readMaybeEncrypted(att.filePath, att.encrypted);
    const text = await textFromTimetable(buf, att.mimeType, att.fileName, userId);
    if (text.trim().length < 40) throw new Error("В файле мало текста. Допишите строки вручную.");
    const { content, tokens, cost } = await chatJsonStrict(
      userId,
      "Разбери школьное расписание. Ответ — JSON {rows:[{weekday:1-5, start:\"HH:MM\" или null, end:\"HH:MM\" или null, lesson:номер урока или null, subject, parity:BOTH|NUMERATOR|DENOMINATOR}]}. weekday 1=понедельник. Не выдумывай предметы.",
      text.slice(0, 10000),
    );
    const parsed = JSON.parse(content.match(/\{[\s\S]*\}/)?.[0] || "{}") as { rows?: RawRow[] };
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    const bells = bellsOf(template?.lessons);
    const byN = new Map(bells.map((b) => [b.n, b]));
    await prisma.schoolLesson.deleteMany({ where: { pupilId, status: "DRAFT" } });
    for (const row of rows.slice(0, 80)) {
      if (!row.subject || !row.weekday || row.weekday < 1 || row.weekday > 6) continue;
      const startGiven = minutesOf(row.start);
      const endGiven = minutesOf(row.end);
      let startMin: number | null = null;
      let endMin: number | null = null;
      let warned = false;
      if (startGiven != null && endGiven != null) {
        startMin = startGiven;
        endMin = endGiven;
        const hit = bells.find((b) => Math.abs(b.startMin - startGiven) <= 5);
        if (!hit) warned = true;
      } else if (row.lesson && byN.get(Number(row.lesson))) {
        const b = byN.get(Number(row.lesson)) as BellRow;
        startMin = b.startMin;
        endMin = b.endMin;
      } else {
        warned = true;
        startMin = 8 * 60;
        endMin = 8 * 60 + 40;
      }
      await prisma.schoolLesson.create({
        data: {
          pupilId,
          weekday: row.weekday,
          startMin: startMin ?? 480,
          endMin: endMin ?? 520,
          subject: String(row.subject).slice(0, 80),
          parity: parityOf(row.parity),
          status: "DRAFT",
          warned,
        },
      });
    }
    await bumpUsage(userId, { tokens, analyses: 1, costRub: typeof cost === "number" ? cost : 10 });
    await prisma.pupilAttachment.update({ where: { id: att.id }, data: { analysisStatus: "DONE", analysisError: null } });
  } catch (e) {
    await prisma.pupilAttachment.update({
      where: { id: att.id },
      data: { analysisStatus: "FAILED", analysisError: e instanceof Error ? e.message : "Ошибка" },
    });
  }
}

export function lessonLabel(startMin: number, endMin: number, subject: string) {
  return `${hhmm(startMin)}–${hhmm(endMin)} ${subject}`;
}
