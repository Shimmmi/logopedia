"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import Link from "next/link";
import { BookOpen, FileText, ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { LIBRARY_KIND, GENERATION_KIND, labelOf } from "@/lib/labels";
import { formatDate } from "@/lib/format";

type Sheet = {
  id: string;
  title: string;
  sound?: string | null;
  createdAt: string;
  words: string[];
  url?: string | null;
  pdf: string;
};
type Draft = { id: string; title: string; kind: string; createdAt: string; content: string };
type Item = { id: string; title: string; body: string; sound?: string | null; kind: string; ageFrom?: number | null; ageTo?: number | null; userId?: string | null };

const SOUNDS = ["", "Р", "Р'", "Л", "Л'", "С", "С'", "Ш", "Ж", "Ц", "Ч", "Щ"];

export default function LibraryPage() {
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [qInput, setQInput] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sound, setSound] = useState("");
  const [reload, setReload] = useState(0);
  const [cardTitle, setCardTitle] = useState("");
  const [cardBody, setCardBody] = useState("");
  const [section, setSection] = useState<"sheets" | "drafts" | "method">("sheets");
  const [openDraft, setOpenDraft] = useState<Draft | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qInput), 300);
    return () => clearTimeout(t);
  }, [qInput]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sound) p.set("sound", sound);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    fetch(`/api/library?${p}`)
      .then((r) => r.json())
      .then((d) => {
        setSheets(d.sheets || []);
        setDrafts(d.drafts || []);
        setItems(d.items || []);
      });
  }, [q, sound, from, to, reload]);

  const months = useMemo(() => {
    const map = new Map<string, Sheet[]>();
    for (const s of sheets) {
      const key = s.createdAt.slice(0, 7);
      map.set(key, [...(map.get(key) || []), s]);
    }
    return Array.from(map.entries());
  }, [sheets]);

  const mine = useMemo(() => items.filter((it) => it.userId), [items]);
  const system = useMemo(() => items.filter((it) => !it.userId), [items]);

  return (
    <div>
      <PageHeader
        title="Библиотека"
        crumbs={[{ href: "/dashboard", label: "Кабинет" }, { label: "Библиотека" }]}
        actions={
          <Button asChild>
            <Link href="/ai?tab=pictures">Новый лист</Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder="Поиск по названию и словам" className="max-w-xs" />
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Дата с" className="max-w-[160px]" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Дата по" className="max-w-[160px]" />
        <div className="flex flex-wrap gap-1">
          {SOUNDS.map((s) => (
            <button
              key={s || "all"}
              type="button"
              className={`min-h-11 rounded-full border px-3 text-sm ${sound === s ? "border-primary bg-accent" : "border-border"}`}
              onClick={() => setSound(s)}
            >
              {s ? `[${s}]` : "Все звуки"}
            </button>
          ))}
        </div>
      </div>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["sheets", `Листы · ${sheets.length}`],
            ["drafts", `Черновики · ${drafts.length}`],
            ["method", `Методика · ${items.length}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`min-h-11 rounded-lg border px-4 text-sm ${section === id ? "border-primary bg-card shadow-sm" : "border-transparent bg-muted"}`}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {section === "sheets" &&
        (!sheets.length ? (
          <EmptyState
            icon={ImageIcon}
            title={q || sound || from || to ? "Ничего не найдено" : "Листов пока нет"}
            description={
              q || sound || from || to
                ? "Сбросьте звук или даты — или соберите новый лист."
                : "Соберите страницу с заданиями в разделе «Документы ИИ». Готовый лист появится здесь."
            }
            action={
              <Button asChild>
                <Link href="/ai?tab=pictures">Собрать лист</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-8">
            {months.map(([month, list]) => (
              <section key={month}>
                <h2 className="mb-3 text-h3">{monthLabel(month)}</h2>
                <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((s) => (
              <li key={s.id} className="overflow-hidden rounded-xl border border-border bg-card">
                {s.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.url} alt={s.title} className="aspect-[3/4] w-full bg-white object-contain" />
                ) : (
                  <div className="flex aspect-[3/4] items-center justify-center bg-muted text-muted-foreground">Нет превью</div>
                )}
                <div className="space-y-2 p-3">
                  <div className="font-medium">{s.title}</div>
                  <div className="text-caption text-muted-foreground">
                    {s.sound ? `[${s.sound}] · ` : ""}
                    {formatDate(s.createdAt)}
                  </div>
                  {s.words.length > 0 && <p className="text-caption text-muted-foreground">{s.words.join(", ")}</p>}
                  <div className="flex flex-wrap gap-2">
                    {s.url && (
                      <Button asChild variant="outline" className="min-h-11">
                        <a href={s.url} download>
                          PNG
                        </a>
                      </Button>
                    )}
                    <Button asChild className="min-h-11">
                      <a href={s.pdf}>PDF</a>
                    </Button>
                  </div>
                </div>
              </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ))}

      {section === "drafts" &&
        (!drafts.length ? (
          <EmptyState
            icon={FileText}
            title={q || from || to ? "Ничего не найдено" : "Черновиков нет"}
            description={
              q || from || to
                ? "Сбросьте поиск или даты."
                : "Заключения, программы и задания из «Документов ИИ» сохраняются здесь."
            }
            action={
              <Button asChild variant="outline">
                <Link href="/ai">Открыть черновики</Link>
              </Button>
            }
          />
        ) : (
          <ul className="space-y-2">
            {drafts.map((d) => (
              <li key={d.id}>
                <button type="button" className="w-full rounded-xl border border-border bg-card p-4 text-left" onClick={() => setOpenDraft(d)}>
                  <div className="font-medium">{d.title}</div>
                  <div className="text-caption text-muted-foreground">
                    {GENERATION_KIND[d.kind] || d.kind} · {formatDate(d.createdAt)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {section === "method" && (
        <div className="space-y-6">
          <section>
            <h2 className="mb-2 text-h3">Мои карточки</h2>
            <form
              className="mb-4 flex max-w-md flex-col gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!cardTitle.trim() || !cardBody.trim()) return;
                try {
                  await api("/api/library", { method: "POST", body: JSON.stringify({ title: cardTitle, body: cardBody, sound: sound || null, kind: "text" }) });
                  setCardTitle("");
                  setCardBody("");
                  setReload((n) => n + 1);
                  toast.success("Карточка сохранена");
                } catch (err) {
                  toast.error((err as Error).message);
                }
              }}
            >
              <Input value={cardTitle} onChange={(e) => setCardTitle(e.target.value)} placeholder="Название" />
              <Input value={cardBody} onChange={(e) => setCardBody(e.target.value)} placeholder="Текст карточки" />
              <Button type="submit" className="min-h-11">
                Сохранить карточку
              </Button>
            </form>
            {!mine.length ? (
              <p className="text-small text-muted-foreground">Своих карточек пока нет. Форма выше сохранит заметку только у вас.</p>
            ) : (
              <MaterialList items={mine} />
            )}
          </section>
          <section>
            <h2 className="mb-2 text-h3">Готовые материалы</h2>
            {!system.length ? <EmptyState icon={BookOpen} title="Ничего не найдено" /> : <MaterialList items={system} />}
          </section>
        </div>
      )}

      {openDraft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={() => setOpenDraft(null)}>
          <div className="max-h-[80vh] w-full max-w-2xl overflow-auto rounded-xl bg-card p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-h3">{openDraft.title}</h2>
            <p className="mt-1 text-caption text-muted-foreground">{formatDate(openDraft.createdAt)}</p>
            <pre className="mt-4 whitespace-pre-wrap font-sans text-small">{openDraft.content}</pre>
            <Button className="mt-4" variant="outline" onClick={() => setOpenDraft(null)}>
              Закрыть
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  const names = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"];
  return `${names[Number(m) - 1] || key} ${y}`;
}

function MaterialList({ items }: { items: Item[] }) {
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.id} className="rounded-xl border border-border bg-card p-4">
          <div className="font-medium">{it.title}</div>
          <div className="text-caption text-muted-foreground">
            {labelOf(LIBRARY_KIND, it.kind)}
            {it.sound ? ` · [${it.sound}]` : ""}
            {it.ageFrom ? ` · ${it.ageFrom}–${it.ageTo} лет` : ""}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-small">{it.body}</p>
        </li>
      ))}
    </ul>
  );
}
