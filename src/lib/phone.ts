/**
 * Телефоны. Российские номера (начинаются с 7/8 или ровно 10 цифр) приводим
 * к маске «+7 (XXX) XXX-XX-XX»; иностранные (+375, +380, +996 …) не трогаем.
 */

function digitsOf(v: string) {
  return v.replace(/\D/g, "");
}

export function isRussianPhone(v: string) {
  const d = digitsOf(v);
  const raw = v.trim();
  if (!d) return true;
  if (raw.startsWith("+") && !d.startsWith("7")) return false;
  return d.startsWith("7") || d.startsWith("8") || d.length <= 10;
}

/** 11 цифр российского номера, начиная с 7. */
export function phoneDigits(v: string) {
  let d = digitsOf(v);
  if (!d) return "";
  // «8 …» → «7 …»; «+7 8 …» (пользователь начал с восьмёрки внутри маски) → «7 …»
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d.startsWith("78") && d.length >= 12) d = "7" + d.slice(2);
  if (!d.startsWith("7")) d = "7" + d;
  return d.slice(0, 11);
}

export function formatPhone(v: string) {
  if (!v) return "";
  if (!digitsOf(v)) return v.trim().startsWith("+") ? "+" : "";
  if (!isRussianPhone(v)) return "+" + digitsOf(v);
  const d = phoneDigits(v);
  const rest = d.slice(1);
  let out = "+7";
  if (rest.length > 0) out += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) out += ")";
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
  return out;
}

/** E.164 для хранения: +7XXXXXXXXXX или +<цифры> для иностранных. */
export function normalizePhone(v: string) {
  if (!v || !digitsOf(v)) return "";
  return isRussianPhone(v) ? `+${phoneDigits(v)}` : `+${digitsOf(v)}`;
}

/** Пустое значение (нет цифр) считается «заполненным» — телефон необязателен. */
export function isPhoneComplete(v: string) {
  if (!digitsOf(v)) return true;
  if (!isRussianPhone(v)) return digitsOf(v).length >= 10;
  return phoneDigits(v).length === 11;
}

/** Убрать последнюю цифру (для Backspace на разделителе маски). */
export function dropLastDigit(v: string) {
  const d = digitsOf(v);
  if (!d) return "";
  const next = d.slice(0, -1);
  if (!next) return v.trim().startsWith("+") && !isRussianPhone(v) ? "+" : "";
  if (isRussianPhone(v)) return next === "7" ? "" : formatPhone(next);
  return "+" + next;
}
