"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FolderOpen,
  Sparkles,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Bell,
  Menu,
  Search,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_LABELS } from "@/lib/labels";
import { Logo } from "@/components/logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Command, CommandItem, CommandList } from "@/components/ui/command";
import { Hotkeys } from "@/components/hotkeys";
import { useTheme } from "next-themes";
import { formatRelative } from "@/lib/format";
import { applyA11yClasses } from "@/lib/a11y";
import { TimezoneBanner } from "@/components/timezone-banner";

const NAV = [
  { href: "/dashboard", label: "Главная", icon: LayoutDashboard },
  { href: "/pupils", label: "Картотека", icon: Users },
  { href: "/schedule", label: "Расписание", icon: CalendarDays },
  { href: "/documents", label: "Документы", icon: FolderOpen },
  { href: "/ai", label: "Документы ИИ", icon: Sparkles },
  { href: "/library", label: "Библиотека", icon: BookOpen },
  { href: "/reports", label: "Отчёты", icon: BarChart3 },
  { href: "/settings", label: "Настройки", icon: Settings },
];

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  plan: string;
  timezone: string;
  onboardingDone: boolean;
  mustChangePassword?: boolean;
  a11yLargeText?: boolean;
  a11yHighContrast?: boolean;
  a11yReduceMotion?: boolean;
};

type Note = { id: string; title: string; body: string; href?: string | null; readAt?: string | null; createdAt: string };

export function CabinetShell({ user, children }: { user: User; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { setTheme, theme } = useTheme();
  const [menu, setMenu] = useState(false);
  const [onboarding, setOnboarding] = useState(!user.onboardingDone);
  const [notes, setNotes] = useState<Note[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ pupils: { id: string; fullName: string }[]; documents: { id: string; fileName: string }[]; events: { id: string; title: string }[] }>({
    pupils: [],
    documents: [],
    events: [],
  });
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    applyA11yClasses(document.documentElement, user);
    if (user.mustChangePassword && path !== "/change-password") router.push("/change-password");
  }, [user, path, router]);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => setNotes(d.items || []));
  }, []);

  useEffect(() => {
    if (q.length < 2) {
      setHits({ pupils: [], documents: [], events: [] });
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then(setHits)
        .catch(() => undefined);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const unread = useMemo(() => notes.filter((n) => !n.readAt).length, [notes]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  async function finishOnboarding() {
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingDone: true }),
    });
    setOnboarding(false);
  }

  async function readAll() {
    const ids = notes.filter((n) => !n.readAt).map((n) => n.id);
    if (!ids.length) return;
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setNotes((prev) => prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() })));
  }

  const nav = (
    <nav className="flex-1 space-y-1 px-3">
      {NAV.map((n) => {
        const Icon = n.icon;
        const active = path === n.href || path.startsWith(n.href + "/");
        return (
          <Link
            key={n.href}
            href={n.href}
            onClick={() => setMenu(false)}
            className={cn(
              "flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm",
              active ? "bg-white/10" : "text-sidebar-muted hover:bg-white/5 hover:text-sidebar-fg"
            )}
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
            {n.label}
          </Link>
        );
      })}
      {user.role === "ADMIN" && (
        <Link href="/admin" className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-muted hover:bg-white/5">
          <Shield className="h-5 w-5" />
          Админка
        </Link>
      )}
    </nav>
  );

  const userCard = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="flex w-full items-center gap-2 rounded-md px-3 py-3 text-left hover:bg-white/5">
          <Avatar name={user.name} />
          <span className="min-w-0">
            <span className="block truncate text-sm">{user.name}</span>
            <span className="block text-caption text-sidebar-muted">{PLAN_LABELS[user.plan] || user.plan}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem onClick={() => router.push("/settings?tab=profile")}>Профиль</DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>Настройки</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>Тема</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout}>
          <LogOut className="h-4 w-4" /> Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-screen">
      <Hotkeys />
      <aside className="hidden w-[264px] shrink-0 flex-col bg-sidebar text-sidebar-fg md:flex">
        <div className="px-4 py-5">
          <Logo inverted />
        </div>
        {nav}
        <div className="border-t border-white/10 p-2">{userCard}</div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-border bg-card px-3 py-2">
          <button type="button" className="flex h-11 w-11 items-center justify-center rounded-md md:hidden" aria-label="Меню" onClick={() => setMenu(true)}>
            <Menu className="h-5 w-5" />
          </button>
          <div className="md:hidden">
            <Logo size="sm" />
          </div>
          <div className="relative ml-auto flex-1 md:ml-0 md:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="global-search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Поиск учеников, документов, занятий"
              className="h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 text-sm"
              autoComplete="off"
            />
            {searchOpen && q.length >= 2 && (
              <div className="absolute z-40 mt-1 w-full rounded-lg border border-border bg-card p-2 shadow-md">
                <Command>
                  <CommandList>
                    {hits.pupils.map((p) => (
                      <CommandItem key={p.id} onSelect={() => { router.push(`/pupils/${p.id}`); setSearchOpen(false); }}>
                        {p.fullName}
                      </CommandItem>
                    ))}
                    {hits.documents.map((d) => (
                      <CommandItem key={d.id} onSelect={() => { router.push("/documents"); setSearchOpen(false); }}>
                        {d.fileName}
                      </CommandItem>
                    ))}
                    {hits.events.map((e) => (
                      <CommandItem key={e.id} onSelect={() => { router.push("/schedule"); setSearchOpen(false); }}>
                        {e.title}
                      </CommandItem>
                    ))}
                    {!hits.pupils.length && !hits.documents.length && !hits.events.length && (
                      <p className="px-3 py-2 text-small text-muted-foreground">Ничего не найдено</p>
                    )}
                  </CommandList>
                </Command>
              </div>
            )}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={unread ? `Уведомления, ${unread} непрочитанных` : "Уведомления"}>
                <span className="relative">
                  <Bell className="h-5 w-5" />
                  {unread > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-destructive" />}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent>
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">Уведомления</p>
                <button type="button" className="text-caption text-primary" onClick={readAll}>
                  Прочитать все
                </button>
              </div>
              <ul className="max-h-80 space-y-2 overflow-auto">
                {notes.length === 0 && <li className="text-small text-muted-foreground">Новых уведомлений нет.</li>}
                {notes.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <Link href={n.href || "/dashboard"} className="block rounded-md p-2 hover:bg-accent">
                      <div className="text-sm font-medium">{n.title}</div>
                      <div className="text-caption text-muted-foreground">{n.body}</div>
                      <div className="text-caption text-muted-foreground">{formatRelative(n.createdAt, user.timezone)}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <TimezoneBanner profileTz={user.timezone} />
          {children}
        </main>
      </div>
      <Sheet open={menu} onOpenChange={setMenu}>
        <SheetContent side="left" className="bg-sidebar p-0 text-sidebar-fg">
          <div className="px-4 py-5">
            <Logo inverted />
          </div>
          {nav}
          <div className="border-t border-white/10 p-2">{userCard}</div>
        </SheetContent>
      </Sheet>
      {onboarding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" className="max-w-lg rounded-xl bg-card p-6">
            <h2 className="text-h2">Первые шаги</h2>
            <ol className="mt-4 list-decimal space-y-2 pl-5 text-small">
              <li>Добавьте ученика в картотеку.</li>
              <li>Поставьте занятие в расписании.</li>
              <li>Соберите черновик документа в разделе «Документы ИИ».</li>
            </ol>
            <div className="mt-6 flex gap-2">
              <Button onClick={finishOnboarding}>Начать работу</Button>
              <Button variant="ghost" onClick={finishOnboarding}>
                Пропустить
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
