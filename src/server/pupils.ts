import { prisma } from "./db";
import { decrypt } from "./encryption";

export function serializePupil(p: {
  id: string;
  fullName: string;
  photoPath: string | null;
  birthDate: Date | null;
  gender: string | null;
  school: string | null;
  grade: string | null;
  enrolledAt: Date;
  parentName: string | null;
  parentPhone: string | null;
  parentEmail: string | null;
  diagnosisEnc: string | null;
  pmpkDate: Date | null;
  pmpkNumber: string | null;
  aopVariant: string | null;
  status: string;
  pmpkNextAt: Date | null;
  tags?: { tag: { id: string; name: string; category: string; color: string } }[];
  consents?: { given: boolean; givenAt: Date | null; filePath: string | null; signedBy?: string | null }[];
  contacts?: { id: string; fullName: string; role: string; phone: string | null; email: string | null; isPrimary: boolean; links?: unknown }[];
  nextEventAt?: Date | null;
}) {
  const contacts =
    p.contacts && p.contacts.length
      ? p.contacts
      : p.parentName
        ? [{ id: "legacy", fullName: p.parentName, role: "Мама", phone: p.parentPhone, email: p.parentEmail, isPrimary: true, links: [] }]
        : [];
  return {
    id: p.id,
    fullName: p.fullName,
    photoPath: p.photoPath,
    birthDate: p.birthDate,
    gender: p.gender,
    school: p.school,
    grade: p.grade,
    enrolledAt: p.enrolledAt,
    parentName: p.parentName,
    parentPhone: p.parentPhone,
    parentEmail: p.parentEmail,
    diagnosis: decrypt(p.diagnosisEnc),
    pmpkDate: p.pmpkDate,
    pmpkNumber: p.pmpkNumber,
    aopVariant: p.aopVariant,
    status: p.status,
    pmpkNextAt: p.pmpkNextAt,
    tags: p.tags?.map((t) => t.tag) ?? [],
    consent: p.consents?.[0] ?? null,
    contacts,
    nextEventAt: p.nextEventAt ?? null,
  };
}

export async function pupilOwned(userId: string, id: string) {
  const p = await prisma.pupil.findFirst({
    where: { id, userId },
    include: { tags: { include: { tag: true } }, consents: true, contacts: true },
  });
  if (!p) throw Object.assign(new Error("Ученик не найден"), { status: 404 });
  return p;
}

export async function syncContacts(
  pupilId: string,
  contacts?: { fullName: string; role?: string; phone?: string; email?: string; isPrimary?: boolean; links?: unknown }[]
) {
  if (!contacts) return;
  await prisma.pupilContact.deleteMany({ where: { pupilId } });
  if (!contacts.length) return;
  await prisma.pupilContact.createMany({
    data: contacts
      .filter((c) => c.fullName?.trim())
      .map((c, i) => ({
        pupilId,
        fullName: c.fullName.trim(),
        role: c.role || "Мама",
        phone: c.phone || null,
        email: c.email || null,
        isPrimary: c.isPrimary ?? i === 0,
        links: Array.isArray(c.links) ? c.links : [],
      })),
  });
}
