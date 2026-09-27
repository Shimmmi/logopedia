import mammoth from "mammoth";

export async function extractText(buf: Buffer, mime: string, name: string): Promise<string> {
  try {
    if (mime.includes("pdf") || name.toLowerCase().endsWith(".pdf")) {
      const pdfParse = (await import("pdf-parse")).default as (b: Buffer) => Promise<{ text: string }>;
      const res = await pdfParse(buf);
      return res.text || "";
    }
    if (mime.includes("word") || name.toLowerCase().endsWith(".docx")) {
      const res = await mammoth.extractRawText({ buffer: buf });
      return res.value || "";
    }
    if (mime.startsWith("text/") || name.toLowerCase().endsWith(".txt")) {
      return buf.toString("utf8");
    }
  } catch (e) {
    console.error("extractText", e);
  }
  return "";
}
