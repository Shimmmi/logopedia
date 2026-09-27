import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "fs/promises";

const FONT_CANDIDATES = [
  "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
  "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
];

async function loadFontBytes() {
  for (const p of FONT_CANDIDATES) {
    try {
      return await readFile(p);
    } catch {
      /* try next */
    }
  }
  throw new Error("Не найден шрифт с кириллицей (установите fonts-dejavu-core)");
}

export async function buildPagePdf(image: Buffer) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const embedded =
    image[0] === 0xff
      ? await pdf.embedJpg(image).catch(() => pdf.embedPng(image))
      : await pdf.embedPng(image).catch(() => pdf.embedJpg(image));
  page.drawImage(embedded, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() });
  return Buffer.from(await pdf.save());
}

export async function buildSheetPdf(opts: {
  title: string;
  cells: { image?: Buffer; label?: string }[];
  cols: number;
  rows: number;
  cropMarks?: boolean;
  style: "outline" | "color";
}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await loadFontBytes());
  const page = pdf.addPage([595.28, 841.89]);
  const margin = 42.5; // 15 mm
  const footerH = 28;
  const headerH = 28;
  const w = page.getWidth() - margin * 2;
  const h = page.getHeight() - margin * 2 - footerH - headerH;
  const cellW = w / opts.cols;
  const cellH = h / opts.rows;
  page.drawText(opts.title, { x: margin, y: page.getHeight() - margin - 16, size: 12, font, color: rgb(0, 0, 0) });
  for (let i = 0; i < opts.cells.length && i < opts.cols * opts.rows; i++) {
    const col = i % opts.cols;
    const row = Math.floor(i / opts.cols);
    const x = margin + col * cellW;
    const y = page.getHeight() - margin - headerH - (row + 1) * cellH;
    page.drawRectangle({ x, y, width: cellW, height: cellH, borderColor: rgb(0.7, 0.7, 0.7), borderWidth: 0.5 });
    const cell = opts.cells[i];
    const pad = 8;
    const labelH = cell.label ? 18 : 0;
    if (cell.image) {
      const img =
        opts.style === "color" && cell.image[0] === 0xff
          ? await pdf.embedJpg(cell.image).catch(() => pdf.embedPng(cell.image!))
          : await pdf.embedPng(cell.image).catch(() => pdf.embedJpg(cell.image!));
      const maxW = cellW - pad * 2;
      const maxH = cellH - pad * 2 - labelH;
      const scale = Math.min(maxW / img.width, maxH / img.height);
      const iw = img.width * scale;
      const ih = img.height * scale;
      page.drawImage(img, {
        x: x + (cellW - iw) / 2,
        y: y + pad + labelH + (maxH - ih) / 2,
        width: iw,
        height: ih,
      });
    }
    if (cell.label) {
      const size = 12;
      const tw = font.widthOfTextAtSize(cell.label, size);
      page.drawText(cell.label, {
        x: x + (cellW - tw) / 2,
        y: y + 8,
        size,
        font,
        color: rgb(0, 0, 0),
      });
    }
    if (opts.cropMarks) {
      page.drawLine({ start: { x, y }, end: { x: x + 6, y }, thickness: 0.6, color: rgb(0, 0, 0) });
      page.drawLine({ start: { x, y }, end: { x, y: y + 6 }, thickness: 0.6, color: rgb(0, 0, 0) });
    }
  }
  page.drawText("Изображения созданы ИИ. Проверьте перед печатью.", {
    x: margin,
    y: margin,
    size: 9,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  return Buffer.from(await pdf.save());
}
