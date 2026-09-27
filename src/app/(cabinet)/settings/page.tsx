"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PasswordInput } from "@/components/password-input";
import { WorkingHoursEditor, WorkingHour } from "@/components/working-hours-editor";
import { api } from "@/lib/api";
import { PLAN_LABELS } from "@/lib/labels";
import { formatBytes } from "@/lib/utils";
import { applyA11yClasses } from "@/lib/a11y";
import { TIMEZONES, findTimezone, formatNowInZone } from "@/lib/timezones";
import { toast } from "sonner";
import { PictureWordsAdmin } from "@/components/picture-words-admin";

function SettingsInner() {
  const router = useRouter();
  const tab = useSearchParams().get("tab") || "profile";
  const [me, setMe] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [hours, setHours] = useState<WorkingHour[]>([]);
  const [saved, setSaved] = useState("");

  async function load() {
    const [m, s, h] = await Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/sessions").then((r) => r.json()),
      fetch("/api/schedule/hours").then((r) => r.json()),
    ]);
    setMe(m);
    setSessions(s.items || []);
    setHours(h.hours || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function save(patch: Record<string, unknown>) {
    if (me?.user && ("a11yLargeText" in patch || "a11yHighContrast" in patch || "a11yReduceMotion" in patch)) {
      applyA11yClasses(document.documentElement, { ...me.user, ...patch });
    }
    await api("/api/settings", { method: "PATCH", body: JSON.stringify(patch) });
    setSaved("Сохранено");
    setTimeout(() => setSaved(""), 2000);
    await load();
    router.refresh();
  }

  if (!me?.user) return <p className="text-muted-foreground">Загрузка…</p>;
  const u = me.user;
  const lim = me.limits;
  const usedPct = lim.unlimited ? 0 : Math.min(100, Math.round((me.storageUsed / lim.storageBytes) * 100));

  return (
    <div>
      <PageHeader title="Настройки" crumbs={[{ href: "/dashboard", label: "Кабинет" }, { label: "Настройки" }]} actions={saved && <span className="text-small text-primary">{saved}</span>} />
      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="profile">Профиль</TabsTrigger>
          <TabsTrigger value="security">Безопасность</TabsTrigger>
          <TabsTrigger value="hours">График</TabsTrigger>
          <TabsTrigger value="a11y">Доступность</TabsTrigger>
          <TabsTrigger value="plan">Тариф</TabsTrigger>
          <TabsTrigger value="data">Данные</TabsTrigger>
          <TabsTrigger value="pictures">Справочник картинок</TabsTrigger>
        </TabsList>
        <TabsContent value="profile" className="grid max-w-xl gap-3">
          <div>
            <Label htmlFor="name">ФИО</Label>
            <Input id="name" defaultValue={u.name} onBlur={(e) => e.target.value !== u.name && save({ name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="position">Должность</Label>
            <Input id="position" defaultValue={u.position} onBlur={(e) => save({ position: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="institution">Учреждение</Label>
            <Input id="institution" defaultValue={u.institution} onBlur={(e) => save({ institution: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="phone">Телефон</Label>
            <Input id="phone" defaultValue={u.phone || ""} onBlur={(e) => save({ phone: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="tz">Часовой пояс</Label>
            <Select
              value={findTimezone(u.timezone)?.id || u.timezone}
              onValueChange={(v) => save({ timezone: v })}
            >
              <SelectTrigger id="tz" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!findTimezone(u.timezone) && u.timezone && (
                  <SelectItem value={u.timezone}>{u.timezone}</SelectItem>
                )}
                {TIMEZONES.map((z) => (
                  <SelectItem key={z.id} value={z.id}>
                    {z.city} · {z.offset} · сейчас {formatNowInZone(z.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between gap-3">
            <span>
              Автоанализ заключения ПМПК
              <span className="mt-1 block text-caption text-muted-foreground">Если выключено, разбор запускается кнопкой «Анализ» в карточке ученика.</span>
            </span>
            <Switch checked={u.aiPmpkAutoAnalyze !== false} onCheckedChange={(v) => save({ aiPmpkAutoAnalyze: v })} />
          </label>
        </TabsContent>
        <TabsContent value="security" className="max-w-xl space-y-4">
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              await api("/api/auth/change-password", {
                method: "POST",
                body: JSON.stringify({ currentPassword: fd.get("current"), password: fd.get("next") }),
              });
              toast.success("Пароль изменён");
            }}
          >
            <Label>Текущий пароль</Label>
            <PasswordInput name="current" autoComplete="current-password" />
            <Label>Новый пароль</Label>
            <PasswordInput name="next" autoComplete="new-password" />
            <Button type="submit">Сменить пароль</Button>
          </form>
          <div>
            <h3 className="text-h3">Сессии</h3>
            <ul className="mt-2 space-y-2 text-small">
              {sessions.map((s) => (
                <li key={s.id} className="flex justify-between rounded-md border border-border p-2">
                  <span>{s.current ? "Этот браузер" : s.userAgent || "Сессия"} · {s.ip}</span>
                </li>
              ))}
            </ul>
            <Button className="mt-2" variant="outline" onClick={() => api("/api/sessions", { method: "DELETE", body: JSON.stringify({ all: true }) }).then(() => { toast.success("Другие сессии завершены"); load(); })}>
              Выйти везде, кроме этой сессии
            </Button>
          </div>
        </TabsContent>
        <TabsContent value="hours" forceMount className="data-[state=inactive]:hidden">
          <WorkingHoursEditor hours={hours} onSaved={setHours} />
        </TabsContent>
        <TabsContent value="a11y" className="max-w-md space-y-4">
          <label className="flex items-center justify-between gap-3">
            Крупный шрифт
            <Switch checked={!!u.a11yLargeText} onCheckedChange={(v) => save({ a11yLargeText: v })} />
          </label>
          <label className="flex items-center justify-between gap-3">
            Высокий контраст
            <Switch checked={!!u.a11yHighContrast} onCheckedChange={(v) => save({ a11yHighContrast: v })} />
          </label>
          <label className="flex items-center justify-between gap-3">
            Меньше анимации
            <Switch checked={!!u.a11yReduceMotion} onCheckedChange={(v) => save({ a11yReduceMotion: v })} />
          </label>
        </TabsContent>
        <TabsContent value="plan" className="max-w-md space-y-3">
          <p>Текущий тариф: {PLAN_LABELS[u.plan] || u.plan}</p>
          {!lim.unlimited && (
            <>
              <p className="text-small text-muted-foreground">Хранилище: {formatBytes(me.storageUsed)} из {formatBytes(lim.storageBytes)}</p>
              <Progress value={usedPct} />
            </>
          )}
          {lim.unlimited && <p className="text-small text-muted-foreground">Лимиты сняты.</p>}
          <Button asChild variant="outline">
            <Link href="/pricing">Сменить тариф</Link>
          </Button>
        </TabsContent>
        <TabsContent value="pictures" className="space-y-3">
          <p className="text-small text-muted-foreground">Словарь составлен автоматически. Скрывайте неудачные слова перед печатью.</p>
          <PictureWordsAdmin />
        </TabsContent>
        <TabsContent value="data" className="space-y-3">
          <Button asChild variant="outline">
            <a href="/api/settings">Скачать архив данных</a>
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <SettingsInner />
    </Suspense>
  );
}
