const MONTHS_SHORT = [
  "янв.",
  "февр.",
  "марта",
  "апр.",
  "мая",
  "июня",
  "июля",
  "авг.",
  "сент.",
  "окт.",
  "нояб.",
  "дек.",
];

export function plural(n: number, forms: [string, string, string]) {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return `${n}\u00a0${forms[2]}`;
  if (last > 1 && last < 5) return `${n}\u00a0${forms[1]}`;
  if (last === 1) return `${n}\u00a0${forms[0]}`;
  return `${n}\u00a0${forms[2]}`;
}

export function inTz(date: Date | string, tz = "Europe/Moscow") {
  return new Date(typeof date === "string" ? date : date.getTime()).toLocaleString("en-US", { timeZone: tz });
}

function parts(date: Date | string, tz = "Europe/Moscow") {
  const d = new Date(date);
  const fmt = new Intl.DateTimeFormat("ru-RU", {
    timeZone: tz,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const map = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: map.hour,
    minute: map.minute,
  };
}

export function formatDate(date: Date | string | null | undefined, tz = "Europe/Moscow") {
  if (!date) return "—";
  const p = parts(date, tz);
  return `${p.day}\u00a0${MONTHS_SHORT[p.month - 1]} ${p.year}`;
}

export function formatDateTime(date: Date | string | null | undefined, tz = "Europe/Moscow") {
  if (!date) return "—";
  const p = parts(date, tz);
  return `${p.day}\u00a0${MONTHS_SHORT[p.month - 1]}, ${p.hour}:${p.minute}`;
}

export function formatTime(date: Date | string | null | undefined, tz = "Europe/Moscow") {
  if (!date) return "—";
  const p = parts(date, tz);
  return `${p.hour}:${p.minute}`;
}

export function formatRelative(date: Date | string, tz = "Europe/Moscow") {
  const d = new Date(date);
  const now = new Date();
  const a = parts(d, tz);
  const b = parts(now, tz);
  if (a.year === b.year && a.month === b.month && a.day === b.day) {
    return `сегодня, ${a.hour}:${a.minute}`;
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const t = parts(tomorrow, tz);
  if (a.year === t.year && a.month === t.month && a.day === t.day) {
    return `завтра, ${a.hour}:${a.minute}`;
  }
  return formatDateTime(d, tz);
}

export function ageYears(birthDate: Date | string | null | undefined) {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years -= 1;
  return years;
}

export function ageLabel(birthDate: Date | string | null | undefined) {
  const y = ageYears(birthDate);
  if (y === null) return "возраст не указан";
  return plural(y, ["год", "года", "лет"]);
}

export function quotes(s: string) {
  return `«${s}»`;
}

export function nbsp(s: string) {
  return s
    .replace(/ (\S{1,2}) /g, " $1\u00a0")
    .replace(/(\d) /g, "$1\u00a0");
}
