import { prisma } from "./db";
import { storage } from "./storage";
import { extractText } from "./extract";
import { decrypt } from "./encryption";

const PER_FILE = 8000;
const TOTAL = 24000;

async function piece(name: string, text: string, used: { n: number }, out: string[]) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) {
    out.push(`Файл без текста: ${name}`);
    return;
  }
  const slice = clean.slice(0, PER_FILE);
  if (used.n + slice.length > TOTAL) return false;
  used.n += slice.length;
  out.push(`# ${name}\n${slice}`);
  return true;
}

export async function pupilMaterials(userId: string, pupilId: string) {
  const [docs, atts] = await Promise.all([
    prisma.document.findMany({ where: { userId, pupilId, deletedAt: null }, orderBy: { createdAt: "desc" }, take: 12 }),
    prisma.pupilAttachment.findMany({ where: { userId, pupilId }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const out: string[] = [];
  const used = { n: 0 };
  for (const d of docs) {
    let text = d.contentText || "";
    if (!text && d.filePath) {
      try {
        const buf = await storage.readMaybeEncrypted(d.filePath, d.encrypted);
        text = await extractText(buf, d.mimeType, d.fileName);
      } catch {
        text = "";
      }
    }
    const ok = await piece(d.fileName, text, used, out);
    if (ok === false) break;
  }
  for (const a of atts) {
    if (used.n >= TOTAL) break;
    let text = a.textEnc ? decrypt(a.textEnc) || "" : "";
    if (!text && a.filePath && !a.fileName.toLowerCase().endsWith(".doc")) {
      try {
        const buf = await storage.readMaybeEncrypted(a.filePath, a.encrypted);
        text = await extractText(buf, a.mimeType, a.fileName);
      } catch {
        text = "";
      }
    }
    const ok = await piece(a.fileName, text, used, out);
    if (ok === false) break;
  }
  return out.join("\n\n").slice(0, TOTAL);
}
