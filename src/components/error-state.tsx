"use client";

import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorState({
  title = "Не удалось загрузить",
  description = "Проверьте соединение и повторите.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border px-6 py-10 text-center">
      <AlertCircle className="h-6 w-6 text-destructive" />
      <h3 className="mt-3 text-h3">{title}</h3>
      <p className="mt-1 text-small text-muted-foreground">{description}</p>
      {onRetry && (
        <Button className="mt-4" variant="outline" onClick={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
