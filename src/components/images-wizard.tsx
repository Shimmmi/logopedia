"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { ImageIcon } from "lucide-react";

type Word = { word: string; descriptionRu: string; promptEn: string };
type Img = { id: string; word?: string | null; status: string; url?: string | null; error?: string | null; promptEn: string };
type Set = {
  id: string;
  kind: string;
  status: string;
  params: { style?: string; captions?: boolean; title?: string; words?: Word[] };
  images: Img[];
};

const KINDS = [
  { id: "SOUND_CARDS", label: "Предметные картинки на звук" },
  { id: "ODD_ONE", label: "Найди лишнее" },
  { id: "LOTO", label: "Лото" },
  { id: "COLORING", label: "Раскраска" },
  { id: "STORY", label: "Сюжетная картинка" },
];
const SOUNDS = ["Р", "Р'", "Л", "Л'", "С", "С'", "З", "З'", "Ц", "Ш", "Ж", "Ч", "Щ", "К", "Г", "Х"];

export function ImagesWizard() {
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState("SOUND_CARDS");
  const [sound, setSound] = useState("Р");
  const [position, setPosition] = useState("START");
  const [count, setCount] = useState(6);
  const [theme, setTheme] = useState("животные");
  const [age, setAge] = useState("4–6");
  const [style, setStyle] = useState<"outline" | "color">("outline");
  const [captions, setCaptions] = useState(true);
  const [pairs, setPairs] = useState(false);
  const [exclude, setExclude] = useState(true);
  const [quota, setQuota] = useState({ used: 0, limit: Infinity, left: Infinity });
  const [enabled, setEnabled] = useState(true);
  const [set, setSet] = useState<Set | null>(null);
  const [words, setWords] = useState<Word[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    fetch("/api/images")
      .then((r) => r.json())
      .then((d) => {
        setQuota(d.quota);
        setEnabled(d.enabled !== false);
      });
  }, []);

  useEffect(() => {
    if (step !== 1) return;
    fetch(`/api/images/words?sound=${encodeURIComponent(sound)}`)
      .then((r) => r.json())
      .then((d) => setWords(d.words || []));
  }, [sound, step]);

  useEffect(() => {
    if (!set || set.status === "DONE" || set.status === "FAILED") return;
    const t = setInterval(async () => {
      const d = await fetch(`/api/images/sets/${set.id}`).then((r) => r.json());
      setSet(d.set);
    }, 3000);
    return () => clearInterval(t);
  }, [set]);

  const notEnough = Number.isFinite(quota.limit) && quota.left < 1;
  const sheet = set?.images[0];
  const sheetWords = set?.params.words || [];

  async function start() {
    if (notEnough) {
      toast.error("Лимит листов на этот месяц исчерпан.");
      return;
    }
    try {
      const res = await api<{ set: Set }>("/api/images", {
        method: "POST",
        body: JSON.stringify({
          kind,
          sound,
          position,
          count,
          theme,
          age,
          style,
          captions,
          pairs,
          excludeOpposites: exclude,
        }),
      });
      setSet(res.set);
      setStep(3);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function regenerate() {
    if (!set) return;
    await api(`/api/images/sets/${set.id}`, { method: "POST", body: JSON.stringify({ action: "regenerate" }) });
    setSet({ ...set, status: "QUEUED", images: set.images.map((i) => ({ ...i, status: "QUEUED", url: null, error: null })) });
    toast.success("Перегенерируем лист");
  }

  return (
    <div>
      {!enabled && <p className="mb-4 text-small text-destructive">Генерация изображений не настроена.</p>}
      <p className="mb-4 text-small text-muted-foreground">
        Модель рисует готовый лист A4 для печати. Осталось{" "}
        {Number.isFinite(quota.limit) ? `${quota.left} из ${quota.limit}` : "без лимита"} листов в этом месяце.
      </p>
      {step === 1 && (
        <div className="max-w-xl space-y-4">
          <div>
            <Label>Тип материала</Label>
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KINDS.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(kind === "SOUND_CARDS" || kind === "ODD_ONE" || kind === "LOTO") && (
            <>
              <div>
                <Label>Звук</Label>
                <Select value={sound} onValueChange={setSound}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOUNDS.map((s) => (
                      <SelectItem key={s} value={s}>
                        [{s}]
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Позиция в слове</Label>
                <Select value={position} onValueChange={setPosition}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="START">Начало</SelectItem>
                    <SelectItem value="MIDDLE">Середина</SelectItem>
                    <SelectItem value="END">Конец</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {kind !== "ODD_ONE" && (
                <div>
                  <Label>Картинок на листе</Label>
                  <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[4, 6, 8].map((n) => (
                        <SelectItem key={n} value={String(n)}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={exclude} onCheckedChange={(v) => setExclude(!!v)} />
                Исключить слова со смешиваемыми звуками
              </label>
              {kind === "LOTO" && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={pairs} onCheckedChange={(v) => setPairs(!!v)} />
                  Дублировать пары (мемори)
                </label>
              )}
              <ul className="text-caption text-muted-foreground">
                {words.slice(0, 8).map((w) => (
                  <li key={`${w.word}-${w.promptEn}`}>
                    {w.word} — {w.descriptionRu}
                  </li>
                ))}
              </ul>
              <p className="text-caption text-muted-foreground">Словарь составлен автоматически, проверьте слова перед печатью.</p>
            </>
          )}
          {(kind === "COLORING" || kind === "STORY") && (
            <>
              <div>
                <Label>Тема</Label>
                <Select value={theme} onValueChange={setTheme}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="животные">Животные</SelectItem>
                    <SelectItem value="овощи">Овощи</SelectItem>
                    <SelectItem value="транспорт">Транспорт</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {kind === "STORY" && (
                <div>
                  <Label>Возраст</Label>
                  <Select value={age} onValueChange={setAge}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4–6">4–6 лет</SelectItem>
                      <SelectItem value="7–10">7–10 лет</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          <Button onClick={() => setStep(2)}>Далее</Button>
        </div>
      )}
      {step === 2 && (
        <div className="max-w-xl space-y-4">
          <div>
            <Label>Стиль</Label>
            <Select value={style} onValueChange={(v) => setStyle(v as "outline" | "color")}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outline">Контур для печати</SelectItem>
                <SelectItem value="color">Цветной</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={captions} onCheckedChange={(v) => setCaptions(!!v)} />
            Подписи слов на листе
          </label>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Назад
            </Button>
            <Button onClick={start} disabled={!enabled}>
              Сгенерировать лист A4
            </Button>
          </div>
        </div>
      )}
      {step === 3 && set && (
        <div className="space-y-4">
          <div className="mx-auto max-w-xl overflow-hidden rounded-lg border border-border bg-card">
            {sheet?.url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sheet.url} alt={set.params.title || "Лист A4"} className="w-full bg-white object-contain" />
            ) : (
              <div className="flex aspect-[3/4] items-center justify-center bg-muted">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="mx-auto h-8 w-8 animate-pulse" />
                  <p className="mt-2 text-small">Рисуем лист A4…</p>
                </div>
              </div>
            )}
          </div>
          {sheetWords.length > 0 && (
            <p className="text-small text-muted-foreground">На листе: {sheetWords.map((w) => w.word).join(", ")}</p>
          )}
          {sheet?.error && <p className="text-small text-destructive">{sheet.error}</p>}
          <div className="flex flex-wrap gap-2">
            {(sheet?.status === "FAILED" || sheet?.status === "DONE") && (
              <Button variant="outline" onClick={regenerate}>
                {sheet.status === "FAILED" ? "Повторить" : "Перегенерировать лист"}
              </Button>
            )}
            {sheet?.url && (
              <>
                <Button asChild variant="outline">
                  <a href={sheet.url} download>
                    Скачать PNG
                  </a>
                </Button>
                <Button asChild>
                  <a href={`/api/images/sets/${set.id}/pdf`}>Скачать PDF A4</a>
                </Button>
                <Button
                  variant="outline"
                  onClick={async () => {
                    await api(`/api/images/sets/${set.id}/save`, { method: "POST", body: "{}" });
                    toast.success("Сохранено в Документы");
                  }}
                >
                  Сохранить в Документы
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={() => setStep(1)}>
              Новый лист
            </Button>
          </div>
          <button type="button" className="text-caption text-primary" onClick={() => setShowPrompt((v) => !v)}>
            Что мы попросили у модели
          </button>
          {showPrompt && <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-caption">{sheet?.promptEn}</pre>}
          <p className="text-caption text-muted-foreground">Изображения созданы ИИ. Проверьте перед печатью.</p>
        </div>
      )}
    </div>
  );
}
