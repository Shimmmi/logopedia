"use client";

import { Mic } from "lucide-react";
import { Button } from "./ui/button";

export function VoiceInput({ onText }: { onText: (t: string) => void }) {
  function start() {
    const w = window as unknown as {
      webkitSpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: ((e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void) | null;
      };
      SpeechRecognition?: new () => {
        lang: string;
        start: () => void;
        onresult: ((e: { results: { [k: number]: { [k: number]: { transcript: string } } } }) => void) | null;
      };
    };
    const SR = w.webkitSpeechRecognition || w.SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = "ru-RU";
    rec.onresult = (e) => onText(e.results[0][0].transcript);
    rec.start();
  }
  return (
    <Button type="button" size="sm" variant="outline" onClick={start}>
      <Mic className="h-4 w-4" /> Голос
    </Button>
  );
}
