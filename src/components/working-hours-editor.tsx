"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { toast } from "sonner";

export type WorkingHour = { weekday: number; startMin: number; endMin: number; bufferMinutes?: number };

const DAYS = [
  { n: 1, l: "Понедельник" },
  { n: 2, l: "Вторник" },
  { n: 3, l: "Среда" },
  { n: 4, l: "Четверг" },
  { n: 5, l: "Пятница" },
  { n: 6, l: "Суббота" },
  { n: 0, l: "Воскресенье" },
];

type Row = { weekday: number; on: boolean; start: string; end: string };

const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function toRows(hours: WorkingHour[]): Row[] {
  return DAYS.map((d) => {
    const h = hours.find((x) => x.weekday === d.n);
    return { weekday: d.n, on: !!h, start: toTime(h?.startMin ?? 9 * 60), end: toTime(h?.endMin ?? 18 * 60) };
  });
}

export function WorkingHoursEditor({ hours, onSaved }: { hours: WorkingHour[]; onSaved?: (h: WorkingHour[]) => void }) {
  const [rows, setRows] = useState<Row[]>(() => toRows(hours));
  const [buffer, setBuffer] = useState(String(hours[0]?.bufferMinutes ?? 10));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    setRows(toRows(hours));
    setBuffer(String(hours[0]?.bufferMinutes ?? 10));
    setDirty(false);
  }, [hours]);

  function patchRow(weekday: number, p: Partial<Row>) {
    setRows((r) => r.map((x) => (x.weekday === weekday ? { ...x, ...p } : x)));
    setErrors((e) => ({ ...e, [weekday]: "" }));
    setDirty(true);
  }

  async function save() {
    const e: Record<number, string> = {};
    for (const r of rows) {
      if (r.on && toMin(r.end) <= toMin(r.start)) e[r.weekday] = "Конец раньше начала";
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    if (!rows.some((r) => r.on)) {
      toast.error("Отметьте хотя бы один рабочий день");
      return;
    }
    setSaving(true);
    try {
      const payload = rows
        .filter((r) => r.on)
        .map((r) => ({ weekday: r.weekday, startMin: toMin(r.start), endMin: toMin(r.end), bufferMinutes: Math.max(0, Number(buffer) || 0) }));
      const res = await api<{ hours: WorkingHour[] }>("/api/schedule/hours", { method: "PUT", body: JSON.stringify({ hours: payload }) });
      toast.success("График сохранён");
      setDirty(false);
      onSaved?.(res.hours);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <p className="text-small text-muted-foreground">
        Занятия можно ставить только в рабочие часы — календарь подсветит их, а при конфликте предупредит.
      </p>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {rows.map((r) => {
          const day = DAYS.find((d) => d.n === r.weekday)!;
          return (
            <li key={r.weekday} className="grid gap-2 px-3 py-2 sm:grid-cols-[1fr_auto] sm:items-center">
              <label className="flex min-h-11 items-center gap-2 text-sm">
                <Checkbox checked={r.on} onCheckedChange={(v) => patchRow(r.weekday, { on: !!v })} />
                {day.l}
              </label>
              {r.on ? (
                <div className="flex items-center gap-2">
                  <Label htmlFor={`wh-start-${r.weekday}`} className="sr-only">
                    Начало, {day.l}
                  </Label>
                  <Input
                    id={`wh-start-${r.weekday}`}
                    type="time"
                    step={900}
                    className={`w-[7.5rem] ${errors[r.weekday] ? "border-destructive" : ""}`}
                    aria-invalid={errors[r.weekday] ? true : undefined}
                    aria-describedby={errors[r.weekday] ? `wh-error-${r.weekday}` : undefined}
                    value={r.start}
                    onChange={(e) => patchRow(r.weekday, { start: e.target.value })}
                  />
                  <span aria-hidden className="text-muted-foreground">
                    —
                  </span>
                  <Label htmlFor={`wh-end-${r.weekday}`} className="sr-only">
                    Конец, {day.l}
                  </Label>
                  <Input
                    id={`wh-end-${r.weekday}`}
                    type="time"
                    step={900}
                    className={`w-[7.5rem] ${errors[r.weekday] ? "border-destructive" : ""}`}
                    aria-invalid={errors[r.weekday] ? true : undefined}
                    aria-describedby={errors[r.weekday] ? `wh-error-${r.weekday}` : undefined}
                    value={r.end}
                    onChange={(e) => patchRow(r.weekday, { end: e.target.value })}
                  />
                </div>
              ) : (
                <span className="text-small text-muted-foreground sm:text-right">выходной</span>
              )}
              {errors[r.weekday] && (
                <p id={`wh-error-${r.weekday}`} role="alert" className="text-caption text-destructive sm:col-span-2">
                  {errors[r.weekday]}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="wh-buffer">Пауза между занятиями, мин</Label>
          <Input
            id="wh-buffer"
            type="number"
            min={0}
            max={60}
            step={5}
            className="mt-1 w-28"
            value={buffer}
            onChange={(e) => {
              setBuffer(e.target.value);
              setDirty(true);
            }}
          />
        </div>
        <Button onClick={save} disabled={!dirty || saving}>
          {saving ? "Сохраняем…" : "Сохранить график"}
        </Button>
      </div>
    </div>
  );
}
