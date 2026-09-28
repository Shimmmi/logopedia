"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { PLAN_LABELS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

type Row = { id: string; email: string; name: string; role: string; verified: boolean; plan: string; createdAt: string };
type Kind = "TEXT" | "IMAGE";
type CatalogItem = { id: string; kind: Kind; priceLabel?: string };
type Allow = { plan: string; modelId: string; kind: Kind; isDefault: boolean; fallbackRub: number };
const PLANS = ["FREE", "PRO", "PREMIUM"] as const;
type SortKey = "model" | "price" | (typeof PLANS)[number];

function priceValue(label?: string) {
  if (!label) return Number.POSITIVE_INFINITY;
  const n = Number(label.replace(/\s/g, "").replace(",", ".").match(/[\d.]+/)?.[0]);
  return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
}

export default function AdminPage() {
  const [users, setUsers] = useState<Row[]>([]);
  const [allows, setAllows] = useState<Allow[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [hidden, setHidden] = useState<CatalogItem[]>([]);
  async function load(refresh = false) {
    const d = await api<{ users: Row[] }>("/api/admin");
    setUsers(d.users);
    const m = await api<{ allows: Allow[]; catalog: CatalogItem[]; hidden: CatalogItem[] }>(
      `/api/admin?part=models${refresh ? "&refresh=1" : ""}`,
    );
    setAllows(m.allows);
    setCatalog(m.catalog);
    setHidden(m.hidden || []);
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
      <AdminModels allows={allows} catalog={catalog} hidden={hidden} onChange={load} />
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

function SortHeader({ label, active, dir, onClick }: { label: string; active: boolean; dir: "asc" | "desc"; onClick: () => void }) {
  return (
    <th className="p-2" aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className="inline-flex items-center gap-1 font-medium hover:text-primary" onClick={onClick}>
        {label}
        <span aria-hidden className="text-caption">{active ? (dir === "asc" ? "↑" : "↓") : "↕"}</span>
      </button>
    </th>
  );
}

function AdminModels({
  allows,
  catalog,
  hidden,
  onChange,
}: {
  allows: Allow[];
  catalog: CatalogItem[];
  hidden: CatalogItem[];
  onChange: (refresh?: boolean) => Promise<void> | void;
}) {
  const [kind, setKind] = useState<Kind>("IMAGE");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("model");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const needle = query.trim().toLowerCase();
  function enabled(plan: string, model: CatalogItem) {
    return allows.some((a) => a.plan === plan && a.modelId === model.id && a.kind === model.kind) ? 1 : 0;
  }
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "model" ? "asc" : key === "price" ? "asc" : "desc");
    }
  }
  const shown = catalog
    .filter((m) => m.kind === kind && (!needle || m.id.toLowerCase().includes(needle)))
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === "model") cmp = a.id.localeCompare(b.id, "ru");
      else if (sortKey === "price") cmp = priceValue(a.priceLabel) - priceValue(b.priceLabel);
      else cmp = enabled(sortKey, a) - enabled(sortKey, b);
      if (cmp === 0) cmp = a.id.localeCompare(b.id, "ru");
      return sortDir === "asc" ? cmp : -cmp;
    });
  const counts = {
    IMAGE: catalog.filter((m) => m.kind === "IMAGE").length,
    TEXT: catalog.filter((m) => m.kind === "TEXT").length,
  };
  async function toggle(plan: string, model: CatalogItem, enabled: boolean, isDefault = false) {
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
    await onChange();
  }
  async function hide(model: CatalogItem) {
    await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "hide", modelId: model.id, kind: model.kind }) });
    toast.success("Модель убрана из каталога");
    await onChange();
  }
  async function restore(model: CatalogItem) {
    await api("/api/admin", { method: "POST", body: JSON.stringify({ action: "restore", modelId: model.id, kind: model.kind }) });
    await onChange();
  }
  return (
    <div className="mb-6 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-h3">Модели по тарифам</h2>
        <Button
          type="button"
          variant="outline"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            Promise.resolve(onChange(true))
              .then(() => toast.success("Каталог обновлён"))
              .catch((e) => toast.error((e as Error).message))
              .finally(() => setRefreshing(false));
          }}
        >
          {refreshing ? "Обновляем…" : "Обновить каталог"}
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">Картинку дороже 8 ₽ и текст дороже 12 ₽ за задание включить нельзя. Убранная строка не вернётся при обновлении.</p>
      <div className="flex flex-wrap items-end gap-2">
        <Button type="button" variant={kind === "IMAGE" ? "default" : "outline"} onClick={() => setKind("IMAGE")}>
          Картинки · {counts.IMAGE}
        </Button>
        <Button type="button" variant={kind === "TEXT" ? "default" : "outline"} onClick={() => setKind("TEXT")}>
          Текст · {counts.TEXT}
        </Button>
        <Input className="max-w-sm" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по id" aria-label="Поиск модели" />
      </div>
      <div className="max-h-[32rem] overflow-auto rounded-xl border border-border">
        <table className="w-full text-small">
          <thead className="sticky top-0 bg-muted text-left">
            <tr>
              <SortHeader label="Модель" active={sortKey === "model"} dir={sortDir} onClick={() => toggleSort("model")} />
              <SortHeader label="Цена" active={sortKey === "price"} dir={sortDir} onClick={() => toggleSort("price")} />
              {PLANS.map((p) => (
                <SortHeader key={p} label={PLAN_LABELS[p] || p} active={sortKey === p} dir={sortDir} onClick={() => toggleSort(p)} />
              ))}
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {shown.map((m) => (
              <tr key={`${m.kind}:${m.id}`} className="border-t border-border">
                <td className="p-2">{m.id}</td>
                <td className="p-2 text-caption text-muted-foreground">{m.priceLabel || "—"}</td>
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
                <td className="p-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => hide(m).catch((err) => toast.error((err as Error).message))}>
                    Убрать
                  </Button>
                </td>
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={6}>Ничего не найдено.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {!!hidden.length && (
        <div className="space-y-2">
          <h3 className="text-small font-medium">Скрытые · {hidden.length}</h3>
          <ul className="space-y-1">
            {hidden.map((m) => (
              <li key={`${m.kind}:${m.id}`} className="flex items-center justify-between gap-2 text-small">
                <span>{m.kind === "IMAGE" ? "картинка" : "текст"} · {m.id}</span>
                <Button type="button" variant="outline" size="sm" onClick={() => restore(m).catch((err) => toast.error((err as Error).message))}>
                  Вернуть
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
