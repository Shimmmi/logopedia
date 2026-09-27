"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { AuthShell } from "@/components/auth-shell";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/auth/forgot", { method: "POST", body: JSON.stringify({ email }) });
      toast.success("Если аккаунт существует, мы отправили ссылку");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }
  return (
    <AuthShell title="Восстановление пароля">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <Button className="w-full" type="submit">
          Отправить ссылку
        </Button>
      </form>
      <p className="mt-4 text-sm">
        <Link href="/login" className="text-primary">
          Вернуться ко входу
        </Link>
      </p>
    </AuthShell>
  );
}
