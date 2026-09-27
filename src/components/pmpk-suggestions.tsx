"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

type PupilFields = {
  fullName?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  school?: string | null;
  grade?: string | null;
  reviewDate?: string | null;
};

type Analysis = {
  summary?: string;
  pupil?: PupilFields;
  pmpk?: { date?: string | null; number?: string | null; aop?: string | null };
  tags?: { id: string; evidence?: string }[];
  newTags?: { name: string; category?: string; evidence?: string }[];
  anonymizedPreview?: string;
};

const FIELD_LABELS: { key: keyof PupilFields; label: string }[] = [
  { key: "fullName", label: "ФИО" },
  { key: "birthDate", label: "Дата рождения" },
  { key: "gender", label: "Пол" },
  { key: "school", label: "Школа" },
  { key: "grade", label: "Класс" },
  { key: "reviewDate", label: "Пересмотр" },
];

function genderLabel(value?: string | null) {
  if (value === "MALE") return "мужской";
  if (value === "FEMALE") return "женский";
  return value || "";
}

export function PmpkSuggestions({
  pupilId,
  knownTags,
  current,
  refreshKey = 0,
  onApplied,
}: {
  pupilId: string;
  knownTags: { id: string; name: string }[];
  current?: { fullName?: string | null; birthDate?: string | null; gender?: string | null; school?: string | null; grade?: string | null };
  refreshKey?: number;
  onApplied?: () => void;
}) {
  const [status, setStatus] = useState<string>("NONE");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [attachment, setAttachment] = useState<{ fileName: string; url: string; sizeBytes: number; createdAt: string } | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [pickedNew, setPickedNew] = useState<Record<string, boolean>>({});
  const [pickedFields, setPickedFields] = useState<Record<string, boolean>>({});
  const statusRef = useRef("NONE");
  const autoQueued = useRef(false);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [starting, setStarting] = useState(false);
  const [openEv, setOpenEv] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  async function poll() {
    const d = await fetch(`/api/pupils/${pupilId}/pmpk/status`).then((r) => r.json());
    let nextStatus = d.status || "NONE";
    const name = d.attachment?.fileName || "";
    const canAnalyze = /\.(pdf|docx|jpe?g|png)$/i.test(name);
    const auto = d.autoAnalyze !== false;
    setAutoAnalyze(auto);
    if (auto && nextStatus === "NONE" && d.attachment && canAnalyze && !autoQueued.current) {
      autoQueued.current = true;
      const retry = await fetch(`/api/pupils/${pupilId}/pmpk/retry`, { method: "POST" });
      if (retry.ok) nextStatus = "QUEUED";
      else setError((await retry.json().catch(() => ({}))).error || "Не удалось запустить анализ");
    }
    statusRef.current = nextStatus;
    setStatus(nextStatus);
    setError(d.error || null);
    setAnalysis(d.analysis);
    setAttachment(d.attachment);
    if (d.analysis?.tags) {
      setPicked((prev) => {
        if (Object.keys(prev).length) return prev;
        const next: Record<string, boolean> = {};
        for (const t of d.analysis.tags) next[t.id] = true;
        return next;
      });
    }
    if (d.analysis?.pupil || d.analysis?.pmpk || d.analysis?.summary) {
      setPickedFields((prev) => {
        if (Object.keys(prev).length) return prev;
        const next: Record<string, boolean> = {};
        for (const field of FIELD_LABELS) {
          if (d.analysis.pupil?.[field.key]) next[field.key] = true;
        }
        if (d.analysis.summary) next.summary = true;
        if (d.analysis.pmpk?.date) next.pmpkDate = true;
        if (d.analysis.pmpk?.number) next.pmpkNumber = true;
        if (d.analysis.pmpk?.aop) next.aop = true;
        return next;
      });
    }
  }

  useEffect(() => {
    let stop = false;
    const run = () => {
      if (!stop) poll();
    };
    run();
    const t = setInterval(() => {
      if (statusRef.current === "QUEUED" || statusRef.current === "RUNNING") run();
    }, 3000);
    return () => {
      stop = true;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pupilId, refreshKey]);

  async function apply(all = false, none = false) {
    const tagIds = none ? [] : Object.entries(picked).filter(([, v]) => v || all).map(([id]) => id);
    const newTags = none
      ? []
      : (analysis?.newTags || []).filter((t) => pickedNew[t.name]);
    const pupil = analysis?.pupil;
    await api(`/api/pupils/${pupilId}/pmpk/apply`, {
      method: "POST",
      body: JSON.stringify({
        tagIds,
        newTags,
        diagnosis: !none && pickedFields.summary ? analysis?.summary : undefined,
        pmpkDate: !none && pickedFields.pmpkDate ? analysis?.pmpk?.date : undefined,
        pmpkNumber: !none && pickedFields.pmpkNumber ? analysis?.pmpk?.number : undefined,
        aopVariant: !none && pickedFields.aop ? analysis?.pmpk?.aop : undefined,
        fullName: !none && pickedFields.fullName ? pupil?.fullName : undefined,
        birthDate: !none && pickedFields.birthDate ? pupil?.birthDate : undefined,
        gender: !none && pickedFields.gender ? pupil?.gender : undefined,
        school: !none && pickedFields.school ? pupil?.school : undefined,
        grade: !none && pickedFields.grade ? pupil?.grade : undefined,
        pmpkNextAt: !none && pickedFields.reviewDate ? pupil?.reviewDate : undefined,
      }),
    });
    toast.success(none ? "Предложения отклонены" : "Предложения приняты");
    onApplied?.();
  }

  async function startAnalysis() {
    setStarting(true);
    setError(null);
    const retry = await fetch(`/api/pupils/${pupilId}/pmpk/retry`, { method: "POST" });
    const body = await retry.json().catch(() => ({}));
    setStarting(false);
    if (!retry.ok) {
      setError(body.error || "Не удалось запустить анализ");
      toast.error(body.error || "Не удалось запустить анализ");
      return;
    }
    statusRef.current = "QUEUED";
    setStatus("QUEUED");
  }

  const canAnalyze = /\.(pdf|docx|jpe?g|png)$/i.test(attachment?.fileName || "");
  const showManual = !!attachment && canAnalyze && status !== "QUEUED" && status !== "RUNNING" && !autoAnalyze;

  if (status === "QUEUED" || status === "RUNNING") {
    return (
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-primary reduce-motion:animate-none" />
          <div>
            <p className="font-medium">Анализируем заключение…</p>
            <p className="text-caption text-muted-foreground">Распознаём текст → Ищем диагнозы и направления</p>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full w-1/2 animate-pulse bg-primary reduce-motion:animate-none" />
        </div>
      </div>
    );
  }

  if (status === "FAILED") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-card p-4">
        <p className="text-small">Не удалось проанализировать: {error}</p>
        <Button className="mt-2" variant="outline" onClick={() => api(`/api/pupils/${pupilId}/pmpk/retry`, { method: "POST" }).then(() => setStatus("QUEUED"))}>
          Повторить
        </Button>
      </div>
    );
  }

  if (!analysis && !attachment) {
    return <p className="text-small text-muted-foreground">Загрузите файл заключения ниже. Для PDF, DOCX и фото затем нажмите «Анализ», если автоанализ выключен.</p>;
  }

  const nameById = Object.fromEntries(knownTags.map((t) => [t.id, t.name]));

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      {attachment && (
        <p className="text-small">
          Файл: {attachment.fileName}{" "}
          <a className="text-primary underline" href={attachment.url} target="_blank" rel="noreferrer">
            Открыть
          </a>
        </p>
      )}
      {attachment && !canAnalyze && (
        <p className="text-small text-muted-foreground">Для .doc доступно только хранение. Анализ работает с PDF, DOCX и фото.</p>
      )}
      {showManual && (
        <Button type="button" onClick={startAnalysis} disabled={starting}>
          {starting ? "Запускаем…" : "Анализ"}
        </Button>
      )}
      {error && status !== "FAILED" && <p className="text-small text-destructive">{error}</p>}
      {status === "DONE" && analysis && (
        <>
          <h3 className="text-h3">Предложения ИИ</h3>
          <p className="text-caption text-muted-foreground">Отметьте, что записать в карточку. Уже заполненное поле не меняется, пока вы его не отметите повторно и не примете.</p>
          <ul className="space-y-2">
            {FIELD_LABELS.filter((f) => analysis.pupil?.[f.key]).map((f) => (
              <li key={f.key}>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={!!pickedFields[f.key]} onCheckedChange={(v) => setPickedFields((p) => ({ ...p, [f.key]: !!v }))} />
                  <span>
                    {f.label}: {f.key === "gender" ? genderLabel(analysis.pupil?.[f.key]) : analysis.pupil?.[f.key]}
                    {current && f.key === "fullName" && current.fullName ? <span className="mt-1 block text-caption text-muted-foreground">Сейчас: {current.fullName}</span> : null}
                    {current && f.key === "school" && current.school ? <span className="mt-1 block text-caption text-muted-foreground">Сейчас: {current.school}</span> : null}
                    {current && f.key === "grade" && current.grade ? <span className="mt-1 block text-caption text-muted-foreground">Сейчас: {current.grade}</span> : null}
                  </span>
                </label>
              </li>
            ))}
            {analysis.summary && (
              <li>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={!!pickedFields.summary} onCheckedChange={(v) => setPickedFields((p) => ({ ...p, summary: !!v }))} />
                  <span>Формулировка: {analysis.summary}</span>
                </label>
              </li>
            )}
            {analysis.pmpk?.date && (
              <li>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={!!pickedFields.pmpkDate} onCheckedChange={(v) => setPickedFields((p) => ({ ...p, pmpkDate: !!v }))} />
                  <span>Дата заключения: {analysis.pmpk.date}</span>
                </label>
              </li>
            )}
            {analysis.pmpk?.number && (
              <li>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={!!pickedFields.pmpkNumber} onCheckedChange={(v) => setPickedFields((p) => ({ ...p, pmpkNumber: !!v }))} />
                  <span>Номер протокола: {analysis.pmpk.number}</span>
                </label>
              </li>
            )}
            {analysis.pmpk?.aop && (
              <li>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={!!pickedFields.aop} onCheckedChange={(v) => setPickedFields((p) => ({ ...p, aop: !!v }))} />
                  <span>Вариант АООП: {analysis.pmpk.aop}</span>
                </label>
              </li>
            )}
          </ul>
          <ul className="space-y-2">
            {(analysis.tags || []).map((t) => (
              <li key={t.id}>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={!!picked[t.id]} onCheckedChange={(v) => setPicked((p) => ({ ...p, [t.id]: !!v }))} />
                  <span>
                    <button type="button" className="underline-offset-2 hover:underline" onClick={() => setOpenEv(openEv === t.id ? null : t.id)}>
                      {nameById[t.id] || t.id}
                    </button>
                    {openEv === t.id && t.evidence && <span className="mt-1 block text-caption text-muted-foreground">{t.evidence}</span>}
                  </span>
                </label>
              </li>
            ))}
            {(analysis.newTags || []).map((t) => (
              <li key={t.name}>
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={!!pickedNew[t.name]} onCheckedChange={(v) => setPickedNew((p) => ({ ...p, [t.name]: !!v }))} />
                  <span>
                    Новый: {t.name}
                    {t.evidence && <span className="mt-1 block text-caption text-muted-foreground">{t.evidence}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => apply()}>
              Принять выбранное
            </Button>
            <Button type="button" variant="outline" onClick={() => apply(false, true)}>
              Отклонить всё
            </Button>
          </div>
          {analysis.anonymizedPreview && (
            <div>
              <button type="button" className="text-caption text-primary" onClick={() => setShowPreview((v) => !v)}>
                Что было передано ИИ
              </button>
              {showPreview && <p className="mt-1 text-caption text-muted-foreground">{analysis.anonymizedPreview}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
