"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { EVENT_STATUS, labelOf } from "@/lib/labels";
import { formatDate } from "@/lib/format";

type Row = { date: string; pupil: string; title: string; status: string; minutes: number };

export default function ReportsPage() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const res = await fetch(`/api/schedule?from=${from}T00:00:00&to=${to}T23:59:59`);
    const d = await res.json();
    const list: Row[] = (d.events || []).flatMap((e: any) =>
      (e.pupils?.length ? e.pupils : [{ fullName: "—" }]).map((p: { fullName: string }) => ({
        date: e.start,
        pupil: p.fullName,
        title: e.title,
        status: e.status,
        minutes: Math.round((new Date(e.end).getTime() - new Date(e.start).getTime()) / 60000),
      }))
    );
    setRows(list);
  }
  useEffect(() => {
    load();
  }, [from, to]);

  return (
    <div>
      <PageHeader
        title="Отчёты"
        crumbs={[{ href: "/dashboard", label: "Кабинет" }, { label: "Отчёты" }]}
        actions={
          <Button asChild variant="outline">
            <a href={`/api/schedule/report?from=${from}&to=${to}`}>Скачать XLSX</a>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-3">
        <div>
          <Label htmlFor="from">С</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="to">По</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-small">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Дата</th>
              <th className="p-3">Ученик</th>
              <th className="p-3">Занятие</th>
              <th className="p-3">Статус</th>
              <th className="p-3">Минут</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                <td className="p-3">{formatDate(r.date)}</td>
                <td className="p-3">{r.pupil}</td>
                <td className="p-3">{r.title}</td>
                <td className="p-3">{labelOf(EVENT_STATUS, r.status)}</td>
                <td className="p-3">{r.minutes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
