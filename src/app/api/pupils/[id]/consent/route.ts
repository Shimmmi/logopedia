import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { pupilOwned } from "@/server/pupils";
import { storage, ALLOWED_EXT } from "@/server/storage";

export const POST = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const form = await req.formData();
  const given = form.get("given") === "true" || form.get("given") === "on";
  let filePath: string | null = null;
  const file = form.get("file") as File | null;
  if (file && file.size && ALLOWED_EXT.test(file.name)) {
    const buf = Buffer.from(await file.arrayBuffer());
    const saved = await storage.save(user.id, file.name, buf, `consents/${id}`);
    filePath = saved.relativePath;
  }
  const consent = await prisma.consent.create({
    data: {
      pupilId: id,
      given,
      givenAt: given ? new Date() : null,
      filePath,
      note: String(form.get("note") || "") || null,
    },
  });
  return NextResponse.json({ consent });
});
