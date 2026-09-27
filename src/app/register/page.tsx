"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordChecklist, PasswordInput } from "@/components/password-input";
import { AuthShell } from "@/components/auth-shell";
import { POSITION_OPTIONS } from "@/lib/labels";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    position: "Учитель-логопед",
    institution: "",
    pdConsent: false,
  });
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.pdConsent) {
      setError("Нужно согласие с политикой обработки данных");
      return;
    }
    try {
      const res = await api<{ devCode?: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          pdConsent: true,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      toast.success("Письмо с подтверждением отправлено");
      const q = new URLSearchParams({ email: form.email });
      if (res.devCode) q.set("code", res.devCode);
      router.push(`/verify?${q.toString()}`);
    } catch (err) {
      const msg = (err as Error).message;
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <AuthShell title="Создать кабинет">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="name">ФИО</Label>
          <Input id="name" autoComplete="name" className="mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="username" className="mt-1" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        </div>
        <div>
          <Label htmlFor="password">Пароль</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            className="mt-1"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
          <PasswordChecklist password={form.password} />
        </div>
        <div>
          <Label htmlFor="position">Должность</Label>
          <Select value={form.position} onValueChange={(v) => setForm({ ...form, position: v })}>
            <SelectTrigger id="position" className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POSITION_OPTIONS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="institution">Учреждение (необязательно)</Label>
          <Input id="institution" className="mt-1" value={form.institution} onChange={(e) => setForm({ ...form, institution: e.target.value })} />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={form.pdConsent} onCheckedChange={(v) => setForm({ ...form, pdConsent: !!v })} className="mt-0.5" />
          <span>
            Соглашаюсь с{" "}
            <Link className="text-primary underline" href="/policy">
              политикой обработки персональных данных
            </Link>{" "}
            и{" "}
            <Link className="text-primary underline" href="/terms">
              пользовательским соглашением
            </Link>
          </span>
        </label>
        {error && <p className="text-small text-destructive">{error}</p>}
        <Button className="w-full" type="submit">
          Создать кабинет
        </Button>
      </form>
      <p className="mt-4 text-sm">
        Уже есть аккаунт?{" "}
        <Link href="/login" className="text-primary">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}
