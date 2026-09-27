"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";

type Word = {
  id: string;
  word: string;
  sound: string;
  position: string;
  descriptionRu: string;
  promptEn: string;
  hidden: boolean;
  verified: boolean;
};

function AddWord({ onAdd }: { onAdd: (w: Word) => void }) {
  const [word, setWord] = useState("");
  const [sound, setSound] = useState("Р");
  const [promptEn, setPromptEn] = useState("");
  return (
    <div className="grid gap-2 md:grid-cols-4">
      <Input placeholder="Слово" value={word} onChange={(e) => setWord(e.target.value)} />
      <Input placeholder="Звук" value={sound} onChange={(e) => setSound(e.target.value)} />
      <Input placeholder="onion, the vegetable" value={promptEn} onChange={(e) => setPromptEn(e.target.value)} />
      <Button
        variant="outline"
        onClick={async () => {
          if (!word || !sound || !promptEn) return;
          const res = await api<{ word: Word }>("/api/images/words", {
            method: "POST",
            body: JSON.stringify({ word, sound, promptEn, descriptionRu: word }),
          });
          onAdd(res.word);
          setWord("");
          setPromptEn("");
        }}
      >
        Добавить
      </Button>
    </div>
  );
}

export function PictureWordsAdmin() {
  const [words, setWords] = useState<Word[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    fetch("/api/images/words?hidden=1")
      .then((r) => r.json())
      .then((d) => setWords(d.words || []));
  }, []);
  const shown = words.filter((w) => !q || w.word.includes(q) || w.sound.includes(q.toUpperCase()));
  return (
    <div className="space-y-3">
      <Input placeholder="Поиск" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="divide-y divide-border rounded-lg border border-border">
        {shown.slice(0, 80).map((w) => (
          <li key={w.id} className="flex items-center justify-between gap-2 p-2 text-small">
            <div>
              <span className="font-medium">{w.word}</span> [{w.sound}] {w.position}
              <div className="text-caption text-muted-foreground">{w.descriptionRu}</div>
            </div>
            <label className="flex items-center gap-2 text-caption">
              Скрыть
              <Switch
                checked={w.hidden}
                onCheckedChange={async (v) => {
                  await api(`/api/images/words/${w.id}`, { method: "PATCH", body: JSON.stringify({ hidden: v }) });
                  setWords((list) => list.map((x) => (x.id === w.id ? { ...x, hidden: v } : x)));
                }}
              />
            </label>
          </li>
        ))}
      </ul>
      <AddWord onAdd={(word) => setWords((w) => [word, ...w])} />
    </div>
  );
}
