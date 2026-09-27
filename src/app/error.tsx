"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-h1">Что-то пошло не так</h1>
      <p className="text-muted-foreground">Попробуйте обновить страницу.</p>
      <Button onClick={reset}>Повторить</Button>
    </div>
  );
}
