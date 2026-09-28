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

export async function buildLessonPdf(opts: {
  title: string;
  sound?: string;
  nameRow: { image?: Buffer; label: string }[];
  oddRow?: { image?: Buffer; label: string; odd?: boolean }[];
  listenRow: { image?: Buffer; label: string }[];
  color?: { image?: Buffer; label: string };
}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await loadFontBytes());
  const page = pdf.addPage([595.28, 841.89]);
  const margin = 36;
  let y = page.getHeight() - margin - 18;
  const title = opts.sound ? `Звук [${opts.sound}]` : opts.title;
  page.drawText(title, { x: margin, y, size: 22, font, color: rgb(0, 0, 0) });
  y -= 28;

  async function row(heading: string, cells: { image?: Buffer; label: string }[], mark: "none" | "square" | "circle" | "checks", imgH = mark === "checks" ? 70 : mark === "none" ? 110 : 86) {
    page.drawText(heading, { x: margin, y, size: 13, font, color: rgb(0, 0, 0) });
    y -= 8;
    const n = Math.max(cells.length, 1);
    const gap = 8;
    const cellW = (page.getWidth() - margin * 2 - gap * (n - 1)) / n;
    const top = y;
    for (let i = 0; i < cells.length; i++) {
      const x = margin + i * (cellW + gap);
      const cell = cells[i];
      if (cell.image) {
        const embedded =
          cell.image[0] === 0xff
            ? await pdf.embedJpg(cell.image).catch(() => pdf.embedPng(cell.image!))
            : await pdf.embedPng(cell.image).catch(() => pdf.embedJpg(cell.image!));
        const scale = Math.min((cellW - 8) / embedded.width, imgH / embedded.height);
        const w = embedded.width * scale;
        const h = embedded.height * scale;
        page.drawImage(embedded, { x: x + (cellW - w) / 2, y: top - h, width: w, height: h });
      }
      const label = cell.label;
      const size = 12;
      const tw = font.widthOfTextAtSize(label, size);
      page.drawText(label, { x: x + (cellW - tw) / 2, y: top - imgH - 16, size, font, color: rgb(0, 0, 0) });
      if (mark === "square" || mark === "circle") {
        const s = 14;
        const mx = x + cellW / 2 - s / 2;
        const my = top - imgH - 36;
        if (mark === "circle") {
          page.drawSvgPath(`M ${mx + s} ${my + s / 2} A ${s / 2} ${s / 2} 0 1 0 ${mx} ${my + s / 2} A ${s / 2} ${s / 2} 0 1 0 ${mx + s} ${my + s / 2}`, {
            borderWidth: 1.2,
            borderColor: rgb(0, 0, 0),
          });
        } else {
          page.drawRectangle({ x: mx, y: my, width: s, height: s, borderWidth: 1, borderColor: rgb(0, 0, 0) });
        }
      } else if (mark === "checks") {
        const labels = ["в начале", "в середине", "в конце"];
        labels.forEach((lab, k) => {
          const bx = x + 4;
          const by = top - imgH - 34 - k * 14;
          page.drawRectangle({ x: bx, y: by, width: 9, height: 9, borderWidth: 1, borderColor: rgb(0, 0, 0) });
          page.drawText(lab, { x: bx + 14, y: by, size: 9, font, color: rgb(0, 0, 0) });
        });
      }
    }
    y = top - imgH - (mark === "checks" ? 78 : mark === "none" ? 28 : 52);
  }

  await row("1. Назови картинки", opts.nameRow, "none", 100);
  if (opts.oddRow?.length) {
    const sound = opts.sound ? ` [${opts.sound}]` : "";
    await row(`2. Найди лишнее. Обведи картинку без звука${sound}`, opts.oddRow, "none", 96);
  }
  const listenNo = opts.oddRow?.length ? "3" : "2";
  await row(`${listenNo}. Где звук${opts.sound ? ` [${opts.sound}]` : ""}?`, opts.listenRow, "checks");
  if (opts.color) {
    const colorNo = opts.oddRow?.length ? "4" : "3";
    await row(`${colorNo}. Раскрась и назови слово`, [opts.color], "none", 130);
  }
  page.drawText("Изображения созданы ИИ. Проверьте перед печатью.", {
    x: margin,
    y: 28,
    size: 9,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  return Buffer.from(await pdf.save());
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
