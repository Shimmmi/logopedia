import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { pupilOwned } from "@/server/pupils";
import { encrypt } from "@/server/encryption";
import { TAG_COLORS } from "@/lib/utils";
import { audit } from "@/server/audit";

type TagCat = "DIAGNOSIS" | "DIRECTION" | "ORGANIZATIONAL" | "CUSTOM";

export const POST = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const body = await req.json();
  const tagIds: string[] = Array.isArray(body.tagIds) ? body.tagIds : [];
  const newTags: { name: string; category?: TagCat }[] = Array.isArray(body.newTags) ? body.newTags : [];
  const created: string[] = [];
  for (const t of newTags.slice(0, 3)) {
    if (!t.name?.trim()) continue;
    const cat = (t.category === "DIRECTION" ? "DIRECTION" : "DIAGNOSIS") as TagCat;
    const row = await prisma.tag.upsert({
      where: { userId_name: { userId: user.id, name: t.name.trim() } },
      create: { userId: user.id, name: t.name.trim(), category: cat, color: TAG_COLORS[cat] },
      update: {},
    });
    created.push(row.id);
  }
  const all = Array.from(new Set(tagIds.concat(created)));
  for (const tagId of all) {
    await prisma.pupilTag.upsert({
      where: { pupilId_tagId: { pupilId: id, tagId } },
      create: { pupilId: id, tagId },
      update: {},
    });
  }
  const data: Record<string, unknown> = {};
  if (body.diagnosis !== undefined) data.diagnosisEnc = body.diagnosis ? encrypt(String(body.diagnosis).slice(0, 500)) : null;
  if (body.pmpkDate !== undefined) data.pmpkDate = body.pmpkDate ? new Date(body.pmpkDate) : null;
  if (body.pmpkNumber !== undefined) data.pmpkNumber = body.pmpkNumber || null;
  if (body.aopVariant !== undefined) data.aopVariant = body.aopVariant || null;
  if (body.fullName) data.fullName = String(body.fullName).trim().slice(0, 200);
  if (body.birthDate) data.birthDate = new Date(body.birthDate);
  if (body.gender === "MALE" || body.gender === "FEMALE" || body.gender === "OTHER") data.gender = body.gender;
  if (body.school) data.school = String(body.school).trim().slice(0, 200);
  if (body.grade) data.grade = String(body.grade).trim().slice(0, 40);
  if (body.pmpkNextAt) data.pmpkNextAt = new Date(body.pmpkNextAt);
  if (Object.keys(data).length) await prisma.pupil.update({ where: { id }, data });
  await audit({ userId: user.id, action: "pmpk_apply", entity: "pupil", entityId: id, meta: { tagIds: all } });
  return NextResponse.json({ ok: true, tagIds: all });
});
