import { mkdir, writeFile, readFile, unlink, copyFile, stat } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { env } from "./env";
import { decryptBuffer, encryptBuffer, hmacSign, hmacVerify, isEncryptedFile } from "./encryption";

export interface StoredFile {
  relativePath: string;
  size: number;
}

export class LocalFsStorage {
  constructor(private root = env.storageRoot) {}

  async save(userId: string, originalName: string, data: Buffer, subdir = "files"): Promise<StoredFile> {
    const ext = path.extname(originalName).slice(0, 12);
    const id = randomBytes(12).toString("hex");
    const relativePath = path.posix.join(userId, subdir, `${id}${ext}`);
    const abs = this.abs(relativePath);
    await mkdir(path.dirname(abs), { recursive: true });
    await writeFile(abs, data);
    return { relativePath, size: data.length };
  }

  async saveEncrypted(userId: string, originalName: string, data: Buffer, subdir = "files"): Promise<StoredFile & { encrypted: true }> {
    const stored = await this.save(userId, originalName, encryptBuffer(data), subdir);
    return { ...stored, encrypted: true };
  }

  async readEncrypted(relativePath: string) {
    return decryptBuffer(await this.read(relativePath));
  }

  async readMaybeEncrypted(relativePath: string, encrypted?: boolean) {
    const buf = await this.read(relativePath);
    if (encrypted || isEncryptedFile(buf)) return decryptBuffer(buf);
    return buf;
  }

  abs(relativePath: string) {
    const safe = relativePath.replace(/\.\./g, "");
    return path.join(this.root, safe);
  }

  async read(relativePath: string) {
    return readFile(this.abs(relativePath));
  }

  async remove(relativePath: string) {
    try {
      await unlink(this.abs(relativePath));
    } catch {
      /* ignore */
    }
  }

  async copy(from: string, to: string) {
    const dest = this.abs(to);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(this.abs(from), dest);
  }

  async size(relativePath: string) {
    const s = await stat(this.abs(relativePath));
    return s.size;
  }

  signedUrl(relativePath: string, ttlSec = 3600) {
    const token = hmacSign(relativePath, ttlSec);
    return `/api/files/${token}`;
  }

  verifyToken(token: string) {
    return hmacVerify(token);
  }
}

export const storage = new LocalFsStorage();

export function classifyMime(mime: string, name: string): "DOC" | "AUDIO" | "IMAGE" | "OTHER" {
  if (mime.startsWith("image/") || /\.(jpe?g|png|gif|webp)$/i.test(name)) return "IMAGE";
  if (mime.startsWith("audio/") || /\.(mp3|wav|m4a|ogg|webm)$/i.test(name)) return "AUDIO";
  if (
    mime.includes("pdf") ||
    mime.includes("word") ||
    mime.includes("officedocument") ||
    mime.includes("spreadsheet") ||
    /\.(pdf|docx?|xlsx?)$/i.test(name)
  )
    return "DOC";
  return "OTHER";
}

export const ALLOWED_EXT = /\.(docx?|pdf|xlsx?|jpe?g|png|gif|webp|mp3|wav|m4a|ogg|webm)$/i;
