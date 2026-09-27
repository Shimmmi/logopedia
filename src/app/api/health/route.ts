import { NextResponse } from "next/server";
import { ocrAvailable } from "@/server/ocr";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const ocr = await ocrAvailable();
  return NextResponse.json({ ok: true, service: "logoped", ocr });
}
