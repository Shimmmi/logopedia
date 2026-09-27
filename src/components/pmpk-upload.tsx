"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FileUp, X } from "lucide-react";
import { formatBytes } from "@/lib/utils";

const ACCEPT = "application/pdf,.doc,.docx,image/jpeg,image/png";

export function PmpkUpload({
  onFile,
  file,
  disabled,
}: {
  onFile: (f: File | null) => void;
  file: File | null;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function pick(list: FileList | null) {
    const f = list?.[0];
    if (!f) return;
    if (f.size <= 0) return;
    if (f.size > 25 * 1024 * 1024) return;
    onFile(f);
  }

  return (
    <div>
      <div
        className={`rounded-lg border border-dashed p-4 ${over ? "border-primary bg-accent" : "border-border"}`}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          pick(e.dataTransfer.files);
        }}
      >
        {file ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-caption text-muted-foreground">{formatBytes(file.size)}</p>
            </div>
            <button type="button" className="flex h-11 w-11 items-center justify-center" aria-label="Удалить файл" onClick={() => onFile(null)} disabled={disabled}>
              <X className="h-5 w-5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <FileUp className="h-6 w-6 text-muted-foreground" />
            <p className="text-small">Перетащите файл или выберите с устройства</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={disabled}>
                Выбрать файл
              </Button>
              <Button type="button" variant="outline" className="md:hidden" onClick={() => camRef.current?.click()} disabled={disabled}>
                Сфотографировать
              </Button>
            </div>
          </div>
        )}
      </div>
      <p className="mt-1 text-caption text-muted-foreground">.doc — только хранение; анализ для PDF, DOCX и фото. До 25 МБ.</p>
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => pick(e.target.files)} />
      <input ref={camRef} type="file" accept="image/jpeg,image/png" capture="environment" className="hidden" onChange={(e) => pick(e.target.files)} />
    </div>
  );
}

export function uploadWithProgress(url: string, file: File, extra?: Record<string, string>, onProgress?: (pct: number) => void) {
  return new Promise<{ ok: boolean; status: number; json: any }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let json = {};
      try {
        json = JSON.parse(xhr.responseText);
      } catch {
        /* empty */
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json });
    };
    xhr.onerror = () => reject(new Error("Сеть недоступна"));
    const fd = new FormData();
    fd.append("file", file);
    if (extra) for (const [k, v] of Object.entries(extra)) fd.append(k, v);
    xhr.send(fd);
  });
}

export function UploadBar({ value }: { value: number }) {
  return <Progress value={value} className="mt-2" />;
}
