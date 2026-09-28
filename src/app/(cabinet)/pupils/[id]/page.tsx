"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { VoiceInput } from "@/components/voice-input";
import { api } from "@/lib/api";
import { EVENT_STATUS, PUPIL_STATUS, PROGRESS_AREAS, labelOf } from "@/lib/labels";
import { ageLabel, formatDate, formatDateTime, formatTime } from "@/lib/format";
import { toast } from "sonner";
import { CalendarPlus, MoreHorizontal, Repeat } from "lucide-react";
import { LessonDialog, LessonEvent, WEEKDAYS, parseRrule } from "@/components/lesson-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { parseLinks } from "@/lib/social";
import { SocialLinksView } from "@/components/social-links";
import { PmpkSuggestions } from "@/components/pmpk-suggestions";
import { SchoolTab } from "@/components/school-tab";
import { PmpkUpload, uploadWithProgress } from "@/components/pmpk-upload";
import { EmptyState } from "@/components/empty-state";
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";

type Tag = { id: string; name: string; color: string };
type Data = {
  pupil: {
    id: string;
    fullName: string;
    grade: string | null;
    school: string | null;
    diagnosis: string | null;
    birthDate: string | null;
    status: string;
    tags: Tag[];
    consent: { given: boolean; signedBy?: string | null } | null;
    contacts: { fullName: string; role: string; phone?: string | null; email?: string | null; links?: unknown }[];
    pmpkNextAt?: string | null;
    aopVariant?: string | null;
    pmpkDate?: string | null;
    pmpkNumber?: string | null;
  };
  notes: { id: string; body: string; createdAt: string }[];
  progress: { id: string; area: string; score: number; recordedAt: string }[];
  attachments: { id: string; fileName: string; fileType: string; url: string }[];
  events: { id: string; title: string; startAt: string; endAt: string; type: string; status: string; recurring: boolean; rrule: string | null; notes: string | null }[];
  generations: { id: string; kind: string; title: string }[];
};

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function PupilCardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tab = useSearchParams().get("tab") || "overview";
  const [data, setData] = useState<Data | null>(null);
  const [note, setNote] = useState("");
  const [scoreOpen, setScoreOpen] = useState(false);
  const [scoreArea, setScoreArea] = useState<string>(PROGRESS_AREAS[0].label);
  const [score, setScore] = useState(3);
  const recRef = useRef<MediaRecorder | null>(null);
  const [recording, setRecording] = useState(false);
  const [lessonOpen, setLessonOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<LessonEvent | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<{ id: string; title: string; recurring: boolean } | null>(null);
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Europe/Moscow";
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(PROGRESS_AREAS.map((a) => [a.label, true])));
  const [pmpkRev, setPmpkRev] = useState(0);

  async function load() {
    const d = await fetch(`/api/pupils/${id}`).then((r) => r.json());
    setData(d);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function saveNote() {
    await api(`/api/pupils/${id}/notes`, { method: "POST", body: JSON.stringify({ body: note }) });
    setNote("");
    load();
  }

  async function addProgress() {
    await api(`/api/pupils/${id}/progress`, { method: "POST", body: JSON.stringify({ area: scoreArea, score }) });
    setScoreOpen(false);
    load();
  }

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    await fetch(`/api/pupils/${id}/attachments`, { method: "POST", body: fd });
    load();
  }

  if (!data) return <p className="text-muted-foreground">Загрузка…</p>;
  const p = data.pupil;
  const now = Date.now();
  const series = data.events.filter((e) => e.recurring);
  const single = data.events.filter((e) => !e.recurring);
  const upcoming = single.filter((e) => new Date(e.startAt).getTime() >= now).sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
  const past = single.filter((e) => new Date(e.startAt).getTime() < now);
  const openEdit = (e: EventItem) => {
    setEditEvent({ id: e.id, title: e.title, startAt: e.startAt, endAt: e.endAt, type: e.type, rrule: e.rrule, notes: e.notes, pupilIds: [id] });
    setLessonOpen(true);
  };
  const dates = Array.from(new Set(data.progress.map((x) => formatDate(x.recordedAt))));
  const chart = dates.map((d) => {
    const row: Record<string, string | number> = { date: d };
    for (const area of PROGRESS_AREAS) {
      const last = data.progress.filter((x) => x.area === area.label && formatDate(x.recordedAt) === d).at(-1);
      if (last) row[area.label] = last.score;
    }
    return row;
  });

  return (
    <div className="space-y-4 print-area">
      <PageHeader
        title={p.fullName}
        description={`${ageLabel(p.birthDate)} · ${p.grade || "класс не указан"} · ${labelOf(PUPIL_STATUS, p.status)}`}
        crumbs={[{ href: "/pupils", label: "Ученики" }, { label: p.fullName }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={`/ai?pupil=${id}`}>Документ ИИ</Link>
            </Button>
            <Button asChild>
              <Link href={`/pupils/${id}/edit`}>Редактировать</Link>
            </Button>
            <Button variant="outline" className="no-print" onClick={() => window.print()}>
              Печать
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Ещё">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem
                  onClick={async () => {
                    await api(`/api/pupils/${id}`, { method: "DELETE" });
                    toast("В архиве", { action: { label: "Отменить", onClick: () => api(`/api/pupils/${id}`, { method: "PATCH", body: JSON.stringify({ status: "ACTIVE" }) }) }, duration: 10000 });
                    router.push("/pupils");
                  }}
                >
                  В архив
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />
      <div className="flex items-center gap-3">
        <Avatar name={p.fullName} className="h-12 w-12" />
        <div className="flex flex-wrap gap-1">
          {p.tags.map((t) => (
            <span key={t.id} className="rounded-full px-2 py-0.5 text-caption text-white" style={{ background: t.color }}>
              {t.name}
            </span>
          ))}
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => router.replace(`?tab=${v}`)}>
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="lessons">Занятия</TabsTrigger>
          <TabsTrigger value="progress">Динамика</TabsTrigger>
          <TabsTrigger value="pmpk">Заключение</TabsTrigger>
          <TabsTrigger value="school">Школа</TabsTrigger>
          <TabsTrigger value="docs">Документы</TabsTrigger>
          <TabsTrigger value="notes">Заметки</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-h3">Заключение</h2>
            <p className="mt-2 whitespace-pre-wrap text-small">{p.diagnosis || "Не указано"}</p>
            {p.pmpkNumber && <p className="mt-2 text-caption text-muted-foreground">Протокол: {p.pmpkNumber}</p>}
            {p.pmpkNextAt && <p className="mt-2 text-caption text-muted-foreground">Пересмотр: {formatDate(p.pmpkNextAt)}</p>}
            <Button asChild variant="outline" className="mt-3">
              <Link href={`?tab=pmpk`}>Файл и предложения ИИ</Link>
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-h3">Контакты</h2>
            <ul className="mt-2 text-small">
              {p.contacts?.length ? p.contacts.map((c, i) => (
                <li key={i}>
                  {c.role}: {c.fullName}
                  {c.phone && (
                    <>
                      {" · "}
                      <a className="text-primary underline underline-offset-2" href={`tel:${normalizePhone(c.phone)}`}>
                        {formatPhone(c.phone)}
                      </a>
                    </>
                  )}
                  {c.email && (
                    <>
                      {" · "}
                      <a className="text-primary underline underline-offset-2" href={`mailto:${c.email}`}>
                        {c.email}
                      </a>
                    </>
                  )}
                  <SocialLinksView links={parseLinks(c.links)} />
                </li>
              )) : <li className="text-muted-foreground">Не указаны</li>}
            </ul>
            <p className="mt-2 text-small">
              {p.consent?.given ? "Согласие на обработку персональных данных получено" : "Согласие на обработку персональных данных не получено"}
              {p.consent?.given && p.consent?.signedBy ? ` · подпись: ${p.consent.signedBy}` : ""}
            </p>
          </div>
        </TabsContent>
        <TabsContent value="lessons" className="space-y-3">
          {data.events.length > 0 && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setEditEvent(null);
                  setLessonOpen(true);
                }}
              >
                <CalendarPlus className="mr-2 h-5 w-5" />
                Добавить занятие
              </Button>
            </div>
          )}
          {series.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-4">
              <h2 className="text-h3">Регулярное расписание</h2>
              <ul className="mt-2 divide-y divide-border">
                {series.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 py-2 text-small">
                    <Repeat className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-muted-foreground">
                        {rruleSummary(e.rrule)} · {formatTime(e.startAt, tz)}–{formatTime(e.endAt, tz)} · с {formatDate(e.startAt, tz)}
                        {parseRrule(e.rrule).until ? ` по ${formatDate(parseRrule(e.rrule).until, tz)}` : ""}
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Действия: ${e.title}`}>
                          <MoreHorizontal className="h-5 w-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(e)}>Изменить</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => setDeleteEvent({ id: e.id, title: e.title, recurring: true })}>
                          Удалить серию
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {upcoming.length > 0 && <LessonList title="Ближайшие" items={upcoming} tz={tz} onEdit={openEdit} onDelete={(e) => setDeleteEvent({ id: e.id, title: e.title, recurring: false })} />}
          {past.length > 0 && <LessonList title="Прошедшие" items={past} tz={tz} onEdit={openEdit} onDelete={(e) => setDeleteEvent({ id: e.id, title: e.title, recurring: false })} />}
          {!data.events.length && (
            <EmptyState
              icon={CalendarPlus}
              title="Расписания пока нет"
              description="Добавьте регулярное занятие — оно появится в календаре и в напоминаниях."
              action={
                <Button
                  onClick={() => {
                    setEditEvent(null);
                    setLessonOpen(true);
                  }}
                >
                  <CalendarPlus className="mr-2 h-5 w-5" />
                  Добавить занятие
                </Button>
              }
            />
          )}
        </TabsContent>
        <TabsContent value="progress" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PROGRESS_AREAS.map((a) => (
              <button key={a.id} type="button" aria-pressed={visible[a.label]} className={`min-h-11 rounded-full px-3 text-sm ${visible[a.label] ? "bg-primary text-primary-foreground" : "bg-secondary"}`} onClick={() => setVisible((v) => ({ ...v, [a.label]: !v[a.label] }))}>
                {a.label}
              </button>
            ))}
            <Button onClick={() => setScoreOpen(true)}>Оценка</Button>
          </div>
          <div className="h-72 rounded-xl border border-border bg-card p-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart}>
                <XAxis dataKey="date" />
                <YAxis domain={[0, 5]} />
                <Tooltip />
                <Legend />
                {PROGRESS_AREAS.map((a, i) => visible[a.label] ? <Line key={a.id} type="monotone" dataKey={a.label} stroke={COLORS[i]} connectNulls /> : null)}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </TabsContent>
        <TabsContent value="pmpk" className="space-y-3">
          {typeof window !== "undefined" && sessionStorage.getItem(`pmpk-retry:${id}`) && (
            <div className="rounded-lg border border-border bg-card p-3 text-small">
              Файл заключения не загружен.{" "}
              <Button
                variant="outline"
                onClick={() => {
                  sessionStorage.removeItem(`pmpk-retry:${id}`);
                  document.getElementById("pmpk-replace")?.click();
                }}
              >
                Повторить
              </Button>
            </div>
          )}
          <PmpkSuggestions
            pupilId={id}
            knownTags={p.tags}
            refreshKey={pmpkRev}
            current={{ fullName: p.fullName, birthDate: p.birthDate, school: p.school, grade: p.grade }}
            onApplied={load}
          />
          <div className="rounded-xl border border-border bg-card p-4">
            <h2 className="text-h3">Заменить файл</h2>
            <div id="pmpk-replace" className="mt-2">
              <PmpkUpload
                file={null}
                onFile={async (f) => {
                  if (!f) return;
                  const up = await uploadWithProgress(`/api/pupils/${id}/pmpk`, f, { analyze: "1" });
                  if (!up.ok) toast.error((up.json as { error?: string }).error || "Не удалось загрузить");
                  else {
                    toast.success(up.json.analyze === false ? "Файл сохранён, анализ для этого формата недоступен" : "Файл загружен, анализируем заключение");
                    setPmpkRev((n) => n + 1);
                    load();
                  }
                }}
              />
            </div>
            <Button
              className="mt-3"
              variant="outline"
              onClick={async () => {
                await api(`/api/pupils/${id}/pmpk`, { method: "DELETE" });
                toast.success("Файл удалён");
                load();
              }}
            >
              Удалить файл
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="school" className="space-y-3">
          <SchoolTab pupilId={id} />
        </TabsContent>
        <TabsContent value="docs" className="space-y-3">
          <input type="file" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button variant="outline" onClick={async () => {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const rec = new MediaRecorder(stream);
            const chunks: Blob[] = [];
            rec.ondataavailable = (e) => chunks.push(e.data);
            rec.onstop = async () => upload(new File([new Blob(chunks, { type: "audio/webm" })], `занятие-${Date.now()}.webm`, { type: "audio/webm" }));
            rec.start();
            recRef.current = rec;
            setRecording(true);
          }}>{recording ? "Идёт запись" : "Записать аудио"}</Button>
          {recording && <Button onClick={() => { recRef.current?.stop(); setRecording(false); }}>Стоп</Button>}
          <ul className="space-y-2">
            {data.attachments.map((a) => (
              <li key={a.id}><a className="text-primary" href={a.url}>{a.fileName}</a></li>
            ))}
            {data.generations.map((g) => (
              <li key={g.id}><Link className="text-primary" href="/ai">{g.title}</Link></li>
            ))}
          </ul>
        </TabsContent>
        <TabsContent value="notes" className="space-y-3">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          <VoiceInput onText={(t) => setNote((n) => `${n} ${t}`)} />
          <Button onClick={saveNote}>Сохранить заметку</Button>
          <ul className="space-y-2 text-small">
            {data.notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border p-3">
                <div className="text-caption text-muted-foreground">{formatDateTime(n.createdAt)}</div>
                {n.body}
              </li>
            ))}
          </ul>
        </TabsContent>
      </Tabs>
      <LessonDialog
        open={lessonOpen}
        onOpenChange={setLessonOpen}
        pupils={[{ id, fullName: p.fullName }]}
        lockPupil={{ id, fullName: p.fullName }}
        event={editEvent}
        defaults={{ pupilIds: [id], recurring: !data.events.length }}
        onSaved={load}
      />
      <AlertDialog open={!!deleteEvent} onOpenChange={(v) => !v && setDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{deleteEvent?.recurring ? "Удалить серию занятий?" : "Удалить занятие?"}</AlertDialogTitle>
            <AlertDialogDescription>
              «{deleteEvent?.title}» исчезнет из календаря{deleteEvent?.recurring ? " вместе со всеми повторами" : ""}. Отметки посещаемости не восстановятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Оставить</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (!deleteEvent) return;
                try {
                  await api(`/api/schedule/${deleteEvent.id}`, { method: "DELETE" });
                  toast.success(deleteEvent.recurring ? "Серия удалена" : "Занятие удалено");
                  setDeleteEvent(null);
                  load();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={scoreOpen} onOpenChange={setScoreOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Оценка динамики</DialogTitle></DialogHeader>
          <select className="h-11 w-full rounded-md border border-input px-3" value={scoreArea} onChange={(e) => setScoreArea(e.target.value)}>
            {PROGRESS_AREAS.map((a) => <option key={a.id}>{a.label}</option>)}
          </select>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Button key={n} variant={score === n ? "default" : "outline"} onClick={() => setScore(n)}>{n}</Button>
            ))}
          </div>
          <Button onClick={addProgress}>Сохранить</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type EventItem = Data["events"][number];

function rruleSummary(rrule: string | null) {
  const { byweekday } = parseRrule(rrule);
  if (!byweekday.length) return "еженедельно";
  return WEEKDAYS.filter((d) => byweekday.includes(d.n))
    .map((d) => d.l)
    .join(", ");
}

function LessonList({
  title,
  items,
  tz,
  onEdit,
  onDelete,
}: {
  title: string;
  items: EventItem[];
  tz: string;
  onEdit: (e: EventItem) => void;
  onDelete: (e: EventItem) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-h3">{title}</h2>
      <ul className="mt-2 divide-y divide-border">
        {items.map((e) => (
          <li key={e.id} className="flex items-center gap-3 py-2 text-small">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{e.title}</div>
              <div className="text-muted-foreground">
                {formatDateTime(e.startAt, tz)} · {labelOf(EVENT_STATUS, e.status)}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={`Действия: ${e.title}`}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(e)}>Изменить</DropdownMenuItem>
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(e)}>
                  Удалить
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    </div>
  );
}
