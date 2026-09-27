import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { storage } from "@/server/storage";
import JSZip from "jszip";
import { decrypt } from "@/server/encryption";
import { A11Y_COOKIE, a11yCookieValue } from "@/lib/a11y";

export const PATCH = withAuth(async (req, user) => {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  const allow = [
    "name",
    "position",
    "institution",
    "phone",
    "notifyPref",
    "backupEmail",
    "timezone",
    "a11yLargeText",
    "a11yHighContrast",
    "a11yReduceMotion",
    "onboardingDone",
    "aiPmpkConsentAt",
    "aiPmpkAutoAnalyze",
  ];
  for (const k of allow) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (typeof data.aiPmpkConsentAt === "string") data.aiPmpkConsentAt = new Date(data.aiPmpkConsentAt);
  const updated = await prisma.user.update({ where: { id: user.id }, data });
  cookies().set(A11Y_COOKIE, a11yCookieValue(updated), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false,
  });
  return NextResponse.json({
    user: {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      position: updated.position,
      institution: updated.institution,
      timezone: updated.timezone,
      a11yLargeText: updated.a11yLargeText,
      a11yHighContrast: updated.a11yHighContrast,
      a11yReduceMotion: updated.a11yReduceMotion,
    },
  });
});

export const GET = withAuth(async (_req, user) => {
  const full = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    include: {
      pupils: { include: { notes: true, progress: true, tags: { include: { tag: true } } } },
      documents: true,
      events: true,
      generations: true,
      analyses: true,
    },
  });
  const zip = new JSZip();
  zip.file(
    "user.json",
    JSON.stringify(
      {
        ...full,
        pupils: full.pupils.map((p) => ({ ...p, diagnosis: decrypt(p.diagnosisEnc), diagnosisEnc: undefined })),
      },
      null,
      2
    )
  );
  const folder = zip.folder("files");
  for (const d of full.documents) {
    try {
      folder?.file(d.fileName, await storage.readMaybeEncrypted(d.filePath, d.encrypted));
    } catch {
      /* skip */
    }
  }
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="logoped-export.zip"',
    },
  });
});

export const DELETE = withAuth(async (_req, user) => {
  const docs = await prisma.document.findMany({ where: { userId: user.id } });
  const atts = await prisma.pupilAttachment.findMany({ where: { userId: user.id } });
  for (const d of docs) await storage.remove(d.filePath);
  for (const a of atts) await storage.remove(a.filePath);
  await prisma.user.delete({ where: { id: user.id } });
  return NextResponse.json({ ok: true });
});
