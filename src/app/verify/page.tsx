"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AuthShell } from "@/components/auth-shell";
import { OtpInput } from "@/components/otp-input";
import { api } from "@/lib/api";
import { toast } from "sonner";

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const email = sp.get("email") || "";
  const token = sp.get("token") || "";
  const [code, setCode] = useState(sp.get("code") || "");
  const [wait, setWait] = useState(60);

  useEffect(() => {
    if (!token || !email) return;
    api("/api/auth/verify-email", { method: "POST", body: JSON.stringify({ email, token }) })
      .then(() => router.push("/dashboard"))
      .catch((e) => toast.error((e as Error).message));
  }, [token, email, router]);

  useEffect(() => {
    const t = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api<{ mustChangePassword?: boolean }>("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      router.push(res.mustChangePassword ? "/change-password" : "/dashboard");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function resend() {
    try {
      await api("/api/auth/resend", { method: "POST", body: JSON.stringify({ email }) });
      setWait(60);
      toast.success("Письмо отправлено снова");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <AuthShell title="Подтверждение почты">
      <p className="mb-4 text-small text-muted-foreground">
        Мы отправили письмо на {email || "ваш адрес"}. Откройте ссылку или введите код.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <OtpInput value={code} onChange={setCode} />
        <Button className="w-full" type="submit" disabled={code.length !== 6}>
          Подтвердить
        </Button>
      </form>
      <div className="mt-4 flex flex-wrap justify-between gap-2 text-sm">
        <button type="button" className="text-primary disabled:text-muted-foreground" disabled={wait > 0} onClick={resend}>
          {wait > 0 ? `Отправить снова через ${wait} с` : "Отправить снова"}
        </button>
        <Link href="/register" className="text-primary">
          Изменить email
        </Link>
      </div>
    </AuthShell>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  );
}
