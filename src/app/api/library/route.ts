import { NextResponse } from "next/server";
import { withAuth } from "@/server/api";
import { prisma } from "@/server/db";
import { storage } from "@/server/storage";

export const GET = withAuth(async (req, user) => {
  const q = req.nextUrl.searchParams;
  const sound = q.get("sound")?.trim();
  const search = q.get("q")?.trim();
  const from = q.get("from");
  const to = q.get("to");
  const createdAt =
    from || to
      ? {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
        }
      : undefined;
  const [sets, drafts, items] = await Promise.all([
    prisma.aiImageSet.findMany({
      where: {
        userId: user.id,
        status: "DONE",
        ...(createdAt ? { createdAt } : {}),
        ...((sound || search)
          ? {
              AND: [
                ...(sound ? [{ params: { path: ["sound"], equals: sound } }] : []),
                ...(search ? [{ params: { string_contains: search } }] : []),
              ],
            }
          : {}),
      },
      include: { images: true },
      orderBy: { createdAt: "desc" },
      take: 60,
    }),
    prisma.aiGeneration.findMany({
      where: {
        userId: user.id,
        ...(createdAt ? { createdAt } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: "insensitive" as const } },
                { content: { contains: search, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: { id: true, title: true, kind: true, createdAt: true, content: true },
    }),
    prisma.speechMaterial.findMany({
      where: {
        OR: [{ userId: null }, { userId: user.id, ...(createdAt ? { createdAt } : {}) }],
        ...(sound ? { sound } : {}),
        ...(search ? { title: { contains: search, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const sheets = sets
    .map((set) => {
      const params = set.params as { title?: string; sound?: string; words?: { word: string }[] };
      const img = set.images.find((i) => i.filePath);
      return {
        id: set.id,
        title: params.title || "Лист A4",
        sound: params.sound || null,
        kind: set.kind,
        createdAt: set.createdAt,
        words: (params.words || []).map((w) => w.word),
        url: img?.filePath ? storage.signedUrl(img.filePath) : null,
        pdf: `/api/images/sets/${set.id}/pdf`,
      };
    })
    ;
  const filteredDrafts = drafts.filter((d) => {
    if (!search) return true;
    return `${d.title} ${d.content}`.toLowerCase().includes(search.toLowerCase());
  });
  return NextResponse.json({ sheets, drafts: filteredDrafts, items });
});

export const POST = withAuth(async (req, user) => {
  const body = await req.json();
  const item = await prisma.speechMaterial.create({
    data: {
      userId: user.id,
      title: body.title,
      body: body.body,
      sound: body.sound || null,
      ageFrom: body.ageFrom ? Number(body.ageFrom) : null,
      ageTo: body.ageTo ? Number(body.ageTo) : null,
      kind: body.kind || "text",
    },
  });
  return NextResponse.json({ item });
});
