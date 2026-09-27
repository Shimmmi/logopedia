"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/form";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  async function send() {
    if (!message.trim()) return;
    await api("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ message, page: window.location.pathname }),
    });
    toast.success("Спасибо, сообщение отправлено");
    setMessage("");
    setOpen(false);
  }
  return (
    <div className="fixed bottom-4 left-4 z-30 md:left-auto md:right-4" style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}>
      {open && (
        <div className="mb-2 w-72 rounded-xl border border-border bg-card p-3 shadow-lg">
          <p className="mb-2 text-sm font-medium">Обратная связь / баг</p>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={send}>
              Отправить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Закрыть
            </Button>
          </div>
        </div>
      )}
      <Button size="icon" className="h-12 w-12 rounded-full shadow-lg" onClick={() => setOpen((v) => !v)}>
        <MessageCircle className="h-5 w-5" />
      </Button>
    </div>
  );
}
