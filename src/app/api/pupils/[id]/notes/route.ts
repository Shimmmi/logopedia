import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { pupilOwned } from "@/server/pupils";

export const POST = withAuth(async (req, user, ctx) => {
  const id = ctx!.params.id;
  await pupilOwned(user.id, id);
  const { body } = await req.json();
  const note = await prisma.pupilNote.create({
    data: { pupilId: id, userId: user.id, body: String(body) },
  });
  return NextResponse.json({ note });
});
