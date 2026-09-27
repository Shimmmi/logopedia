"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { EVENT_TYPE } from "@/lib/labels";
import { api } from "@/lib/api";
import { toast } from "sonner";

export type Pupil = { id: string; fullName: string };

export const WEEKDAYS = [
  { n: 1, l: "Пн", full: "Понедельник" },
  { n: 2, l: "Вт", full: "Вторник" },
  { n: 3, l: "Ср", full: "Среда" },
  { n: 4, l: "Чт", full: "Четверг" },
  { n: 5, l: "Пт", full: "Пятница" },
  { n: 6, l: "Сб", full: "Суббота" },
  { n: 0, l: "Вс", full: "Воскресенье" },
];

const RRULE_DAY: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

export type LessonDefaults = {
  title?: string;
  startAt?: string;
  endAt?: string;
  type?: string;
  pupilIds?: string[];
  recurring?: boolean;
  byweekday?: number[];
  until?: string;
  notes?: string;
};

/** Существующее событие для режима правки. */
export type LessonEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  type: string;
  rrule: string | null;
  notes?: string | null;
  pupilIds?: string[];
};

export function parseRrule(rrule: string | null) {
  if (!rrule) return { byweekday: [] as number[], until: "" };
  const days = rrule.match(/BYDAY=([A-Z,]+)/)?.[1]?.split(",").map((d) => RRULE_DAY[d]).filter((n) => n !== undefined) ?? [];
  const untilRaw = rrule.match(/UNTIL=(\d{8})/)?.[1];
  const until = untilRaw ? `${untilRaw.slice(0, 4)}-${untilRaw.slice(4, 6)}-${untilRaw.slice(6, 8)}` : "";
  return { byweekday: days, until };
}

