"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { PasswordInput } from "@/components/password-input";
import { AuthShell } from "@/components/auth-shell";
import { api } from "@/lib/api";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [providers, setProviders] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then((d) => setProviders(d.providers || []));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api<{ mustChangePassword?: boolean }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, totp: totp || undefined, remember }),
      });
      router.push(res.mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes("Подтвердите")) {
        router.push(`/verify?email=${encodeURIComponent(email)}`);
        return;
      }
      if (msg.includes("2FA")) setNeedTotp(true);
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <AuthShell title="Вход">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="password">Пароль</Label>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="mt-1"
          />
        </div>
        {needTotp && (
          <div>
            <Label htmlFor="totp">Код 2FA</Label>
            <Input id="totp" autoComplete="one-time-code" value={totp} onChange={(e) => setTotp(e.target.value)} className="mt-1" />
          </div>
        )}
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
          Запомнить меня на 30 дней
        </label>
        {error && <p className="text-small text-destructive">{error}</p>}
        <Button className="w-full" type="submit">
          Войти
        </Button>
      </form>
      {providers.length > 0 && (
        <div className="mt-4 space-y-2">
          {providers.map((p) => (
            <Button key={p.id} variant="outline" className="w-full" asChild>
              <a href={`/api/auth/oauth/${p.id}`}>{p.label}</a>
            </Button>
          ))}
        </div>
      )}
      <div className="mt-4 flex justify-between text-sm">
        <Link href="/forgot" className="text-primary">
          Забыли пароль?
        </Link>
        <Link href="/register" className="text-primary">
          Регистрация
        </Link>
      </div>
    </AuthShell>
  );
}
