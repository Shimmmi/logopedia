export type SheetWord = { word: string; promptEn: string };

export function sheetGrid(n: number) {
  if (n <= 1) return { cols: 1, rows: 1 };
  if (n <= 4) return { cols: 2, rows: 2 };
  if (n <= 6) return { cols: 2, rows: 3 };
  return { cols: 2, rows: 4 };
}

export function sheetPrompt(opts: {
  kind: string;
  style: "outline" | "color";
  captions: boolean;
  title: string;
  sound?: string;
  age?: string;
  words: SheetWord[];
  odd?: SheetWord | null;
  extra?: string;
}) {
  const styleLine =
    opts.style === "outline"
      ? "Black line-art on white, no fill, no shading, no letters."
      : "Soft flat colours, thick friendly outlines, no photorealism, no letters.";
  const sound = opts.sound || "";
  const soundTitle = sound ? `Звук [${sound}]` : opts.title;
  const extra = (opts.extra || "").trim().slice(0, 500);
  const rules = `One object only, centered, plain white background, no frame, no caption, no letters, digits, watermark or extra objects.
${styleLine}
Do not draw mouths, tongues, teeth or anatomy.`;
  const withNote = extra ? `${rules}\nKeep this note: ${extra}` : rules;

  if (opts.kind === "STORY") {
    const scene = opts.words[0];
    return `${withNote}
Title in Russian: "Расскажи по картинке".
One large scene filling most of the page: ${scene?.promptEn || "a simple everyday scene with 4 clear objects"}.
Under the scene, three numbered empty lines with Russian prompts exactly:
1. Кто здесь?
2. Что делает?
3. Что случилось потом?
Age note in the corner: "${opts.age || "5–7"} лет".`;
  }
  if (opts.kind === "COLORING") {
    const w = opts.words[0];
    return `${withNote}
Title in Russian: "Раскрась: ${w?.word || opts.title}".
One very large centered object: ${w?.promptEn || "a friendly animal"}.
Under it the Russian word "${w?.word || ""}" and the instruction "Раскрась и назови".
Three empty circles in a row labelled "красный", "жёлтый", "зелёный" so the child can mark the colour.`;
  }
  if (opts.kind === "LOTO") {
    const cells = opts.words.map((w, i) => `${i + 1}. ${w.word} — ${w.promptEn}`).join("\n");
    return `${withNote}
Title in Russian: "Лото. ${soundTitle}".
A cut-apart grid of large cards, crop marks at each corner.
Each card: one object and, ${opts.captions ? `the Russian word under it` : "no word"}.
Cards:
${cells}
Instruction under the title: "Разрежь по линиям и назови".`;
  }

  const named = opts.words.slice(0, 4);
  const listen = (opts.words.slice(4, 6).length ? opts.words.slice(4, 6) : named.slice(0, 2)).slice(0, 2);
  const odd = sound && opts.odd ? opts.odd : null;
  const pictures = [...named];
  if (odd && !pictures.some((w) => w.word === odd.word)) pictures.push(odd);
  for (const w of listen) {
    if (!pictures.some((p) => p.word === w.word)) pictures.push(w);
  }
  const lines = pictures.map((w) => `${withNote}\nDraw: ${w.promptEn}.`);
  const tasks = [
    `1. Назови картинки — ${named.map((w) => w.word).join(", ")}`,
    odd ? `2. Найди лишнее — без звука [${sound}]: ${odd.word}` : "",
    `Где звук — ${listen.map((w) => w.word).join(", ")}`,
    `Раскрась — ${named[0]?.word || ""}`,
  ].filter(Boolean);
  return `Worksheet «${soundTitle}» is composed on the server. The model draws each object alone, with no text.\nTasks: ${tasks.join("; ")}.\n\n${lines.join("\n\n")}`;
}

export function imagePrompt(promptEn: string, style: "outline" | "color", extra?: string) {
  const styleLine =
    style === "outline"
      ? "style: black line-art outline without fills, shading, gradients or grey tones"
      : "style: soft flat colours, no outlines of text";
  const rules = `Simple children's illustration for speech-therapy flashcards: a single ${promptEn}, large and centered, plain white background, no text, letters or digits, no extra details, no watermarks, clear for children aged 5-10, ${styleLine}.`;
  const note = (extra || "").trim().slice(0, 500);
  return note ? `${rules}\nKeep this note: ${note}` : rules;
}

export const OPPOSITE: Record<string, string[]> = {
  С: ["Ш", "З"],
  "С'": ["Щ", "З'"],
  З: ["С", "Ж"],
  "З'": ["С'"],
  Ш: ["С", "Ж"],
  Ж: ["Ш", "З"],
  Р: ["Л"],
  "Р'": ["Л'"],
  Л: ["Р"],
  "Л'": ["Р'"],
  Ч: ["Т'"],
  Щ: ["С'"],
  Ц: ["С"],
};
