"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { PLAN_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

type Row = { id: string; email: string; name: string; role: string; verified: boolean; plan: string; createdAt: string };
type Allow = { plan: string; modelId: string; kind: "TEXT" | "IMAGE"; isDefault: boolean; fallbackRub: number };
const PLANS = ["FREE", "PRO", "PREMIUM"] as const;

export default function AdminPage() {
  const [users, setUsers] = useState<Row[]>([]);
  const [allows, setAllows] = useState<Allow[]>([]);
  const [catalog, setCatalog] = useState<{ id: string; kind: "TEXT" | "IMAGE" }[]>([]);
  async function load() {
    const d = await api<{ users: Row[] }>("/api/admin");
    setUsers(d.users);
    const m = await api<{ allows: Allow[]; catalog: { id: string; kind: "TEXT" | "IMAGE" }[] }>("/api/admin?part=models");
    setAllows(m.allows);
    setCatalog(m.catalog);
  }
  useEffect(() => {
    load().catch((e) => toast.error((e as Error).message));
  }, []);

  async function setPlan(userId: string, plan: string) {
    await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "plan", userId, plan }) });
    toast.success("Тариф обновлён");
    load();
  }

  return (
    <div>
      <PageHeader title="Админка" crumbs={[{ href: "/dashboard", label: "Кабинет" }, { label: "Админка" }]} />
      <AdminModels allows={allows} catalog={catalog} onChange={load} />
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-small">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-3">Пользователь</th>
              <th className="p-3">Почта</th>
              <th className="p-3">Тариф</th>
              <th className="p-3">Статус</th>
              <th className="p-3">Создан</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="p-3">{u.name}</td>
                <td className="p-3">{u.email}</td>
                <td className="p-3">
                  <Select value={u.plan} onValueChange={(v) => setPlan(u.id, v)}>
                    <SelectTrigger className="h-10 w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLAN_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-3">{u.verified ? "подтверждён" : "ждёт письмо"}</td>
                <td className="p-3">{formatDate(u.createdAt)}</td>
                <td className="p-3">
                  {!u.verified && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => api("/api/admin", { method: "POST", body: JSON.stringify({ action: "resend", userId: u.id }) }).then(() => toast.success("Письмо отправлено"))}
                    >
                      Письмо ещё раз
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminModels({
  allows,
  catalog,
  onChange,
}: {
  allows: Allow[];
  catalog: { id: string; kind: "TEXT" | "IMAGE" }[];
  onChange: () => void;
}) {
  const models = catalog.length
    ? catalog
    : allows.map((a) => ({ id: a.modelId, kind: a.kind }));
  const uniq = Array.from(new Map(models.map((m) => [`${m.kind}:${m.id}`, m])).values())
    .sort((a, b) => Number(!/sunburst|gpt-4o-mini|gpt-4o/.test(a.id)) - Number(!/sunburst|gpt-4o-mini|gpt-4o/.test(b.id)))
    .slice(0, 48);
  async function toggle(plan: string, model: { id: string; kind: "TEXT" | "IMAGE" }, enabled: boolean, isDefault = false) {
    const current = allows.find((a) => a.plan === plan && a.modelId === model.id && a.kind === model.kind);
    await api("/api/admin", {
      method: "POST",
      body: JSON.stringify({
        action: "model",
        plan,
        modelId: model.id,
        kind: model.kind,
        enabled,
        isDefault: enabled ? isDefault || !!current?.isDefault : false,
        fallbackRub: model.kind === "IMAGE" ? 8 : 12,
      }),
    });
    onChange();
  }
  return (
    <div className="mb-6 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3">Модели по тарифам</h2>
        <Button type="button" variant="outline" onClick={() => onChange()}>Обновить каталог</Button>
      </div>
      <p className="text-caption text-muted-foreground">Картинку дороже 8 ₽ и текст дороже 12 ₽ за задание включить нельзя.</p>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-small">
          <thead className="bg-muted text-left">
            <tr>
              <th className="p-2">Модель</th>
              {PLANS.map((p) => (
                <th key={p} className="p-2">{PLAN_LABELS[p] || p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {uniq.map((m) => (
              <tr key={`${m.kind}:${m.id}`} className="border-t border-border">
                <td className="p-2">{m.kind === "IMAGE" ? "картинка" : "текст"} · {m.id}</td>
                {PLANS.map((p) => {
                  const row = allows.find((a) => a.plan === p && a.modelId === m.id && a.kind === m.kind);
                  return (
                    <td key={p} className="p-2">
                      <label className="mr-2 inline-flex items-center gap-1">
                        <input type="checkbox" checked={!!row} onChange={(e) => toggle(p, m, e.target.checked).catch((err) => toast.error((err as Error).message))} />
                        вкл
                      </label>
                      {row && (
                        <label className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={row.isDefault}
                            onChange={(e) => toggle(p, m, true, e.target.checked).catch((err) => toast.error((err as Error).message))}
                          />
                          по умолчанию
                        </label>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
