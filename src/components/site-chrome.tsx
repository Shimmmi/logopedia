"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const LINKS = [
  { href: "/#how", label: "Как это работает" },
  { href: "/#security", label: "Безопасность" },
  { href: "/pricing", label: "Тарифы" },
];

export function SiteHeader({ user }: { user?: { name: string } | null }) {
  const [open, setOpen] = useState(false);
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }
  return (
    <header className="border-b border-border bg-background/90 backdrop-blur">
      <div className="content-wrap flex h-16 items-center justify-between px-4 md:px-6">
        <Logo />
        <nav className="hidden items-center gap-5 text-sm md:flex">
          {LINKS.filter((l) => !user || l.href !== "/#how").map((l) => (
            <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          ))}
          {user ? (
            <>
              <span className="text-foreground">{user.name}</span>
              <Button asChild>
                <Link href="/dashboard">Кабинет</Link>
              </Button>
              <button type="button" className="text-muted-foreground hover:text-foreground" onClick={logout}>
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-muted-foreground hover:text-foreground">
                Вход
              </Link>
              <Button asChild>
                <Link href="/register">Создать кабинет</Link>
              </Button>
            </>
          )}
        </nav>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-md md:hidden"
          aria-label="Открыть меню"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="flex flex-col gap-4 pt-12">
            <Logo />
            {LINKS.filter((l) => !user || l.href !== "/#how").map((l) => (
              <Link key={l.href} href={l.href} className="min-h-11 py-2" onClick={() => setOpen(false)}>
                {l.label}
              </Link>
            ))}
            {user ? (
              <>
                <p className="text-sm">{user.name}</p>
                <Button asChild>
                  <Link href="/dashboard" onClick={() => setOpen(false)}>
                    Кабинет
                  </Link>
                </Button>
                <button type="button" className="min-h-11 text-left" onClick={logout}>
                  Выйти
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="min-h-11 py-2" onClick={() => setOpen(false)}>
                  Вход
                </Link>
                <Button asChild>
                  <Link href="/register">Создать кабинет</Link>
                </Button>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="content-wrap grid gap-6 px-4 py-10 text-small text-muted-foreground md:grid-cols-3 md:px-6">
        <div>
          <Logo />
          <p className="mt-3">Кабинет учителя-логопеда. Данные хранятся на серверах в РФ.</p>
        </div>
        <div className="space-y-2">
          <p className="font-medium text-foreground">Документы</p>
          <Link href="/policy" className="block hover:text-foreground">
            Политика обработки ПД
          </Link>
          <Link href="/terms" className="block hover:text-foreground">
            Пользовательское соглашение
          </Link>
          <Link href="/pricing" className="block hover:text-foreground">
            Тарифы
          </Link>
        </div>
        <div className="space-y-1">
          <p className="font-medium text-foreground">Реквизиты</p>
          <p>ООО «ЛогоПед» (плейсхолдер)</p>
          <p>ИНН 0000000000 · ОГРН 0000000000000</p>
          <p>
            Поддержка:{" "}
            <a className="text-primary" href="mailto:support@logoped.site">
              support@logoped.site
            </a>
          </p>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-caption text-muted-foreground">
        © {new Date().getFullYear()} LogoPed
      </div>
    </footer>
  );
}
