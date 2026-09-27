"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderOpen, FileText, MoreHorizontal, Lock } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";

type Folder = { id: string; name: string; parentId: string | null; isSystem: boolean };
type Doc = {
  id: string;
  fileName: string;
  tags: string[];
  url: string;
  createdAt: string;
  sizeBytes: number;
  mimeType: string;
  fileType: string;
};

export default function DocumentsPage() {
  const [folders, setFolders] = useState<Folder[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [folderId, setFolderId] = useState("");
  const [q, setQ] = useState("");
  const [trash, setTrash] = useState(false);
  const [preview, setPreview] = useState<Doc | null>(null);
  const [folderSheet, setFolderSheet] = useState(false);
  const [folderDlg, setFolderDlg] = useState<{ parentId?: string; id?: string; name: string } | null>(null);

  async function load() {
    const [f, d] = await Promise.all([
      fetch("/api/folders").then((r) => r.json()),
      fetch(`/api/documents?${new URLSearchParams({ q, folderId, trash: trash ? "1" : "" })}`).then((r) => r.json()),
    ]);
    setFolders(f.folders || []);
    setDocs(d.documents || []);
  }
  useEffect(() => {
    load();
  }, [folderId, q, trash]);

  const tree = useMemo(() => folders.filter((f) => !f.parentId), [folders]);
  const children = (id: string) => folders.filter((f) => f.parentId === id);

  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    if (folderId) fd.append("folderId", folderId);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    if (!res.ok) toast.error("Не удалось загрузить файл");
    else toast.success("Файл загружен");
    load();
  }

  async function restore(id: string) {
    await api(`/api/documents/${id}`, { method: "PATCH", body: JSON.stringify({ restore: true }) });
    toast.success("Восстановлено");
    load();
  }

  async function toTrash(id: string) {
    await api(`/api/documents/${id}`, { method: "DELETE" });
    toast("В корзине", {
      action: { label: "Отменить", onClick: () => restore(id) },
      duration: 10000,
    });
    load();
  }

  async function saveFolder() {
    if (!folderDlg?.name.trim()) return;
    if (folderDlg.id) await api(`/api/folders/${folderDlg.id}`, { method: "PATCH", body: JSON.stringify({ name: folderDlg.name }) });
    else await api("/api/folders", { method: "POST", body: JSON.stringify({ name: folderDlg.name, parentId: folderDlg.parentId }) });
    setFolderDlg(null);
    load();
  }

  function FolderList({ parent }: { parent: string | null }) {
    return (
      <ul className="space-y-1">
        {(parent ? children(parent) : tree).map((f) => (
          <li key={f.id}>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className={`flex min-h-11 flex-1 items-center gap-2 rounded-md px-2 text-left text-sm ${folderId === f.id ? "bg-accent" : "hover:bg-muted"}`}
                onClick={() => { setFolderId(f.id); setFolderSheet(false); }}
              >
                {f.isSystem ? <Lock className="h-4 w-4" /> : <FolderOpen className="h-4 w-4" />}
                {f.name}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" aria-label="Папка">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => setFolderDlg({ parentId: f.id, name: "" })}>Подпапка</DropdownMenuItem>
                  {!f.isSystem && <DropdownMenuItem onClick={() => setFolderDlg({ id: f.id, name: f.name })}>Переименовать</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="pl-4">
              <FolderList parent={f.id} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div>
      <PageHeader
        title={trash ? "Корзина" : "Документы"}
        crumbs={[{ href: "/dashboard", label: "Кабинет" }, { label: "Документы" }]}
        actions={
          <>
            <Button variant="outline" onClick={() => setTrash(!trash)}>
              {trash ? "К файлам" : "Корзина"}
            </Button>
            <label className="inline-flex">
              <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <span className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm text-primary-foreground">Загрузить</span>
            </label>
          </>
        }
      />
      <div className="mb-4 flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск по имени и тексту" />
        <Button className="lg:hidden" variant="outline" onClick={() => setFolderSheet(true)}>
          Папки
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="hidden rounded-xl border border-border bg-card p-3 lg:block">
          <FolderList parent={null} />
        </aside>
        <div>
          {!docs.length ? (
            <EmptyState icon={FileText} title={trash ? "Корзина пуста" : "В этой папке пока нет файлов"} />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 p-3">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setPreview(d)}>
                    <div className="truncate font-medium">{d.fileName}</div>
                    <div className="text-caption text-muted-foreground">
                      {formatBytes(d.sizeBytes || 0)} · {formatDate(d.createdAt)}
                    </div>
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="Файл">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => setPreview(d)}>Открыть</DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <a href={d.url}>Скачать</a>
                      </DropdownMenuItem>
                      {trash ? (
                        <DropdownMenuItem onClick={() => restore(d.id)}>Восстановить</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => toTrash(d.id)}>В корзину</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Sheet open={folderSheet} onOpenChange={setFolderSheet}>
        <SheetContent side="left">
          <FolderList parent={null} />
        </SheetContent>
      </Sheet>
      <Dialog open={!!folderDlg} onOpenChange={() => setFolderDlg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{folderDlg?.id ? "Переименовать папку" : "Новая папка"}</DialogTitle>
          </DialogHeader>
          <Input value={folderDlg?.name || ""} onChange={(e) => setFolderDlg((d) => (d ? { ...d, name: e.target.value } : d))} />
          <Button onClick={saveFolder}>Сохранить</Button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!preview} onOpenChange={() => setPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{preview?.fileName}</DialogTitle>
          </DialogHeader>
          {preview?.mimeType?.startsWith("image/") && <img src={preview.url} alt="" className="max-h-[70vh] w-full object-contain" />}
          {preview?.mimeType === "application/pdf" && <iframe title={preview.fileName} src={preview.url} className="h-[70vh] w-full" />}
          {preview?.fileType === "AUDIO" && <audio controls src={preview.url} className="w-full" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
