import { prisma } from "../src/server/db";
import { storage } from "../src/server/storage";
import { encryptBuffer, isEncryptedFile } from "../src/server/encryption";
import { writeFile } from "fs/promises";

async function encryptPath(filePath: string) {
  const buf = await storage.read(filePath);
  if (isEncryptedFile(buf)) return false;
  await writeFile(storage.abs(filePath), encryptBuffer(buf));
  return true;
}

async function main() {
  let n = 0;
  const atts = await prisma.pupilAttachment.findMany({ where: { encrypted: false } });
  for (const a of atts) {
    try {
      if (await encryptPath(a.filePath)) {
        await prisma.pupilAttachment.update({ where: { id: a.id }, data: { encrypted: true } });
        n += 1;
      }
    } catch (e) {
      console.error("attachment", a.id, e);
    }
  }
  const docs = await prisma.document.findMany({ where: { encrypted: false, deletedAt: null } });
  for (const d of docs) {
    try {
      if (await encryptPath(d.filePath)) {
        await prisma.document.update({ where: { id: d.id }, data: { encrypted: true } });
        n += 1;
      }
    } catch (e) {
      console.error("document", d.id, e);
    }
  }
  console.log(`Encrypted ${n} files`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
