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
}) {
  const styleLine =
    opts.style === "outline"
      ? "Black-and-white coloring page: bold clean outlines, no fills, no shading, no grey. Empty boxes stay empty so a child can tick them."
      : "Soft flat colours for children, thick friendly outlines, no photorealism, no 3D, no tiny details.";
  const sound = opts.sound || "";
  const soundTitle = sound ? `Звук [${sound}]` : opts.title;
  const footer = `Footer, small Russian text: "Изображения созданы ИИ. Проверьте перед печатью."`;
  const rules = `The image IS one printable A4 portrait worksheet for a Russian speech therapist, children aged ${opts.age || "5–8"}.
White paper, about 12 mm margins, clear sections with rounded frames and big numbers.
ALL visible words are Russian, large printed block letters, never cursive, never English.
Do not invent extra Russian words. Draw only the objects listed. Leave every checkbox and circle empty.
No brand, logo, watermark, photo, or speech balloon.
Do not draw mouths, tongues, teeth, lips, or any anatomical diagram.
${styleLine}
${footer}`;

  if (opts.kind === "STORY") {
    const scene = opts.words[0];
    return `${rules}
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
    return `${rules}
Title in Russian: "Раскрась: ${w?.word || opts.title}".
One very large centered object: ${w?.promptEn || "a friendly animal"}.
Under it the Russian word "${w?.word || ""}" and the instruction "Раскрась и назови".
Three empty circles in a row labelled "красный", "жёлтый", "зелёный" so the child can mark the colour.`;
  }
  if (opts.kind === "LOTO") {
    const cells = opts.words.map((w, i) => `${i + 1}. ${w.word} — ${w.promptEn}`).join("\n");
    return `${rules}
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
  const row = (list: SheetWord[]) => list.map((w) => `${w.word} (${w.promptEn})`).join("; ");
  const blocks: string[] = [];
  let n = 1;
  blocks.push(`Task ${n}, heading "${n}. Назови картинки".
Four large objects in one row, Russian word under each, empty square under the word.
Objects, left to right: ${row(named)}.
Instruction: "Назови каждое слово".`);
  n += 1;
  if (odd) {
    blocks.push(`Task ${n}, heading "${n}. Найди лишнее".
Four large objects in a row, one empty circle under each object.
Objects left to right: ${row([...named.slice(0, 3), odd])}.
The only object whose Russian name does not contain the sound [${sound}] is "${odd.word}".
Instruction, exact Russian: "Обведи картинку без звука [${sound}]".`);
    n += 1;
  }
  const taskListen = listen
    .map(
      (w, i) => `Picture ${i + 1}: draw ${w.promptEn}, Russian word "${w.word}" under it, then THAT picture's own three empty checkboxes labelled exactly "в начале", "в середине", "в конце".`
    )
    .join("\n");
  blocks.push(`Task ${n}, heading "${n}. Где звук?".
Each picture has its own answer marks. Do not share one set of checkboxes between two pictures.
${taskListen}
Instruction: "${sound ? `Отметь, где слышится звук [${sound}]` : "Отметь, где слышится звук"}".`);
  n += 1;
  blocks.push(`Task ${n}, heading "${n}. Раскрась".
One large outline of the first object (${named[0]?.word || "предмет"}: ${named[0]?.promptEn || "a simple object"}) with the instruction "Раскрась и назови слово".`);
  return `${rules}
Title, very large: "${soundTitle}".
Subtitle: "${odd ? "Назови, найди и отметь" : "Назови и отметь"}".
Number the tasks ${blocks.length === 4 ? "1, 2, 3, 4" : "1, 2, 3"} with no gaps.
${blocks.join("\n\n")}
`;
}

export function imagePrompt(promptEn: string, style: "outline" | "color") {
  const styleLine =
    style === "outline"
      ? "style: black line-art outline without fills, shading, gradients or grey tones"
      : "style: soft flat colours, no outlines of text";
  return `Simple children's illustration for speech-therapy flashcards: a single ${promptEn}, large and centered, plain white background, no text, letters or digits, no extra details, no watermarks, clear for children aged 5-10, ${styleLine}.`;
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
