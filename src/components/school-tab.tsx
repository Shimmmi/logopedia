"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { toast } from "sonner";

const DAYS = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
const PARITY = [
  { id: "BOTH", label: "обе недели" },
  { id: "NUMERATOR", label: "числитель" },
  { id: "DENOMINATOR", label: "знаменатель" },
];

type Row = {
  id?: string;
  weekday: number;
  startMin: number;
  endMin: number;
  start?: string;
  end?: string;
  subject: string;
  parity: string;
  status: string;
  warned?: boolean;
};
type Bell = { id: string; name: string; shift: number; isDefault: boolean };

function toMin(v: string) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return 8 * 60;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function SchoolTab({ pupilId }: { pupilId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [bells, setBells] = useState<Bell[]>([]);
  const [file, setFile] = useState<{ fileName: string; status: string; error?: string | null } | null>(null);
  const [pull, setPull] = useState(true);
  const [sessions, setSessions] = useState(2);
  const [format, setFormat] = useState("INDIVIDUAL");
  const [minutes, setMinutes] = useState(40);
  const [shift, setShift] = useState(1);
  const [bellId, setBellId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await api<{
      pupil: { pullFromLessons: boolean; sessionsPerWeek: number; lessonFormat: string; lessonMinutes: number; shift: number; bellTemplateId: string | null; grade: string | null };
      lessons: Row[];
      bells: Bell[];
      file: { fileName: string; status: string; error?: string | null } | null;
    }>(`/api/pupils/${pupilId}/school`);
    setRows(d.lessons);
    setBells(d.bells);
    setFile(d.file);
    setPull(d.pupil.pullFromLessons);
    setSessions(d.pupil.sessionsPerWeek);
    setFormat(d.pupil.lessonFormat);
    setMinutes(d.pupil.lessonMinutes);
    setShift(d.pupil.shift);
    setBellId(d.pupil.bellTemplateId || d.bells.find((b) => b.isDefault)?.id || d.bells[0]?.id || "");
  }

  useEffect(() => {
    load().catch((e) => toast.error((e as Error).message));
  }, [pupilId]);

  useEffect(() => {
    if (!file || (file.status !== "QUEUED" && file.status !== "RUNNING")) return;
    const t = setInterval(() => load().catch(() => undefined), 2500);
    return () => clearInterval(t);
  }, [file?.status]);

  const draft = rows.filter((r) => r.status === "DRAFT");
  const accepted = rows.filter((r) => r.status === "ACCEPTED");
  const shown = draft.length ? draft : accepted;

  async function savePrefs(patch: Record<string, unknown>) {
    await api(`/api/pupils/${pupilId}/school`, { method: "PATCH", body: JSON.stringify(patch) });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
          <span>
            Можно забирать с уроков
            <span className="mt-1 block text-caption text-muted-foreground">Выключено — любой школьный урок занят. Включено — кроме русского и математики.</span>
          </span>
          <Switch
            checked={pull}
            onCheckedChange={(v) => {
              setPull(v);
              savePrefs({ pullFromLessons: v }).catch((e) => toast.error((e as Error).message));
            }}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Занятий в неделю</Label>
            <Input
              className="mt-1"
              type="number"
              min={1}
              max={7}
              value={sessions}
              onChange={(e) => setSessions(Number(e.target.value))}
              onBlur={() => savePrefs({ sessionsPerWeek: sessions })}
            />
          </div>
          <div>
            <Label>Минуты</Label>
            <Input
              className="mt-1"
              type="number"
              min={20}
              max={90}
              value={minutes}
              onChange={(e) => setMinutes(Number(e.target.value))}
              onBlur={() => savePrefs({ lessonMinutes: minutes })}
            />
          </div>
          <div>
            <Label>Формат</Label>
            <Select
              value={format}
              onValueChange={(v) => {
                setFormat(v);
                savePrefs({ lessonFormat: v });
              }}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INDIVIDUAL">Индивидуально</SelectItem>
                <SelectItem value="GROUP">Группа</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Смена</Label>
            <Select
              value={String(shift)}
              onValueChange={(v) => {
                setShift(Number(v));
                savePrefs({ shift: Number(v) });
              }}
            >
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 смена</SelectItem>
                <SelectItem value="2">2 смена</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div>
        <Label>Шаблон звонков</Label>
        <Select
          value={bellId}
          onValueChange={(v) => {
            setBellId(v);
            savePrefs({ bellTemplateId: v });
          }}
        >
          <SelectTrigger className="mt-1 max-w-sm"><SelectValue placeholder="Основная" /></SelectTrigger>
          <SelectContent>
            {bells.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
                {b.isDefault ? " · по умолчанию" : ""} · {b.shift} смена
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          const input = (e.currentTarget.elements.namedItem("file") as HTMLInputElement).files?.[0];
          if (!input) return;
          setBusy(true);
          try {
            const fd = new FormData();
            fd.append("file", input);
            const res = await fetch(`/api/pupils/${pupilId}/school`, { method: "POST", body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Не удалось загрузить");
            toast.success("Файл сохранён, разбираем расписание");
            await load();
          } catch (err) {
            toast.error((err as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <Label htmlFor="school-file">Расписание школы</Label>
          <Input id="school-file" name="file" type="file" accept=".doc,.docx,.xls,.xlsx,.pdf,.jpg,.jpeg,.png" className="mt-1" />
        </div>
        <Button type="submit" disabled={busy}>Загрузить</Button>
      </form>
      {file && (
        <p className="text-caption text-muted-foreground">
          {file.fileName}: {file.status === "DONE" ? "разобрано" : file.status === "FAILED" ? file.error || "ошибка" : "разбор…"}
        </p>
      )}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-small">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">День</th>
              <th className="p-2">Начало</th>
              <th className="p-2">Конец</th>
              <th className="p-2">Предмет</th>
              <th className="p-2">Неделя</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id || i} className="border-t border-border">
                <td className="p-2">{DAYS[r.weekday] || r.weekday}</td>
                <td className="p-2">{r.start}</td>
                <td className="p-2">{r.end}</td>
                <td className="p-2">
                  {r.subject}
                  {r.warned && <span className="ml-2 text-caption text-destructive">время не совпало со звонками</span>}
                </td>
                <td className="p-2">{PARITY.find((p) => p.id === r.parity)?.label || r.parity}</td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>Пока нет строк. Загрузите файл или допишите урок.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <ManualRow
        onAdd={(row) => {
          const next = [...(draft.length ? draft : []), row];
          setRows([...accepted, ...next.map((r) => ({ ...r, status: "DRAFT" }))]);
          api(`/api/pupils/${pupilId}/school`, {
            method: "PATCH",
            body: JSON.stringify({
              rows: next.map((r) => ({ ...r, startMin: r.startMin, endMin: r.endMin })),
            }),
          }).then(() => load());
        }}
      />
      {!!draft.length && (
        <Button
          onClick={async () => {
            await api(`/api/pupils/${pupilId}/school`, { method: "PATCH", body: JSON.stringify({ accept: true }) });
            toast.success("Расписание принято");
            load();
          }}
        >
          Принять
        </Button>
      )}
    </div>
  );
}

function ManualRow({ onAdd }: { onAdd: (row: Row) => void }) {
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("08:30");
  const [end, setEnd] = useState("09:10");
  const [subject, setSubject] = useState("");
  const [parity, setParity] = useState("BOTH");
  return (
    <form
      className="grid gap-2 md:grid-cols-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!subject.trim()) return;
        onAdd({
          weekday: Number(weekday),
          startMin: toMin(start),
          endMin: toMin(end),
          start,
          end,
          subject: subject.trim(),
          parity,
          status: "DRAFT",
          warned: false,
        });
        setSubject("");
      }}
    >
      <Select value={weekday} onValueChange={setWeekday}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {DAYS.slice(1, 6).map((d, i) => (
            <SelectItem key={d} value={String(i + 1)}>{d}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={start} onChange={(e) => setStart(e.target.value)} aria-label="Начало" />
      <Input value={end} onChange={(e) => setEnd(e.target.value)} aria-label="Конец" />
      <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Предмет" />
      <Select value={parity} onValueChange={setParity}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {PARITY.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" variant="outline">Добавить</Button>
    </form>
  );
}
