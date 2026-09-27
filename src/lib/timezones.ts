export type TimezoneOption = {
  id: string;
  city: string;
  offset: string;
};

/** 11 зон РФ + ближайшие пояса СНГ. */
export const TIMEZONES: TimezoneOption[] = [
  { id: "Europe/Kaliningrad", city: "Калининград", offset: "UTC+2" },
  { id: "Europe/Moscow", city: "Москва", offset: "UTC+3" },
  { id: "Europe/Samara", city: "Самара", offset: "UTC+4" },
  { id: "Asia/Yekaterinburg", city: "Екатеринбург", offset: "UTC+5" },
  { id: "Asia/Omsk", city: "Омск", offset: "UTC+6" },
  { id: "Asia/Novosibirsk", city: "Новосибирск", offset: "UTC+7" },
  { id: "Asia/Krasnoyarsk", city: "Красноярск", offset: "UTC+7" },
  { id: "Asia/Irkutsk", city: "Иркутск", offset: "UTC+8" },
  { id: "Asia/Yakutsk", city: "Якутск", offset: "UTC+9" },
  { id: "Asia/Vladivostok", city: "Владивосток", offset: "UTC+10" },
  { id: "Asia/Magadan", city: "Магадан", offset: "UTC+11" },
  { id: "Asia/Kamchatka", city: "Камчатка", offset: "UTC+12" },
  { id: "Europe/Minsk", city: "Минск", offset: "UTC+3" },
  { id: "Asia/Almaty", city: "Алматы", offset: "UTC+5" },
  { id: "Asia/Tashkent", city: "Ташкент", offset: "UTC+5" },
  { id: "Asia/Bishkek", city: "Бишкек", offset: "UTC+6" },
  { id: "Asia/Yerevan", city: "Ереван", offset: "UTC+4" },
  { id: "Asia/Baku", city: "Баку", offset: "UTC+4" },
  { id: "Asia/Tbilisi", city: "Тбилиси", offset: "UTC+4" },
  { id: "Europe/Chisinau", city: "Кишинёв", offset: "UTC+2" },
];

const ALIASES: Record<string, string> = {
  "Asia/Tomsk": "Asia/Novosibirsk",
  "Asia/Barnaul": "Asia/Novosibirsk",
  "Asia/Novokuznetsk": "Asia/Novosibirsk",
  "Asia/Krasnoyarsk": "Asia/Krasnoyarsk",
  "Europe/Kirov": "Europe/Moscow",
  "Europe/Volgograd": "Europe/Moscow",
  "Europe/Saratov": "Europe/Samara",
  "Europe/Ulyanovsk": "Europe/Samara",
  "Europe/Astrakhan": "Europe/Samara",
  "Asia/Qostanay": "Asia/Almaty",
  "Asia/Aqtobe": "Asia/Yekaterinburg",
};

export function findTimezone(id: string | null | undefined): TimezoneOption | undefined {
  if (!id) return undefined;
  const mapped = ALIASES[id] || id;
  return TIMEZONES.find((z) => z.id === mapped);
}

export function timezoneLabel(id: string | null | undefined): string {
  const z = findTimezone(id);
  if (z) return `${z.city} ${z.offset}`;
  return id || "Москва UTC+3";
}

export function timezoneCity(id: string | null | undefined): string {
  return findTimezone(id)?.city || id || "Москва";
}

export function formatNowInZone(id: string): string {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      timeZone: id,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date());
  } catch {
    return "";
  }
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Moscow";
  } catch {
    return "Europe/Moscow";
  }
}

export function sameTimezone(a: string, b: string): boolean {
  const left = findTimezone(a)?.id || a;
  const right = findTimezone(b)?.id || b;
  if (left === right) return true;
  try {
    const now = new Date();
    const fmt = (tz: string) =>
      new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).format(now);
    return fmt(a) === fmt(b);
  } catch {
    return false;
  }
}
