"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { browserTimezone, findTimezone, sameTimezone, timezoneLabel } from "@/lib/timezones";

const DAYS = 30;

export function TimezoneBanner({ profileTz }: { profileTz: string }) {
  const router = useRouter();
  const [browserTz, setBrowserTz] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const tz = browserTimezone();
    setBrowserTz(tz);
    if (sameTimezone(tz, profileTz)) return;
    const key = `tz-banner:${profileTz}:${tz}`;
    const until = Number(localStorage.getItem(key) || 0);
    if (until > Date.now()) return;
    setShow(true);
  }, [profileTz]);

  if (!show || !browserTz) return null;

  function dismiss() {
    localStorage.setItem(`tz-banner:${profileTz}:${browserTz}`, String(Date.now() + DAYS * 86400000));
    setShow(false);
  }

  async function update() {
    setSaving(true);
    try {
      const tz = findTimezone(browserTz)?.id || browserTz;
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: tz }),
      });
      setShow(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-small">
        Ваш браузер в поясе {timezoneLabel(browserTz)}, в профиле — {timezoneLabel(profileTz)}. Обновить?
      </p>
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={update} disabled={saving}>
          Обновить
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Не сейчас
        </Button>
      </div>
    </div>
  );
}
