"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

export function OtpInput({
  value,
  onChange,
  length = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = value.padEnd(length, " ").slice(0, length).split("");

  function setAt(i: number, ch: string) {
    const next = value.split("");
    next[i] = ch;
    onChange(next.join("").replace(/\s/g, "").slice(0, length));
  }

  return (
    <div className="flex justify-between gap-2" role="group" aria-label="Код подтверждения">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={d.trim()}
          aria-label={`Цифра ${i + 1}`}
          className={cn(
            "h-12 w-11 rounded-md border border-input bg-card text-center text-lg tracking-widest"
          )}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "").slice(-1);
            setAt(i, v);
            if (v && refs.current[i + 1]) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && refs.current[i - 1]) {
              refs.current[i - 1]?.focus();
            }
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (text) {
              e.preventDefault();
              onChange(text);
              refs.current[Math.min(text.length, length) - 1]?.focus();
            }
          }}
        />
      ))}
    </div>
  );
}
