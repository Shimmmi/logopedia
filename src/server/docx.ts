import { Document, Packer, Paragraph, HeadingLevel, TextRun, Table, TableRow, TableCell, WidthType } from "docx";
import ExcelJS from "exceljs";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, Content } from "mdast";

function textOf(node: Content | Root): string {
  if ("value" in node && typeof node.value === "string") return node.value;
  if ("children" in node && Array.isArray(node.children)) {
    return node.children.map((c) => textOf(c as Content)).join("");
  }
  return "";
}

function nodesToBlocks(nodes: Content[]): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const node of nodes) {
    if (node.type === "heading") {
      const level = node.depth === 1 ? HeadingLevel.HEADING_1 : node.depth === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      out.push(new Paragraph({ text: textOf(node), heading: level }));
    } else if (node.type === "list") {
      for (const item of node.children) {
        out.push(new Paragraph({ text: `• ${textOf(item)}` }));
      }
    } else if (node.type === "table") {
      const rows = node.children.map(
        (row) =>
          new TableRow({
            children: row.children.map(
              (cell) =>
                new TableCell({
                  children: [new Paragraph(textOf(cell))],
                  width: { size: 2000, type: WidthType.DXA },
                })
            ),
          })
      );
      out.push(new Table({ rows }));
    } else if (node.type === "paragraph" || node.type === "blockquote") {
      out.push(new Paragraph({ children: [new TextRun(textOf(node))] }));
    }
  }
  return out;
}

export async function markdownToDocx(title: string, body: string) {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(body) as Root;
  const children = [new Paragraph({ text: title, heading: HeadingLevel.HEADING_1 }), ...nodesToBlocks(tree.children)];
  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

export async function attendanceXlsx(
  rows: { date: string; pupil: string; title: string; status: string; minutes: number }[]
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Посещаемость");
  ws.addRow(["Дата", "Ученик", "Занятие", "Статус", "Минут"]);
  for (const r of rows) ws.addRow([r.date, r.pupil, r.title, r.status, r.minutes]);
  ws.columns.forEach((c) => {
    c.width = 22;
  });
  return wb.xlsx.writeBuffer();
}
