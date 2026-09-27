"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Users, FileText, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import { EVENT_STATUS } from "@/lib/labels";
import { formatDateTime, plural } from "@/lib/format";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Dash = {
  userName?: string;
  counts: { pupils: number; generations: number; upcoming: number };
  upcoming: { id: string; title: string; start: string; eventId?: string }[];
  attention: { id: string; text: string; href: string }[];
  stats: { completed: number; canceled: number };
};

export default function DashboardPage() {
  const [data, setData] = useState<Dash | null>(null);
  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);
  if (!data) return <p className="text-muted-foreground">Загрузка…</p>;
  return (
    <div className="space-y-6">
      <PageHeader title={`Добрый день${data.userName ? `, ${data.userName.split(" ")[0]}` : ""}`} crumbs={[{ label: "Главная" }]} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/pupils/new", label: "Новый ученик", icon: Users },
          { href: "/schedule", label: "Занятие", icon: CalendarDays },
          { href: "/documents", label: "Документ", icon: FileText },
          { href: "/ai", label: "Черновик ИИ", icon: Sparkles },
        ].map((a) => (
          <Button key={a.href} asChild variant="outline" className="h-14 justify-start">
            <Link href={a.href}>
              <a.icon className="h-5 w-5" /> {a.label}
            </Link>
          </Button>
        ))}
      </div>
      <section>
        <h2 className="text-h2">Сегодня</h2>
        {!data.upcoming.length ? (
          <EmptyState icon={CalendarDays} title="На сегодня занятий нет" className="mt-3" />
        ) : (
          <ul className="mt-3 space-y-2">
            {data.upcoming.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card p-3">
                <div>
                  <div className="font-medium">{u.title}</div>
                  <div className="text-small text-muted-foreground">{formatDateTime(u.start)}</div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!u.eventId) return;
                    await api(`/api/schedule/${u.eventId}/status`, { method: "POST", body: JSON.stringify({ status: "COMPLETED" }) });
                    toast.success(EVENT_STATUS.COMPLETED);
                  }}
                >
                  Проведено
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2 className="text-h2">Требует внимания</h2>
        <ul className="mt-3 space-y-2">
          {(data.attention || []).map((a) => (
            <li key={a.id}>
              <Link href={a.href} className="text-small text-primary hover:underline">
                {a.text}
              </Link>
            </li>
          ))}
          {!(data.attention || []).length && <p className="text-small text-muted-foreground">Срочных задач нет.</p>}
        </ul>
      </section>
      <section>
        <h2 className="text-h2">За неделю</h2>
        <p className="mt-2 text-small text-muted-foreground">
          Проведено: {data.stats.completed}. Отменено: {data.stats.canceled}. {plural(data.counts.pupils, ["ученик", "ученика", "учеников"])} в картотеке.
        </p>
      </section>
    </div>
  );
}
