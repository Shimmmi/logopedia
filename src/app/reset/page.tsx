"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/form";
import { PasswordChecklist, PasswordInput } from "@/components/password-input";
import { AuthShell } from "@/components/auth-shell";
import { api } from "@/lib/api";
import { toast } from "sonner";

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Пароли не совпадают");
      return;
    }
    try {
      await api("/api/auth/reset", {
        method: "POST",
        body: JSON.stringify({ token: sp.get("token"), password }),
      });
      toast.success("Пароль обновлён");
      router.push("/login");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  return (
    <AuthShell title="Новый пароль">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="password">Пароль</Label>
          <PasswordInput id="password" autoComplete="new-password" className="mt-1" value={password} onChange={(e) => setPassword(e.target.value)} />
          <PasswordChecklist password={password} />
        </div>
        <div>
          <Label htmlFor="confirm">Повторите пароль</Label>
          <PasswordInput id="confirm" autoComplete="new-password" className="mt-1" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        <Button className="w-full" type="submit">
          Сохранить
        </Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
