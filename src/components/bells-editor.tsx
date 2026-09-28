"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/form";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Row = { n: number; startMin: number; endMin: number };
type Bell = { id: string; name: string; shift: number; isDefault: boolean; lessons: Row[] };

function hhmm(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
function toMin(v: string, fallback: number) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function BellsEditor() {
  const [bells, setBells] = useState<Bell[]>([]);
  const [subjects, setSubjects] = useState("");
  const [active, setActive] = useState<string>("");

  async function load() {
    const d = await api<{ bells: Bell[]; protectedSubjects: string }>("/api/bells");
    setBells(d.bells);
    setSubjects(d.protectedSubjects);
    setActive((id) => id || d.bells.find((b) => b.isDefault)?.id || d.bells[0]?.id || "");
  }
  useEffect(() => {
    load().catch((e) => toast.error((e as Error).message));
  }, []);

  const bell = bells.find((b) => b.id === active);

  return (
    <div className="space-y-3">
      <h3 className="text-h3">Звонки</h3>
      <p className="text-caption text-muted-foreground">Шаблон «Основная» подставляется ученикам, пока не выбран другой. Смена 1 или 2.</p>
      <div className="flex flex-wrap gap-2">
        {bells.map((b) => (
          <Button key={b.id} type="button" variant={b.id === active ? "default" : "outline"} onClick={() => setActive(b.id)}>
            {b.name} · {b.shift}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await api("/api/bells", {
              method: "POST",
              body: JSON.stringify({
                name: "Смена 2",
                shift: 2,
                isDefault: false,
                lessons: [0, 1, 2, 3, 4, 5, 6, 7].map((i) => ({ n: i + 1, startMin: 13 * 60 + 30 + i * 50, endMin: 13 * 60 + 30 + i * 50 + 40 })),
              }),
            });
            load();
          }}
        >
          Новый шаблон
        </Button>
      </div>
      {bell && (
        <div className="space-y-2">
          {bell.lessons.map((row, idx) => (
            <div key={row.n} className="grid grid-cols-3 gap-2">
              <span className="self-center text-small">{row.n} урок</span>
              <Input
                defaultValue={hhmm(row.startMin)}
                aria-label={`Начало ${row.n}`}
                onBlur={(e) => {
                  const lessons = bell.lessons.map((r, i) => (i === idx ? { ...r, startMin: toMin(e.target.value, r.startMin) } : r));
                  api("/api/bells", { method: "PATCH", body: JSON.stringify({ id: bell.id, lessons }) }).then(load);
                }}
              />
              <Input
                defaultValue={hhmm(row.endMin)}
                aria-label={`Конец ${row.n}`}
                onBlur={(e) => {
                  const lessons = bell.lessons.map((r, i) => (i === idx ? { ...r, endMin: toMin(e.target.value, r.endMin) } : r));
                  api("/api/bells", { method: "PATCH", body: JSON.stringify({ id: bell.id, lessons }) }).then(load);
                }}
              />
            </div>
          ))}
          {!bell.isDefault && (
            <Button type="button" variant="outline" onClick={() => api("/api/bells", { method: "PATCH", body: JSON.stringify({ id: bell.id, isDefault: true }) }).then(load)}>
              Сделать основным
            </Button>
          )}
        </div>
      )}
      <div>
        <Label htmlFor="protected">Предметы, с которых не снимаем</Label>
        <Input
          id="protected"
          className="mt-1"
          value={subjects}
          onChange={(e) => setSubjects(e.target.value)}
          onBlur={() => api("/api/bells", { method: "PATCH", body: JSON.stringify({ protectedSubjects: subjects }) })}
        />
      </div>
    </div>
  );
}

export function ModelPick() {
  const [text, setText] = useState<{ modelId: string; isDefault: boolean }[]>([]);
  const [image, setImage] = useState<{ modelId: string; isDefault: boolean }[]>([]);
  const [textModel, setTextModel] = useState<string>("");
  const [imageModel, setImageModel] = useState<string>("");

  useEffect(() => {
    api<{ text: { modelId: string; isDefault: boolean }[]; image: { modelId: string; isDefault: boolean }[]; textModel: string | null; imageModel: string | null }>("/api/models")
      .then((d) => {
        setText(d.text);
        setImage(d.image);
        setTextModel(d.textModel || "");
        setImageModel(d.imageModel || "");
      })
      .catch((e) => toast.error((e as Error).message));
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="text-h3">Модели</h3>
      <p className="text-caption text-muted-foreground">Пустой выбор — модель по умолчанию для тарифа.</p>
      <div>
        <Label htmlFor="text-model">Текст</Label>
        <select
          id="text-model"
          className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3"
          value={textModel}
          onChange={(e) => {
            setTextModel(e.target.value);
            api("/api/models", { method: "PATCH", body: JSON.stringify({ textModel: e.target.value || null }) }).catch((err) => toast.error((err as Error).message));
          }}
        >
          <option value="">По умолчанию{text.find((m) => m.isDefault) ? ` (${text.find((m) => m.isDefault)?.modelId})` : ""}</option>
          {text.map((m) => (
            <option key={m.modelId} value={m.modelId}>{m.modelId}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="image-model">Картинки</Label>
        <select
          id="image-model"
          className="mt-1 h-11 w-full rounded-md border border-border bg-background px-3"
          value={imageModel}
          onChange={(e) => {
            setImageModel(e.target.value);
            api("/api/models", { method: "PATCH", body: JSON.stringify({ imageModel: e.target.value || null }) }).catch((err) => toast.error((err as Error).message));
          }}
        >
          <option value="">По умолчанию{image.find((m) => m.isDefault) ? ` (${image.find((m) => m.isDefault)?.modelId})` : ""}</option>
          {image.map((m) => (
            <option key={m.modelId} value={m.modelId}>{m.modelId}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
