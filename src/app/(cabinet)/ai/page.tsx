"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GENERATION_KIND } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { ImagesWizard } from "@/components/images-wizard";

const KINDS = ["DIAGNOSTICS", "PROGRAM", "CONCLUSION", "TASKS"] as const;

function AiDocs() {
  const sp = useSearchParams();
  const [pupils, setPupils] = useState<{ id: string; fullName: string }[]>([]);
  const [pupilId, setPupilId] = useState(sp.get("pupil") || "");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("CONCLUSION");
  const [extra, setExtra] = useState("");
  const [content, setContent] = useState("");
  const [genId, setGenId] = useState("");
  const [history, setHistory] = useState<{ id: string; title: string; kind: string; createdAt: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [usage, setUsage] = useState<{ remaining?: string }>({});

  useEffect(() => {
    fetch("/api/pupils").then((r) => r.json()).then((d) => setPupils(d.pupils || []));
    fetch("/api/ai/generations").then((r) => r.json()).then((d) => setHistory(d.items || []));
    fetch("/api/ai/usage").then((r) => r.json()).then((d) => {
      const lim = d.limits;
      if (!lim || lim.unlimited || !Number.isFinite(lim.generationsPerMonth)) setUsage({ remaining: "лимиты сняты" });
      else {
        const left = Math.max(0, lim.generationsPerMonth - (d.usage?.generationsCount || 0));
        const rub = Math.round((d.usage?.costRub || 0) * 100) / 100;
        setUsage({ remaining: `${left} из ${lim.generationsPerMonth} текстов · ${rub} из ${lim.rubCeiling} ₽` });
      }
    }).catch(() => undefined);
  }, []);

  async function generate() {
    setLoading(true);
    setContent("");
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, pupilId: pupilId || undefined, extra }),
      });
      if (!res.ok || !res.body) throw new Error((await res.json().catch(() => ({}))).error || "Ошибка генерации");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() || "";
        for (const part of parts) {
          const ev = /event: (\w+)/.exec(part)?.[1];
          const data = /data: (.+)/.exec(part)?.[1];
          if (!ev || !data) continue;
          const json = JSON.parse(data);
          if (ev === "start") setGenId(json.id);
          if (ev === "delta") setContent((c) => c + json.text);
          if (ev === "done") {
            setContent(json.content);
            setGenId(json.id);
          }
          if (ev === "error") toast.error(json.message);
        }
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-4 grid gap-2 sm:grid-cols-4">
        {KINDS.map((k) => (
          <button key={k} type="button" className={`min-h-11 rounded-xl border p-3 text-left ${kind === k ? "border-primary bg-accent" : "border-border"}`} onClick={() => setKind(k)}>
            {GENERATION_KIND[k]}
          </button>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <select className="h-11 w-full rounded-md border border-input px-3" value={pupilId} onChange={(e) => setPupilId(e.target.value)}>
            <option value="">Без привязки к ученику</option>
            {pupils.map((p) => (
              <option key={p.id} value={p.id}>{p.fullName}</option>
            ))}
          </select>
          <Textarea value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Дополнительные сведения для черновика" />
          <p className="text-caption text-muted-foreground">Остаток: {usage.remaining || "—"}</p>
          <Button onClick={generate} disabled={loading}>{loading ? "Готовим черновик…" : "Сгенерировать"}</Button>
        </div>
        <div className="space-y-3">
          <Textarea className="min-h-[320px] font-sans" value={content} onChange={(e) => setContent(e.target.value)} />
          {genId && (
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline">
                <a href={`/api/ai/generations/${genId}/docx`}>Скачать DOCX</a>
              </Button>
              <Button
                variant="outline"
                onClick={async () => {
                  await fetch(`/api/ai/generations/${genId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content }) });
                  toast.success("Черновик сохранён");
                }}
              >
                Сохранить правки
              </Button>
            </div>
          )}
        </div>
      </div>
      <h2 className="mt-10 text-h2">История</h2>
      {!history.length ? (
        <EmptyState icon={Sparkles} title="История пуста" description="Сгенерируйте первый документ." className="mt-4" />
      ) : (
        <ul className="mt-4 space-y-2">
          {history.map((h) => (
            <li key={h.id}>
              <button type="button" className="w-full rounded-lg border border-border p-3 text-left" onClick={() => { setContent(h.content); setGenId(h.id); }}>
                <div className="font-medium">{h.title}</div>
                <div className="text-caption text-muted-foreground">{GENERATION_KIND[h.kind] || h.kind} · {formatDate(h.createdAt)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function AiPage() {
  const router = useRouter();
  const tab = useSearchParams().get("tab") === "pictures" ? "pictures" : "docs";

  return (
    <div>
      <PageHeader title="Документы ИИ" crumbs={[{ href: "/dashboard", label: "Кабинет" }, { label: "Документы ИИ" }]} />
      <Tabs value={tab} onValueChange={(v) => router.replace(v === "pictures" ? "/ai?tab=pictures" : "/ai")}>
        <TabsList>
          <TabsTrigger value="docs">Черновики</TabsTrigger>
          <TabsTrigger value="pictures">Картинки A4</TabsTrigger>
        </TabsList>
        <TabsContent value="docs">
          <AiDocs />
        </TabsContent>
        <TabsContent value="pictures">
          <ImagesWizard />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense>
      <AiPage />
    </Suspense>
  );
}
