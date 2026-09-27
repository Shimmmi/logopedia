"use client";

import { useEffect, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import type { CalendarApi, CalendarOptions } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import ruLocale from "@fullcalendar/core/locales/ru";

/**
 * Обёртка над FullCalendar, которую можно грузить через next/dynamic:
 * dynamic не пробрасывает ref, поэтому API календаря отдаём колбэком.
 */
export default function ScheduleCalendar({ onApi, ...options }: CalendarOptions & { onApi: (api: CalendarApi) => void }) {
  const ref = useRef<FullCalendar>(null);
  useEffect(() => {
    if (ref.current) onApi(ref.current.getApi());
  }, [onApi]);
  return <FullCalendar ref={ref} plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]} locale={ruLocale} {...options} />;
}
