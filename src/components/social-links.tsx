"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SocialLink, SocialType, normalizeSocial, socialHref, socialLabel } from "@/lib/social";
import { Copy, X } from "lucide-react";
import { toast } from "sonner";

export function SocialLinksEditor({
  links,
  onChange,
}: {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
}) {
  const [type, setType] = useState<SocialType>("telegram");
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function add() {
    const r = normalizeSocial(type, value);
    if ("error" in r) {
      setError(r.error);
      return;
    }
    onChange([...links.filter((l) => !(l.type === r.type && l.value === r.value)), r]);
    setValue("");
    setError("");
  }

  return (
    <div className="space-y-2 md:col-span-2">
      <Label>Способы связи</Label>
      <ul className="space-y-1">
        {links.map((l, i) => (
          <li key={`${l.type}-${l.value}`} className="flex items-center gap-2 text-small">
            <span className="font-medium">{socialLabel(l.type)}</span>
            <span className="truncate text-muted-foreground">{l.value}</span>
            <button
              type="button"
              className="ml-auto flex h-9 w-9 items-center justify-center"
              aria-label={`Убрать ${socialLabel(l.type)}`}
              onClick={() => onChange(links.filter((_, j) => j !== i))}
            >
              <X className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
        <Select value={type} onValueChange={(v) => setType(v as SocialType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="telegram">Telegram</SelectItem>
            <SelectItem value="max">MAX</SelectItem>
            <SelectItem value="vk">ВКонтакте</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={type === "max" ? "https://max.ru/u/…" : type === "telegram" ? "@username" : "vk.com/id…"}
        />
        <Button type="button" variant="outline" onClick={add}>
          Добавить
        </Button>
      </div>
      {type === "max" && (
        <p className="text-caption text-muted-foreground">Скопируйте ссылку из профиля MAX: аватар → QR → Поделиться.</p>
      )}
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  );
}

export function SocialLinksView({ links }: { links?: SocialLink[] | null }) {
  if (!links?.length) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-2">
      {links.map((l) => (
        <li key={`${l.type}-${l.value}`} className="inline-flex items-center gap-1">
          <a href={socialHref(l)} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 text-small">
            {socialLabel(l.type)}
          </a>
          <button
            type="button"
            className="text-caption text-muted-foreground"
            aria-label="Копировать"
            onClick={() => {
              navigator.clipboard.writeText(socialHref(l));
              toast.success("Ссылка скопирована");
            }}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </li>
      ))}
    </ul>
  );
}