function nextWorkdayAt(hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultTitle(type: string) {
  return type === "GROUP" ? "Групповое занятие" : type === "INDIVIDUAL" ? "Индивидуальное занятие" : EVENT_TYPE[type] || "Занятие";
}

function build(defaults: LessonDefaults, event?: LessonEvent) {
  if (event) {
    const r = parseRrule(event.rrule);
    return {
      title: event.title,
      startAt: toLocalInput(new Date(event.startAt)),
      endAt: toLocalInput(new Date(event.endAt)),
      type: event.type,
      pupilIds: event.pupilIds ?? [],
      recurring: !!event.rrule,
      byweekday: r.byweekday.length ? r.byweekday : [new Date(event.startAt).getDay()],
      until: r.until,
      notes: event.notes ?? "",
      titleTouched: true,
      endTouched: true,
    };
  }
  const start = defaults.startAt ? new Date(defaults.startAt) : nextWorkdayAt(10);
  const end = defaults.endAt ? new Date(defaults.endAt) : new Date(start.getTime() + 40 * 60000);
  const type = defaults.type ?? "INDIVIDUAL";
  return {
    title: defaults.title ?? defaultTitle(type),
    startAt: toLocalInput(start),
    endAt: toLocalInput(end),
    type,
    pupilIds: defaults.pupilIds ?? [],
    recurring: defaults.recurring ?? false,
    byweekday: defaults.byweekday ?? [start.getDay()],
    until: defaults.until ?? "",
    notes: defaults.notes ?? "",
    titleTouched: !!defaults.title,
    endTouched: !!defaults.endAt,
  };
}

export function LessonDialog({
  open,
  onOpenChange,
  pupils,
  defaults,
  event,
  lockPupil,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  pupils: Pupil[];
  defaults?: LessonDefaults;
  /** Если передано — диалог правит существующее занятие/серию. */
  event?: LessonEvent | null;
  lockPupil?: Pupil;
  onSaved?: () => void;
}) {
  const [form, setForm] = useState(() => build(defaults ?? {}, event ?? undefined));
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setForm(build(defaults ?? {}, event ?? undefined));
      setFilter("");
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const visiblePupils = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? pupils.filter((p) => p.fullName.toLowerCase().includes(q)) : pupils;
  }, [pupils, filter]);

  function setStart(v: string) {
    const prev = new Date(form.startAt);
    const next = new Date(v);
    let endAt = form.endAt;
    if (!form.endTouched && !isNaN(prev.getTime()) && !isNaN(next.getTime())) {
      const duration = new Date(form.endAt).getTime() - prev.getTime();
      endAt = toLocalInput(new Date(next.getTime() + (duration > 0 ? duration : 40 * 60000)));
    }
    const byweekday = form.recurring && form.byweekday.length <= 1 && !isNaN(next.getTime()) ? [next.getDay()] : form.byweekday;
    setForm({ ...form, startAt: v, endAt, byweekday });
  }

  function setType(v: string) {
    setForm({ ...form, type: v, title: form.titleTouched ? form.title : defaultTitle(v) });
  }

  async function save() {
    const e: Record<string, string> = {};
    if (!form.title.trim()) e["lesson-title"] = "Введите название занятия";
    if (isNaN(new Date(form.startAt).getTime())) e["lesson-start"] = "Укажите дату и время начала";
    if (isNaN(new Date(form.endAt).getTime())) e["lesson-end"] = "Укажите время окончания";
    else if (!e["lesson-start"] && new Date(form.endAt) <= new Date(form.startAt)) e["lesson-end"] = "Окончание должно быть позже начала";
    if (form.recurring && !form.byweekday.length) e["lesson-days"] = "Выберите хотя бы один день недели";
    setErrors(e);
    const first = Object.keys(e)[0];
    if (first) {
      document.getElementById(first)?.focus();
      return;
    }
    setSaving(true);
    const body = {
      title: form.title.trim(),
      startAt: new Date(form.startAt).toISOString(),
      endAt: new Date(form.endAt).toISOString(),
      type: form.type,
      // При правке из карточки ученика состав группы не трогаем — иначе остальные дети отвяжутся
      pupilIds: event && lockPupil ? undefined : form.pupilIds,
      notes: form.notes,
      recurring: form.recurring,
      byweekday: form.recurring ? form.byweekday : undefined,
      until: form.recurring && form.until ? form.until : undefined,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
    try {
      if (event) {
        await api(`/api/schedule/${event.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast.success(form.recurring ? "Расписание обновлено" : "Занятие обновлено");
      } else {
        await api("/api/schedule", { method: "POST", body: JSON.stringify(body) });
        toast.success(form.recurring ? "Расписание добавлено" : "Занятие добавлено");
      }
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      setErrors({ server: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  const description = lockPupil
    ? `Ученик: ${lockPupil.fullName}`
    : form.recurring
      ? "Серия занятий по выбранным дням недели"
      : "Разовое занятие в календаре";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-auto">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!saving) save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{event ? "Правка занятия" : "Новое занятие"}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="lesson-title">Название</Label>
            <Input
              id="lesson-title"
              className={`mt-1 ${errors["lesson-title"] ? "border-destructive" : ""}`}
              aria-invalid={errors["lesson-title"] ? true : undefined}
              aria-describedby={errors["lesson-title"] ? "lesson-title-error" : undefined}
              value={form.title}
              onChange={(e) => {
                setErrors({ ...errors, "lesson-title": "" });
                setForm({ ...form, title: e.target.value, titleTouched: true });
              }}
            />
            <FieldError id="lesson-title-error" text={errors["lesson-title"]} />
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="lesson-start">Начало</Label>
              <Input
                id="lesson-start"
                type="datetime-local"
                className={`mt-1 ${errors["lesson-start"] ? "border-destructive" : ""}`}
                aria-invalid={errors["lesson-start"] ? true : undefined}
                aria-describedby={errors["lesson-start"] ? "lesson-start-error" : undefined}
                value={form.startAt}
                onChange={(e) => {
                  setErrors({ ...errors, "lesson-start": "", "lesson-end": "" });
                  setStart(e.target.value);
                }}
              />
              <FieldError id="lesson-start-error" text={errors["lesson-start"]} />
            </div>
            <div>
              <Label htmlFor="lesson-end">Конец</Label>
              <Input
                id="lesson-end"
                type="datetime-local"
                className={`mt-1 ${errors["lesson-end"] ? "border-destructive" : ""}`}
                aria-invalid={errors["lesson-end"] ? true : undefined}
                aria-describedby={errors["lesson-end"] ? "lesson-end-error" : undefined}
                value={form.endAt}
                onChange={(e) => {
                  setErrors({ ...errors, "lesson-end": "" });
                  setForm({ ...form, endAt: e.target.value, endTouched: true });
                }}
              />
              <FieldError id="lesson-end-error" text={errors["lesson-end"]} />
            </div>
          </div>
          <div>
            <Label htmlFor="lesson-type">Тип</Label>
            <Select value={form.type} onValueChange={setType}>
              <SelectTrigger id="lesson-type" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TYPE).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!lockPupil && (
            <div>
              <Label id="lesson-pupils-label">Ученики</Label>
              {pupils.length > 8 && (
                <Input className="mt-1" placeholder="Найти ученика" aria-label="Найти ученика" value={filter} onChange={(e) => setFilter(e.target.value)} />
              )}
              <div className="mt-1 max-h-40 overflow-auto rounded-md border border-border p-2" role="group" aria-labelledby="lesson-pupils-label">
                {pupils.length === 0 && <p className="text-small text-muted-foreground">В картотеке пока нет учеников.</p>}
                {pupils.length > 0 && visiblePupils.length === 0 && <p className="text-small text-muted-foreground">Ничего не найдено.</p>}
                {visiblePupils.map((p) => (
                  <label key={p.id} className="flex min-h-11 items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.pupilIds.includes(p.id)}
                      onCheckedChange={(v) =>
                        setForm({
                          ...form,
                          pupilIds: v ? [...form.pupilIds, p.id] : form.pupilIds.filter((id) => id !== p.id),
                        })
                      }
                    />
                    {p.fullName}
                  </label>
                ))}
              </div>
            </div>
          )}
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <Checkbox checked={form.recurring} onCheckedChange={(v) => setForm({ ...form, recurring: !!v })} />
            Повторять каждую неделю
          </label>
          {form.recurring && (
            <div className="space-y-2 rounded-lg bg-muted p-3">
              <div id="lesson-days" tabIndex={-1} className="flex flex-wrap gap-1 rounded-md outline-none" role="group" aria-label="Дни недели" aria-describedby={errors["lesson-days"] ? "lesson-days-error" : undefined}>
                {WEEKDAYS.map((d) => {
                  const on = form.byweekday.includes(d.n);
                  return (
                    <button
                      key={d.n}
                      type="button"
                      aria-pressed={on}
                      aria-label={d.full}
                      className={`min-h-11 min-w-11 rounded-md px-3 text-sm ${on ? "bg-primary text-primary-foreground" : "bg-card"}`}
                      onClick={() => {
                        setErrors({ ...errors, "lesson-days": "" });
                        setForm({
                          ...form,
                          byweekday: on ? form.byweekday.filter((x) => x !== d.n) : [...form.byweekday, d.n],
                        });
                      }}
                    >
                      {d.l}
                    </button>
                  );
                })}
              </div>
              <FieldError id="lesson-days-error" text={errors["lesson-days"]} />
              <div>
                <Label htmlFor="lesson-until">Повторять до</Label>
                <Input id="lesson-until" type="date" className="mt-1" value={form.until} onChange={(e) => setForm({ ...form, until: e.target.value })} />
                <p className="mt-1 text-caption text-muted-foreground">Необязательно. Время берётся из поля «Начало», праздничные дни пропускаются.</p>
              </div>
            </div>
          )}
          <div>
            <Label htmlFor="lesson-notes">Заметка</Label>
            <Textarea id="lesson-notes" className="mt-1" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          {errors.server && (
            <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-small text-destructive">
              {errors.server}
            </p>
          )}
          <Button type="submit" disabled={saving} className="w-full">
            {saving ? "Сохраняем…" : "Сохранить"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FieldError({ id, text }: { id: string; text?: string }) {
  if (!text) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-caption text-destructive">
      {text}
    </p>
  );
}
