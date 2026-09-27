export type SocialType = "telegram" | "max" | "vk";
export type SocialLink = { type: SocialType; value: string };

const TG_USER = /^[a-zA-Z0-9_]{5,32}$/;

export function normalizeSocial(type: SocialType, raw: string): SocialLink | { error: string } {
  const v = raw.trim();
  if (!v) return { error: "Укажите ссылку или имя" };
  if (type === "telegram") {
    const phone = v.replace(/[^\d+]/g, "");
    if (phone.replace(/\D/g, "").length >= 10 && /^\+?\d[\d\s()-]{9,}$/.test(v)) {
      const digits = phone.replace(/\D/g, "").replace(/^8/, "7");
      return { type, value: digits.startsWith("7") ? `+${digits}` : `+${digits}` };
    }
    const user = v
      .replace(/^https?:\/\/(t\.me|telegram\.me)\//i, "")
      .replace(/^@/, "")
      .replace(/\/.*$/, "");
    if (!TG_USER.test(user)) return { error: "Имя Telegram: 5–32 символа, латиница, цифры и _" };
    return { type, value: user };
  }
  if (type === "max") {
    const m = v.match(/https?:\/\/(?:www\.)?max\.ru\/u\/([A-Za-z0-9_-]+)/i);
    if (!m) return { error: "Вставьте ссылку вида https://max.ru/u/…" };
    return { type, value: `https://max.ru/u/${m[1]}` };
  }
  const vk = v
    .replace(/^https?:\/\/(www\.)?vk\.com\//i, "")
    .replace(/^https?:\/\/(www\.)?vk\.ru\//i, "")
    .replace(/^\//, "");
  if (!vk || /\s/.test(vk)) return { error: "Укажите vk.com/id… или короткое имя" };
  return { type, value: vk.split("?")[0] };
}

export function socialHref(link: SocialLink): string {
  if (link.type === "telegram") {
    if (link.value.startsWith("+")) return `https://t.me/${link.value}`;
    return `https://t.me/${link.value}`;
  }
  if (link.type === "max") return link.value;
  return `https://vk.com/${link.value}`;
}

export function socialLabel(type: SocialType) {
  return type === "telegram" ? "Telegram" : type === "max" ? "MAX" : "ВКонтакте";
}

export function parseLinks(raw: unknown): SocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is SocialLink => !!x && typeof x === "object" && "type" in x && "value" in x);
}
