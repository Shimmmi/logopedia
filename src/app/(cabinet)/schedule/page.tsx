"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { CalendarApi } from "@fullcalendar/core";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  LessonDialog,
  LessonDefaults,
  LessonEvent,
  Pupil,
} from "@/components/lesson-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { EVENT_STATUS, EVENT_TYPE } from "@/lib/labels";
import { formatDate, formatTime } from "@/lib/format";
import { toast } from "sonner";
import { ErrorState } from "@/components/error-state";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

const ScheduleCalendar = dynamic(
  () => import("@/components/schedule-calendar"),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="Загружаем календарь"
        className="h-96 animate-pulse rounded-lg bg-muted"
      />
    ),
  },
);

type View = "timeGridDay" | "timeGridWeek" | "dayGridMonth" | "listWeek";
const VIEWS: { id: View; label: string }[] = [
  { id: "timeGridDay", label: "День" },
  { id: "timeGridWeek", label: "Неделя" },
  { id: "dayGridMonth", label: "Месяц" },
  { id: "listWeek", label: "Список" },
];

type Hour = { weekday: number; startMin: number; endMin: number };

type Occurrence = {
  id: string;
  eventId: string;
  title: string;
  start: string;
  end: string;
  occurrenceStart: string;
  recurring: boolean;
  rrule: string | null;
  seriesStart: string;
  seriesEnd: string;
  type: string;
  notes: string | null;
  color: string;
  status: string;
  pupils: Pupil[];
};

const toTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
const minutesOfDay = (d: Date) => d.getHours() * 60 + d.getMinutes();
const DEFAULT_RANGE = { min: 8 * 60, max: 20 * 60 };

function useIsMobile() {
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return mobile;
}

