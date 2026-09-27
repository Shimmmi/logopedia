"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

function isTypingTarget(el: EventTarget | null) {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function Hotkeys() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isTypingTarget(e.target)) return;
      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        document.getElementById("global-search")?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Клавиши</DialogTitle>
        </DialogHeader>
        <ul className="space-y-2 text-small">
          <li>
            <kbd className="rounded bg-muted px-1">/</kbd> — поиск
          </li>
          <li>
            <kbd className="rounded bg-muted px-1">Esc</kbd> — закрыть окно
          </li>
          <li>
            <kbd className="rounded bg-muted px-1">?</kbd> — эта подсказка
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}
