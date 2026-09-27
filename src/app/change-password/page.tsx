"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/form";
import { PasswordChecklist, PasswordInput } from "@/components/password-input";
import { AuthShell } from "@/components/auth-shell";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) return toast.error("Пароли не совпадают");
    try {
      await api("/api/auth/change-password", { method: "POST", body: JSON.stringify({ password }) });
      toast.success("Пароль сохранён");
      router.push("/dashboard");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  return (
    <AuthShell title="Задайте свой пароль">
      <p className="mb-4 text-small text-muted-foreground">Перед работой в кабинете нужно сменить временный пароль.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="password">Новый пароль</Label>
          <PasswordInput id="password" autoComplete="new-password" className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordChecklist password={password} />
        </div>
        <div>
          <Label htmlFor="confirm">Повторите пароль</Label>
          <PasswordInput id="confirm" autoComplete="new-password" className="mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button className="w-full" type="submit">
          Сохранить и войти
        </Button>
      </form>
    </AuthShell>
  );
}
