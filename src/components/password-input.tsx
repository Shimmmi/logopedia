"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/form";
import { cn } from "@/lib/utils";

export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete = "current-password",
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        className={cn("pr-12", className)}
        {...props}
      />
      <button
        type="button"
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
        aria-label={show ? "Скрыть пароль" : "Показать пароль"}
        aria-pressed={show}
        onClick={() => setShow((v) => !v)}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

export function PasswordChecklist({ password }: { password: string }) {
  const items = [
    { ok: password.length >= 8, label: "Не менее 8 символов" },
    { ok: /[A-Za-zА-Яа-я]/.test(password), label: "Буквы" },
    { ok: /\d/.test(password), label: "Цифра" },
  ];
  return (
    <ul className="mt-2 space-y-1 text-caption">
      {items.map((i) => (
        <li key={i.label} className={i.ok ? "text-primary" : "text-muted-foreground"}>
          {i.ok ? "•" : "◦"} {i.label}
        </li>
      ))}
    </ul>
  );
}