export default function SchedulePage() {
  const apiRef = useRef<CalendarApi | null>(null);
  const isMobile = useIsMobile();
  const tz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );
  const [pupils, setPupils] = useState<Pupil[]>([]);
  const [hours, setHours] = useState<Hour[]>([]);
  const [loadedRange, setLoadedRange] = useState<{
    min: number;
    max: number;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [defaults, setDefaults] = useState<LessonDefaults>({});
  const [editEvent, setEditEvent] = useState<LessonEvent | null>(null);
  const [viewEvent, setViewEvent] = useState<Occurrence | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Occurrence | null>(null);
  // Стартовый вид выбираем после монтирования, иначе SSR-значение расходится с клиентским при гидрации
  const [view, setView] = useState<View>("timeGridWeek");
  const [title, setTitle] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (window.innerWidth < 768) setView("timeGridDay");
  }, []);

  useEffect(() => {
    cal()?.changeView(view);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    fetch("/api/pupils")
      .then((r) => (r.ok ? r.json() : { pupils: [] }))
      .then((d) => setPupils(d.pupils || []))
      .catch(() => {});
    fetch("/api/schedule/hours")
      .then((r) => (r.ok ? r.json() : { hours: [] }))
      .then((d) => setHours(d.hours || []))
      .catch(() => {});
  }, []);

  // Диапазон сетки: рабочий график ±1 час (или 08–20), расширенный по факту загруженных занятий,
  // чтобы ничего не пропадало за пределами графика.
  const { slotMin, slotMax, businessHours } = useMemo(() => {
    let min = hours.length
      ? Math.min(...hours.map((h) => h.startMin)) - 60
      : DEFAULT_RANGE.min;
    let max = hours.length
      ? Math.max(...hours.map((h) => h.endMin)) + 60
      : DEFAULT_RANGE.max;
    if (loadedRange) {
      min = Math.min(min, loadedRange.min);
      max = Math.max(max, loadedRange.max);
    }
    min = Math.max(0, Math.floor(min / 60) * 60);
    max = Math.min(24 * 60, Math.ceil(max / 60) * 60);
    return {
      slotMin: toTime(min),
      slotMax: max >= 24 * 60 ? "24:00:00" : toTime(max),
      businessHours: hours.length
        ? hours.map((h) => ({
            daysOfWeek: [h.weekday],
            startTime: toTime(h.startMin),
            endTime: toTime(h.endMin),
          }))
        : undefined,
    };
  }, [hours, loadedRange]);

  const cal = () => apiRef.current;
  const viewRef = useRef<View>(view);
  viewRef.current = view;
  const onApi = useCallback((api: CalendarApi) => {
    apiRef.current = api;
    if (api.view.type !== viewRef.current) api.changeView(viewRef.current);
  }, []);

  function changeView(v: View) {
    setView(v);
  }

  function openNew(d?: LessonDefaults) {
    setEditEvent(null);
    setDefaults(d ?? {});
    setOpen(true);
  }

  function openEdit(o: Occurrence) {
    setViewEvent(null);
    setEditEvent({
      id: o.eventId,
      title: o.title,
      // Для серии правим её начало, а не дату конкретного повтора — иначе прошлые занятия исчезнут
      startAt: o.recurring ? o.seriesStart : o.start,
      endAt: o.recurring ? o.seriesEnd : o.end,
      type: o.type,
      rrule: o.rrule,
      notes: o.notes,
      pupilIds: o.pupils.map((p) => p.id),
    });
    setOpen(true);
  }

  /** Перенос: для повтора серии — исключение на одну дату, для разового — само событие. */
  async function move(o: Occurrence, start: Date, end: Date) {
    const body = o.recurring
      ? {
          occurrenceStart: o.occurrenceStart,
          newStart: start.toISOString(),
          newEnd: end.toISOString(),
        }
      : { startAt: start.toISOString(), endAt: end.toISOString() };
    await api(`/api/schedule/${o.eventId}`, {
      method: "PATCH",
      body: JSON.stringify({ ...body, tz }),
    });
  }

  /** Перенос из календаря с честной отменой: «Отменить» возвращает занятие и на сервере. */
  async function moveWithUndo(
    info: {
      event: {
        start: Date | null;
        end: Date | null;
        extendedProps: Record<string, unknown>;
      };
      oldEvent: { start: Date | null; end: Date | null };
      revert: () => void;
    },
    message: string,
  ) {
    const o = info.event.extendedProps as Occurrence;
    const { start, end } = info.event;
    const old = info.oldEvent;
    if (!start || !end) return info.revert();
    try {
      await move(o, start, end);
      toast(message, {
        duration: 10000,
        action: {
          label: "Отменить",
          onClick: async () => {
            if (!old.start || !old.end) return;
            try {
              await move(o, old.start, old.end);
              cal()?.refetchEvents();
            } catch (e) {
              toast.error((e as Error).message);
            }
          },
        },
      });
    } catch (e) {
      toast.error((e as Error).message);
      info.revert();
    }
  }

  async function setStatus(status: string) {
    if (!viewEvent) return;
    try {
      if (viewEvent.recurring) {
        await api(`/api/schedule/${viewEvent.eventId}`, {
          method: "PATCH",
          body: JSON.stringify({
            occurrenceStart: viewEvent.occurrenceStart,
            status,
          }),
        });
      } else {
        await api(`/api/schedule/${viewEvent.eventId}/status`, {
          method: "POST",
          body: JSON.stringify({ status }),
        });
      }
      setViewEvent(null);
      cal()?.refetchEvents();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(o: Occurrence, scope: "one" | "series") {
    try {
      if (o.recurring && scope === "one") {
        await api(`/api/schedule/${o.eventId}`, {
          method: "PATCH",
          body: JSON.stringify({
            occurrenceStart: o.occurrenceStart,
            skip: true,
          }),
        });
        toast.success("Занятие убрано из расписания");
      } else {
        await api(`/api/schedule/${o.eventId}`, { method: "DELETE" });
        toast.success(o.recurring ? "Серия удалена" : "Занятие удалено");
      }
      setDeleteTarget(null);
      cal()?.refetchEvents();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function startOfWorkday(d: Date) {
    const wh = hours.find((h) => h.weekday === d.getDay());
    const min = wh?.startMin ?? 10 * 60;
    const s = new Date(d);
    s.setHours(Math.floor(min / 60), min % 60, 0, 0);
    return s;
  }

  return (
    <div className="pb-24 md:pb-0">
      <PageHeader
        title="Расписание"
        crumbs={[
          { href: "/dashboard", label: "Кабинет" },
          { label: "Расписание" },
        ]}
        actions={
          <>
            <Button className="hidden md:inline-flex" onClick={() => openNew()}>
              <Plus className="mr-2 h-5 w-5" />
              Новое занятие
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Ещё действия">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href="/api/schedule/ics">Экспорт в календарь (.ics)</a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href="/api/schedule/report">Отчёт о занятиях (XLSX)</a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      {/* Собственный тулбар вместо встроенного в FullCalendar — тот не умещается на телефоне.
          На мобильном он липкий, чтобы не скроллить длинный день обратно наверх ради переключения. */}
      <div className="sticky top-0 z-10 -mx-1 mb-3 space-y-2 bg-background/95 px-1 py-2 backdrop-blur md:static md:mx-0 md:px-0 md:py-0">
        <div className="flex items-center gap-2">
          <div className="flex shrink-0 items-center rounded-md border border-border bg-card">
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-l-md hover:bg-accent"
              aria-label="Назад"
              onClick={() => cal()?.prev()}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="flex h-11 w-11 items-center justify-center rounded-r-md border-l border-border hover:bg-accent"
              aria-label="Вперёд"
              onClick={() => cal()?.next()}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 md:hidden"
            aria-label="Сегодня"
            onClick={() => cal()?.today()}
          >
            <CalendarDays className="h-5 w-5" />
          </Button>
          <Button
            variant="outline"
            className="hidden shrink-0 md:inline-flex"
            onClick={() => cal()?.today()}
          >
            Сегодня
          </Button>
          <h2
            className="min-w-0 flex-1 text-balance text-base font-medium leading-tight first-letter:uppercase md:text-h3"
            aria-live="polite"
          >
            {title}
          </h2>
          <div className="hidden md:block">
            <ViewSwitch view={view} onChange={changeView} />
          </div>
        </div>
        <div className="md:hidden">
          <ViewSwitch view={view} onChange={changeView} full />
        </div>
      </div>

      <ul
        className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-caption text-muted-foreground"
        aria-label="Обозначения типов занятий"
      >
        {Object.entries(EVENT_TYPE).map(([k, v]) => (
          <li key={k} className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: `hsl(var(--event-${k.toLowerCase()}))` }}
              aria-hidden
            />
            {v}
          </li>
        ))}
      </ul>

      <div className="fc-shell rounded-xl border border-border bg-card p-1 sm:p-2">
        {loadError ? (
          <ErrorState
            title="Не удалось загрузить расписание"
            description={loadError}
            onRetry={() => {
              setLoadError(null);
              setReloadKey((k) => k + 1);
              cal()?.refetchEvents();
            }}
          />
        ) : (
        <ScheduleCalendar
          key={reloadKey}
          onApi={onApi}
          initialView={view}
          firstDay={1}
          height="auto"
          headerToolbar={false}
          allDaySlot={false}
          nowIndicator
          slotMinTime={slotMin}
          slotMaxTime={slotMax}
          slotDuration="00:30:00"
          slotLabelFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          eventTimeFormat={{
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }}
          dayHeaderFormat={
            isMobile
              ? { weekday: "short", day: "numeric" }
              : { weekday: "short", day: "numeric", month: "short" }
          }
          views={{
            dayGridMonth: { dayHeaderFormat: { weekday: "short" } },
            listWeek: { listDayFormat: { weekday: "long", day: "numeric", month: "long" }, listDaySideFormat: false },
          }}
          businessHours={businessHours}
          longPressDelay={300}
          selectLongPressDelay={300}
          eventLongPressDelay={300}
          selectable={!isMobile}
          editable
          datesSet={(arg) => setTitle(arg.view.title)}
          events={async (info, success, failure) => {
            try {
              setLoadError(null);
              const res = await fetch(
                `/api/schedule?from=${info.start.toISOString()}&to=${info.end.toISOString()}`,
              );
              if (!res.ok)
                throw new Error(
                  (await res.json().catch(() => ({}))).error ||
                    "Не удалось загрузить расписание",
                );
              const d = await res.json();
              const list: Occurrence[] = d.events || [];
              if (list.length) {
                const mins = list.map((e) => minutesOfDay(new Date(e.start)));
                const maxs = list.map(
                  (e) => minutesOfDay(new Date(e.end)) || 24 * 60,
                );
                const lo = Math.min(...mins) - 60;
                const hi = Math.max(...maxs) + 60;
                setLoadedRange((r) =>
                  r && r.min <= lo && r.max >= hi
                    ? r
                    : {
                        min: Math.min(lo, r?.min ?? lo),
                        max: Math.max(hi, r?.max ?? hi),
                      },
                );
              }
              success(
                list.map((e) => ({
                  id: e.id,
                  title: e.title,
                  start: e.start,
                  end: e.end,
                  backgroundColor: e.color,
                  borderColor: e.color,
                  classNames: [
                    `fc-event-${String(e.type || "").toLowerCase()}`,
                    e.status === "CANCELED"
                      ? "fc-event-canceled"
                      : e.status === "COMPLETED"
                        ? "fc-event-completed"
                        : "",
                  ].filter(Boolean),
                  extendedProps: e,
                })),
              );
            } catch (e) {
              setLoadError((e as Error).message);
              failure(e as Error);
            }
          }}
          dateClick={(arg) => {
            // На таче выделение требует long-press, поэтому простой тап открывает диалог
            if (!isMobile) return;
            const start = arg.allDay ? startOfWorkday(arg.date) : arg.date;
            openNew({
              startAt: start.toISOString(),
              endAt: new Date(start.getTime() + 40 * 60000).toISOString(),
            });
          }}
          select={(sel) => {
            // Тап по дню в месяце — с начала рабочего дня; тап по одному слоту — 40 минут; выделение — как выделили
            const start = sel.allDay ? startOfWorkday(sel.start) : sel.start;
            const span = sel.end.getTime() - sel.start.getTime();
            const end =
              sel.allDay || span <= 30 * 60000
                ? new Date(start.getTime() + 40 * 60000)
                : sel.end;
            openNew({ startAt: start.toISOString(), endAt: end.toISOString() });
          }}
          eventClick={(info) =>
            setViewEvent(info.event.extendedProps as Occurrence)
          }
          eventDrop={(info) => moveWithUndo(info, "Время изменено")}
          eventResize={(info) => moveWithUndo(info, "Длительность изменена")}
        />
        )}
      </div>

      {/* Плавающая кнопка на телефоне: основное действие всегда под пальцем */}
      <div
        className="fixed right-4 z-20 md:hidden"
        style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          size="lg"
          className="h-14 rounded-full px-5 shadow-lg"
          onClick={() => openNew()}
        >
          <Plus className="mr-2 h-5 w-5" />
          Новое занятие
        </Button>
      </div>

      <LessonDialog
        open={open}
        onOpenChange={setOpen}
        pupils={pupils}
        defaults={defaults}
        event={editEvent}
        onSaved={() => cal()?.refetchEvents()}
      />

      <Dialog open={!!viewEvent} onOpenChange={() => setViewEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{viewEvent?.title}</DialogTitle>
            <DialogDescription>
              {viewEvent
                ? `${formatDate(viewEvent.start, tz)}, ${formatTime(viewEvent.start, tz)}–${formatTime(viewEvent.end, tz)}`
                : ""}
              {viewEvent?.pupils?.length
                ? ` · ${viewEvent.pupils.map((p) => p.fullName).join(", ")}`
                : ""}
              {viewEvent?.recurring ? " · повторяется еженедельно" : ""}
            </DialogDescription>
          </DialogHeader>
          <p className="text-small text-muted-foreground">Отметить занятие</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {Object.entries(EVENT_STATUS).map(([k, v]) => (
              <Button
                key={k}
                variant={viewEvent?.status === k ? "default" : "outline"}
                aria-pressed={viewEvent?.status === k}
                onClick={() => setStatus(k)}
              >
                {v}
              </Button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              onClick={() => viewEvent && openEdit(viewEvent)}
            >
              <Pencil className="mr-2 h-5 w-5" />
              Изменить
            </Button>
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                setDeleteTarget(viewEvent);
                setViewEvent(null);
              }}
            >
              <Trash2 className="mr-2 h-5 w-5" />
              Удалить
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget?.recurring
                ? "Удалить занятие из серии?"
                : "Удалить занятие?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.recurring
                ? `«${deleteTarget.title}» повторяется еженедельно. Можно убрать только ${deleteTarget ? formatDate(deleteTarget.start, tz) : "эту дату"} или всю серию целиком.`
                : `«${deleteTarget?.title}» исчезнет из календаря. Отметки посещаемости не восстановятся.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Оставить</AlertDialogCancel>
            {deleteTarget?.recurring && (
              <AlertDialogAction
                className="border border-input bg-card text-foreground hover:bg-accent"
                onClick={() => deleteTarget && remove(deleteTarget, "one")}
              >
                Только это занятие
              </AlertDialogAction>
            )}
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && remove(deleteTarget, "series")}
            >
              {deleteTarget?.recurring ? "Всю серию" : "Удалить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ViewSwitch({
  view,
  onChange,
  full,
}: {
  view: View;
  onChange: (v: View) => void;
  full?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Вид календаря"
      className={`grid rounded-md border border-border bg-card p-0.5 ${full ? "grid-cols-4" : "inline-grid grid-flow-col"}`}
    >
      {VIEWS.map((v) => {
        const on = v.id === view;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={on}
            className={`min-h-11 rounded px-3 text-sm transition-colors ${on ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
            onClick={() => onChange(v.id)}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
