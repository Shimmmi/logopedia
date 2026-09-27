function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stems(name: string): string[] {
  const parts = name
    .split(/[\s-]+/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);
  return parts.map((p) => p.replace(/[аяуюоеыиьй]+$/i, "").slice(0, 12)).filter((p) => p.length >= 3);
}

export function anonymize(
  text: string,
  pupil: { fullName: string; birthDate?: Date | string | null; contacts?: { fullName: string }[] }
) {
  let out = text;
  const names = [pupil.fullName, ...(pupil.contacts || []).map((c) => c.fullName)];
  for (const name of names) {
    for (const stem of stems(name)) {
      out = out.replace(new RegExp(`${escapeRe(stem)}[а-яё]*`, "gi"), "[ребёнок]");
    }
  }
  out = out.replace(
    /(?:рожд[а-яё.]*|д\.?\s*р\.?)[^\d]{0,12}\d{1,2}[./]\d{1,2}[./]\d{2,4}/gi,
    "[дата]"
  );
  out = out.replace(/\b\d{1,2}[./]\d{1,2}[./]\d{4}\b/g, (m) => {
    if (!pupil.birthDate) return m;
    const d = new Date(pupil.birthDate);
    const iso = `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
    return m.replace(/\//g, ".") === iso ? "[дата]" : m;
  });
  out = out.replace(/(?:г\.\s*)?[А-ЯЁ][а-яё]+(?:\s+(?:ул|пр|пер|просп|пл)\.?[^\n,]{0,40})?(?:\s+д\.?\s*\d+[а-я]?)?(?:\s+кв\.?\s*\d+)?/g, (m) => {
    if (/ул\.|пр\.|пер\.|д\.\s*\d|кв\./i.test(m)) return "[адрес]";
    return m;
  });
  out = out.replace(/\b\d{3}-\d{3}-\d{3}\s?\d{2}\b/g, "[снилс]");
  out = out.replace(/\b\d{4}\s?\d{6}\b/g, "[паспорт]");
  return out;
}
