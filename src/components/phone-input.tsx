"use client";

import { Input } from "@/components/ui/form";
import { dropLastDigit, formatPhone } from "@/lib/phone";

/**
 * Поле телефона с маской «+7 (XXX) XXX-XX-XX».
 * Иностранные номера (введённые с «+» и не с 7) не маскируются.
 */
export function PhoneInput({
  value,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: string;
  onChange: (v: string) => void;
}) {
  const digitCount = (s: string) => s.replace(/\D/g, "").length;
  return (
    <Input
      type="tel"
      inputMode="tel"
      autoComplete="off"
      placeholder="+7 (___) ___-__-__"
      {...props}
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        if (!raw.trim()) return onChange("");
        const deleting = raw.length < value.length;
        // Backspace/Delete на разделителе маски: цифр не убавилось — убираем последнюю вручную
        if (deleting && digitCount(raw) === digitCount(value)) {
          return onChange(dropLastDigit(value));
        }
        // Стёрли последнюю значимую цифру — не оставляем «голое» +7
        if (deleting && raw.replace(/\D/g, "") === "7") return onChange("");
        onChange(formatPhone(raw));
      }}
    />
  );
}
