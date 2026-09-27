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

export default function AdminPage() {
  const [users, setUsers] = useState<Row[]>([]);
  async function load() {
    const d = await api<{ users: Row[] }>("/api/admin");
    setUsers(d.users);
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
