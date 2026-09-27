"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { PUPIL_STATUS, labelOf } from "@/lib/labels";
import { formatDate, plural } from "@/lib/format";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type Tag = { id: string; name: string; color: string };
type Pupil = {
  id: string;
  fullName: string;
  grade: string | null;
  school: string | null;
  status: string;
  tags: Tag[];
  nextEventAt?: string | null;
};

export default function PupilsPage() {
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [view, setView] = useState<"table" | "cards">("table");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  async function load() {
    setError("");
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (status) params.set("status", status);
      if (selectedTags.length) params.set("tags", selectedTags.join(","));
      const [p, t] = await Promise.all([fetch(`/api/pupils?${params}`).then((r) => r.json()), fetch("/api/tags").then((r) => r.json())]);
      setPupils(p.pupils || []);
      setTotal(p.total || 0);
      setTags(t.tags || []);
    } catch {
      setError("Не удалось загрузить. Проверьте соединение и повторите.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status, selectedTags]);

  async function archive(id: string) {
    const prev = pupils;
    setPupils((list) => list.filter((p) => p.id !== id));
    try {
      await api(`/api/pupils/${id}`, { method: "DELETE" });
      toast("Ученик в архиве", {
        action: {
          label: "Отменить",
          onClick: () => api(`/api/pupils/${id}`, { method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }) }).then(load),
        },
        duration: 10000,
      });
    } catch (e) {
      setPupils(prev);
      toast.error((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader
        title="Ученики"
        description={plural(total, ["ученик", "ученика", "учеников"])}
        crumbs={[{ href: "/dashboard", label: "Кабинет" }, { label: "Картотека" }]}
        actions={
          <Button asChild>
            <Link href="/pupils/new">Добавить ученика</Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по ФИО" className="max-w-xs" />
        {Object.entries(PUPIL_STATUS).map(([k, v]) => (
          <button
            key={k}
            type="button"
            aria-pressed={status === k}
            className={`min-h-11 rounded-full px-3 text-sm ${status === k ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
            onClick={() => setStatus(status === k ? "" : k)}
          >
            {v}
          </button>
        ))}
        {tags.slice(0, 8).map((t) => {
          const on = selectedTags.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              className={`min-h-11 rounded-full px-3 text-sm ${on ? "text-white" : "bg-secondary"}`}
              style={on ? { background: t.color } : undefined}
              onClick={() => setSelectedTags(on ? selectedTags.filter((id) => id !== t.id) : [...selectedTags, t.id])}
            >
              {t.name}
            </button>
          );
        })}
        <Button variant="outline" onClick={() => setView(view === "table" ? "cards" : "table")}>
          {view === "table" ? "Карточки" : "Таблица"}
        </Button>
      </div>
      {loading && <Skeleton className="h-64" />}
      {error && <ErrorState description={error} onRetry={load} />}
      {!loading && !error && pupils.length === 0 && (
        <EmptyState icon={Users} title="Пока нет учеников" description="Добавьте первого, чтобы вести картотеку." action={<Button asChild><Link href="/pupils/new">Добавить ученика</Link></Button>} />
      )}
      {!loading && pupils.length > 0 && view === "cards" && (
        <div className="grid gap-3 md:grid-cols-2">
          {pupils.map((p) => (
            <Link key={p.id} href={`/pupils/${p.id}`} className="rounded-xl border border-border bg-card p-4">
              <div className="font-medium">{p.fullName}</div>
              <div className="text-small text-muted-foreground">{[p.grade, p.school].filter(Boolean).join(" · ") || "класс не указан"}</div>
              <div className="mt-2 text-caption">{labelOf(PUPIL_STATUS, p.status)}</div>
            </Link>
          ))}
        </div>
      )}
      {!loading && pupils.length > 0 && view === "table" && (
        <>
          <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
            <table className="w-full text-small">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="p-3 w-10">
                    <input
                      type="checkbox"
                      aria-label="Выбрать всех"
                      onChange={(e) => setSelected(e.target.checked ? pupils.map((p) => p.id) : [])}
                    />
                  </th>
                  <th className="p-3">ФИО</th>
                  <th className="p-3">Класс</th>
                  <th className="p-3">Статус</th>
                  <th className="p-3">Следующее занятие</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {pupils.map((p) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={`Выбрать ${p.fullName}`}
                        checked={selected.includes(p.id)}
                        onChange={(e) => setSelected(e.target.checked ? [...selected, p.id] : selected.filter((id) => id !== p.id))}
                      />
                    </td>
                    <td className="p-3">
                      <Link href={`/pupils/${p.id}`} className="font-medium hover:underline">
                        {p.fullName}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {p.tags.map((t) => (
                          <span key={t.id} className="rounded-full px-2 py-0.5 text-caption text-white" style={{ background: t.color }}>
                            {t.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-3">{p.grade || "—"}</td>
                    <td className="p-3">{labelOf(PUPIL_STATUS, p.status)}</td>
                    <td className="p-3">{p.nextEventAt ? formatDate(p.nextEventAt) : "—"}</td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Действия">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem asChild>
                            <Link href={`/pupils/${p.id}`}>Открыть</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/pupils/${p.id}/edit`}>Редактировать</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => archive(p.id)}>В архив</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 md:hidden">
            {pupils.map((p) => (
              <Link key={p.id} href={`/pupils/${p.id}`} className="block rounded-xl border border-border bg-card p-4">
                <div className="font-medium">{p.fullName}</div>
                <div className="text-small text-muted-foreground">{labelOf(PUPIL_STATUS, p.status)} · {p.grade || "класс не указан"}</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
