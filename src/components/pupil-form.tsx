"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PhoneInput } from "@/components/phone-input";
import { PmpkUpload, UploadBar, uploadWithProgress } from "@/components/pmpk-upload";
import { SocialLinksEditor } from "@/components/social-links";
import { CONTACT_ROLES, GENDER, PUPIL_STATUS } from "@/lib/labels";
import { isPhoneComplete, normalizePhone } from "@/lib/phone";
import { SocialLink } from "@/lib/social";
import { api } from "@/lib/api";
import { toast } from "sonner";

type Tag = { id: string; name: string; color: string };
export type Contact = { key: string; fullName: string; role: string; phone: string; email: string; isPrimary: boolean; links: SocialLink[] };
export type PupilFormValue = {
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  gender: string;
  grade: string;
  school: string;
  enrolledAt: string;
  status: string;
  diagnosis: string;
  pmpkMode: "text" | "file";
  aopVariant: string;
  pmpkDate: string;
  pmpkNextAt: string;
  pmpkNumber: string;
  tagIds: string[];
  contacts: Contact[];
  consent: { given: boolean; givenAt: string; signedByKey: string; signedByLegacy: string };
};

export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return {
    lastName: parts[0] || "",
    firstName: parts[1] || "",
    middleName: parts.slice(2).join(" "),
  };
}

export function joinFullName(v: { lastName: string; firstName: string; middleName: string }) {
  return [v.lastName, v.firstName, v.middleName].map((s) => s.trim()).filter(Boolean).join(" ");
}

let seq = 0;
export function contactKey() {
  seq += 1;
  return `c${Date.now().toString(36)}${seq}`;
}

export function contactLabel(c?: Pick<Contact, "fullName" | "role">) {
  if (!c) return "";
  return `${c.fullName.trim()} (${c.role})`;
}

/** Найти контакт по строке «ФИО (Роль)» или по ФИО — для загрузки старых данных. */
export function matchSignedBy(signedBy: string, contacts: Contact[]) {
  const s = signedBy.trim();
  if (!s) return "";
  return contacts.find((c) => contactLabel(c) === s || c.fullName.trim() === s)?.key ?? "";
}

const roleForIndex = (i: number) => (i === 0 ? "Мама" : i === 1 ? "Папа" : "Другое");
const emptyContact = (role: string): Contact => ({ key: contactKey(), fullName: "", role, phone: "", email: "", isPrimary: false, links: [] });

const empty: PupilFormValue = {
  lastName: "",
  firstName: "",
  middleName: "",
  birthDate: "",
  gender: "",
  grade: "",
  school: "",
  enrolledAt: "",
  status: "ACTIVE",
  diagnosis: "",
  pmpkMode: "text",
  aopVariant: "",
  pmpkDate: "",
  pmpkNextAt: "",
  pmpkNumber: "",
  tagIds: [],
  contacts: [],
  consent: { given: false, givenAt: "", signedByKey: "", signedByLegacy: "" },
};

type Errors = Record<string, string>;

export function PupilForm({ initial, pupilId }: { initial?: Partial<PupilFormValue>; pupilId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<PupilFormValue>(() => {
    const base = { ...empty, ...initial };
    base.contacts = (base.contacts || []).map((c) => ({ ...emptyContact(c.role), ...c, links: c.links || [] }));
    if (!base.contacts.length && !pupilId) base.contacts = [{ ...emptyContact("Мама"), isPrimary: true }];
    return base;
  });
  const [tags, setTags] = useState<Tag[]>([]);
  const [newTag, setNewTag] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [pmpkFile, setPmpkFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [consentOpen, setConsentOpen] = useState(false);
  const [dontAsk, setDontAsk] = useState(false);
  const [hasConsent, setHasConsent] = useState(false);
  const [autoAnalyze, setAutoAnalyze] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const rootRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    fetch("/api/tags")
      .then((r) => r.json())
      .then((d) => setTags(d.tags || []));
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        setHasConsent(!!d.user?.aiPmpkConsentAt);
        setAutoAnalyze(d.user?.aiPmpkAutoAnalyze !== false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  function patch(p: Partial<PupilFormValue>) {
    setForm((f) => ({ ...f, ...p }));
    setDirty(true);
  }

  function clearError(key: string) {
    if (errors[key]) setErrors((e) => ({ ...e, [key]: "" }));
  }

  function patchContact(key: string, p: Partial<Contact>) {
    patch({ contacts: form.contacts.map((c) => (c.key === key ? { ...c, ...p } : c)) });
  }

  function removeContact(key: string) {
    const idx = form.contacts.findIndex((c) => c.key === key);
    const removed = form.contacts[idx];
    if (!removed) return;
    const wasSigned = form.consent.signedByKey === key;
    const contacts = form.contacts.filter((c) => c.key !== key);
    if (removed.isPrimary && contacts[0]) contacts[0] = { ...contacts[0], isPrimary: true };
    const consent = wasSigned ? { ...form.consent, signedByKey: "" } : form.consent;
    patch({ contacts, consent });
    toast(`Контакт «${removed.fullName.trim() || "без имени"}» убран`, {
      action: {
        label: "Отменить",
        onClick: () =>
          setForm((f) => {
            if (f.contacts.some((c) => c.key === key)) return f;
            const next = [...f.contacts];
            next.splice(Math.min(idx, next.length), 0, removed);
            const restored = removed.isPrimary ? next.map((c) => ({ ...c, isPrimary: c.key === key })) : next;
            return { ...f, contacts: restored, consent: wasSigned && !f.consent.signedByKey ? { ...f.consent, signedByKey: key } : f.consent };
          }),
      },
      duration: 10000,
    });
  }

  const filledContacts = useMemo(() => form.contacts.filter((c) => c.fullName.trim()), [form.contacts]);

  function validate(): Errors {
    const e: Errors = {};
    if (!form.lastName.trim()) e.lastName = "Укажите фамилию";
    if (!form.firstName.trim()) e.firstName = "Укажите имя";
    for (const c of form.contacts) {
      if (!c.fullName.trim() && (c.phone.trim() || c.email.trim())) e[`c-name-${c.key}`] = "Укажите ФИО контакта";
      if (c.phone && !isPhoneComplete(c.phone)) e[`c-phone-${c.key}`] = "Номер введён не полностью";
      if (c.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim())) e[`c-email-${c.key}`] = "Проверьте адрес почты";
    }
    if (form.consent.given && !form.consent.signedByKey && !form.consent.signedByLegacy) {
      e.signedBy = filledContacts.length ? "Выберите, кто подписал согласие" : "Добавьте контакт с ФИО, чтобы указать подписавшего";
    }
    return e;
  }

  async function save() {
    const e = validate();
    setErrors(e);
    const first = Object.keys(e).find((k) => e[k]);
    if (first) {
      const el = rootRef.current?.querySelector<HTMLElement>(`#${CSS.escape(first)}`);
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      el?.focus();
      toast.error("Проверьте выделенные поля");
      return;
    }
    const signed = form.contacts.find((c) => c.key === form.consent.signedByKey);
    const payload = {
      fullName: joinFullName(form),
      birthDate: form.birthDate || null,
      gender: form.gender || null,
      grade: form.grade,
      school: form.school,
      enrolledAt: form.enrolledAt || undefined,
      status: form.status,
      diagnosis: form.diagnosis,
      pmpkDate: form.pmpkDate || null,
      pmpkNextAt: form.pmpkNextAt || null,
      pmpkNumber: form.pmpkNumber,
      aopVariant: form.aopVariant,
      tagIds: form.tagIds,
      contacts: filledContacts.map((c) => ({
        fullName: c.fullName.trim(),
        role: c.role,
        phone: normalizePhone(c.phone),
        email: c.email.trim(),
        isPrimary: c.isPrimary,
        links: c.links,
      })),
      consent: {
        given: form.consent.given,
        givenAt: form.consent.givenAt || null,
        signedBy: form.consent.given ? (signed ? contactLabel(signed) : form.consent.signedByLegacy) : "",
      },
    };
    setSaving(true);
    try {
      let id = pupilId;
      if (pupilId) {
        await api(`/api/pupils/${pupilId}`, { method: "PATCH", body: JSON.stringify(payload) });
      } else {
        const res = await api<{ pupil: { id: string } }>("/api/pupils", { method: "POST", body: JSON.stringify(payload) });
        id = res.pupil.id;
      }
      if (id && form.pmpkMode === "file" && pmpkFile) {
        setUploadPct(0);
        const up = await uploadWithProgress(`/api/pupils/${id}/pmpk`, pmpkFile, { analyze: "0" }, setUploadPct);
        if (!up.ok) {
          sessionStorage.setItem(`pmpk-retry:${id}`, "1");
          toast.error((up.json as { error?: string }).error || "Файл заключения не загружен — повторите в карточке");
        } else if ((up.json as { analyzeSkipped?: string }).analyzeSkipped) {
          toast.message((up.json as { analyzeSkipped: string }).analyzeSkipped);
        }
      }
      setDirty(false);
      toast.success(pupilId ? "Карточка сохранена" : "Ученик добавлен");
      router.push(`/pupils/${id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setSaving(false);
      setUploadPct(null);
    }
  }

  async function applyPreview(result: {
    summary?: string;
    pupil?: { fullName?: string | null; birthDate?: string | null; gender?: string | null; school?: string | null; grade?: string | null; reviewDate?: string | null };
    pmpk?: { date?: string | null; number?: string | null; aop?: string | null };
    tags?: { id?: string }[];
    newTags?: { name?: string; category?: string }[];
  }) {
    const names = splitFullName(result.pupil?.fullName || "");
    const extraIds: string[] = [];
    for (const t of result.newTags || []) {
      if (!t.name?.trim()) continue;
      try {
        const created = await api<{ tag: Tag }>("/api/tags", { method: "POST", body: JSON.stringify({ name: t.name, category: t.category || "DIAGNOSIS" }) });
        setTags((list) => (list.some((x) => x.id === created.tag.id) ? list : [...list, created.tag]));
        extraIds.push(created.tag.id);
      } catch {
        /* тег уже есть */
      }
    }
    const incoming = [...(result.tags || []).map((t) => t.id).filter(Boolean) as string[], ...extraIds];
    setForm((f) => ({
      ...f,
      lastName: f.lastName.trim() || names.lastName,
      firstName: f.firstName.trim() || names.firstName,
      middleName: f.middleName.trim() || names.middleName,
      birthDate: f.birthDate || (result.pupil?.birthDate || "").slice(0, 10),
      gender: f.gender || result.pupil?.gender || "",
      school: f.school || result.pupil?.school || "",
      grade: f.grade || result.pupil?.grade || "",
      diagnosis: f.diagnosis || result.summary || "",
      pmpkDate: f.pmpkDate || (result.pmpk?.date || "").slice(0, 10),
      pmpkNextAt: f.pmpkNextAt || (result.pupil?.reviewDate || "").slice(0, 10),
      pmpkNumber: f.pmpkNumber || result.pmpk?.number || "",
      aopVariant: f.aopVariant || result.pmpk?.aop || "",
      tagIds: Array.from(new Set([...f.tagIds, ...incoming])),
    }));
    setDirty(true);
    toast.success("Поля заполнены из заключения. Проверьте их и сохраните карточку.");
  }

  async function startPreview(file: File) {
    setAnalyzing(true);
    setUploadPct(0);
    try {
      const up = await uploadWithProgress("/api/pmpk/preview", file, undefined, setUploadPct);
      if (!up.ok) throw new Error((up.json as { error?: string }).error || "Не удалось отправить файл");
      const id = (up.json as { id: string }).id;
      const started = Date.now();
      while (Date.now() - started < 180000) {
        await new Promise((r) => setTimeout(r, 2000));
        const st = await fetch(`/api/pmpk/preview/${id}`).then((r) => r.json());
        if (st.status === "DONE") {
          await applyPreview(st.result || {});
          return;
        }
        if (st.status === "FAILED") throw new Error(st.error || "Не удалось проанализировать");
      }
      throw new Error("Анализ занимает слишком много времени");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAnalyzing(false);
      setUploadPct(null);
    }
  }

  function onPmpkFile(file: File | null) {
    setPmpkFile(file);
    setDirty(true);
    if (!file || !autoAnalyze) return;
    if (!hasConsent) {
      setConsentOpen(true);
      return;
    }
    void startPreview(file);
  }

  function requestAnalysis() {
    if (!pmpkFile) return;
    if (!hasConsent) {
      setConsentOpen(true);
      return;
    }
    void startPreview(pmpkFile);
  }

  function cancel() {
    if (dirty) return setLeaveOpen(true);
    router.push(pupilId ? `/pupils/${pupilId}` : "/pupils");
  }

  async function createTag() {
    if (!newTag.trim()) return;
    try {
      const res = await api<{ tag: Tag }>("/api/tags", { method: "POST", body: JSON.stringify({ name: newTag.trim(), category: "CUSTOM" }) });
      setTags((t) => [...t, res.tag]);
      patch({ tagIds: [...form.tagIds, res.tag.id] });
      setNewTag("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const field = (key: string, label: string, input: React.ReactNode, hint?: string) => (
    <div>
      <Label htmlFor={key}>{label}</Label>
      {input}
      {errors[key] ? (
        <p id={`${key}-error`} role="alert" className="mt-1 text-caption text-destructive">
          {errors[key]}
        </p>
      ) : hint ? (
        <p className="mt-1 text-caption text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );

  const inputProps = (key: string) => ({
    id: key,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${key}-error` : undefined,
    className: `mt-1 ${errors[key] ? "border-destructive" : ""}`,
  });

  return (
    <form
      ref={rootRef}
      className="space-y-8 pb-28"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!saving) save();
      }}
    >
      <section id="main" className="space-y-3">
        <h2 className="text-h2">Основное</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {field(
            "lastName",
            "Фамилия *",
            <Input {...inputProps("lastName")} autoComplete="off" value={form.lastName} onChange={(e) => (clearError("lastName"), patch({ lastName: e.target.value }))} />
          )}
          {field(
            "firstName",
            "Имя *",
            <Input {...inputProps("firstName")} autoComplete="off" value={form.firstName} onChange={(e) => (clearError("firstName"), patch({ firstName: e.target.value }))} />
          )}
          {field("middleName", "Отчество", <Input {...inputProps("middleName")} autoComplete="off" value={form.middleName} onChange={(e) => patch({ middleName: e.target.value })} />, "Необязательно")}
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {field("birthDate", "Дата рождения", <Input {...inputProps("birthDate")} type="date" value={form.birthDate} onChange={(e) => patch({ birthDate: e.target.value })} />)}
          <div>
            <Label htmlFor="gender">Пол</Label>
            <Select value={form.gender} onValueChange={(v) => patch({ gender: v })}>
              <SelectTrigger id="gender" className="mt-1">
                <SelectValue placeholder="Выберите" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(GENDER).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field("grade", "Класс", <Input {...inputProps("grade")} value={form.grade} onChange={(e) => patch({ grade: e.target.value })} placeholder="Например, 2 «Б»" />)}
          {field("school", "Школа", <Input {...inputProps("school")} value={form.school} onChange={(e) => patch({ school: e.target.value })} />)}
          {field("enrolledAt", "Дата зачисления", <Input {...inputProps("enrolledAt")} type="date" value={form.enrolledAt} onChange={(e) => patch({ enrolledAt: e.target.value })} />)}
          <div>
            <Label htmlFor="status">Статус</Label>
            <Select value={form.status} onValueChange={(v) => patch({ status: v })}>
              <SelectTrigger id="status" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PUPIL_STATUS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section id="parents" className="space-y-3">
        <h2 className="text-h2">Родители и законные представители</h2>
        {form.contacts.length === 0 && <p className="text-small text-muted-foreground">Контакты не добавлены.</p>}
        {form.contacts.map((c, i) => (
          <div key={c.key} className="rounded-lg border border-border">
            <div className="flex items-center justify-between gap-2 border-b border-border py-1 pl-3 pr-1">
              <div className="flex items-center gap-2 text-small">
                <span className="font-medium">Контакт {i + 1}</span>
                <span className="text-muted-foreground">· {c.role}</span>
                {c.isPrimary && <span className="rounded-full bg-secondary px-2 py-0.5 text-caption">основной</span>}
              </div>
              <button
                type="button"
                className="flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label={`Убрать контакт: ${c.fullName.trim() || "без имени"}`}
                onClick={() => removeContact(c.key)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid gap-3 p-3 md:grid-cols-2">
              {field(
                `c-name-${c.key}`,
                "ФИО",
                <Input {...inputProps(`c-name-${c.key}`)} autoComplete="off" value={c.fullName} onChange={(e) => (clearError(`c-name-${c.key}`), patchContact(c.key, { fullName: e.target.value }))} />
              )}
              <div>
                <Label htmlFor={`c-role-${c.key}`}>Кем приходится</Label>
                <Select value={c.role} onValueChange={(v) => patchContact(c.key, { role: v })}>
                  <SelectTrigger id={`c-role-${c.key}`} className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTACT_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {field(
                `c-phone-${c.key}`,
                "Телефон",
                <PhoneInput {...inputProps(`c-phone-${c.key}`)} value={c.phone} onChange={(v) => (clearError(`c-phone-${c.key}`), patchContact(c.key, { phone: v }))} />
              )}
              {field(
                `c-email-${c.key}`,
                "Эл. почта",
                <Input {...inputProps(`c-email-${c.key}`)} type="email" autoComplete="off" value={c.email} onChange={(e) => (clearError(`c-email-${c.key}`), patchContact(c.key, { email: e.target.value }))} />
              )}
              <SocialLinksEditor links={c.links || []} onChange={(links) => patchContact(c.key, { links })} />
              {form.contacts.length > 1 && (
                <label className="flex min-h-11 items-center gap-2 text-sm md:col-span-2">
                  <Checkbox
                    checked={c.isPrimary}
                    onCheckedChange={(v) => patch({ contacts: form.contacts.map((x) => ({ ...x, isPrimary: x.key === c.key ? !!v : v ? false : x.isPrimary })) })}
                  />
                  Основной контакт для связи
                </label>
              )}
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => patch({ contacts: [...form.contacts, { ...emptyContact(roleForIndex(form.contacts.length)), isPrimary: form.contacts.length === 0 }] })}>
          Добавить контакт
        </Button>
      </section>

      <section id="diag" className="space-y-3">
        <h2 className="text-h2">Заключение ПМПК</h2>
        <div className="flex rounded-md border border-border p-1">
          <button type="button" className={`min-h-11 flex-1 rounded-sm text-sm ${form.pmpkMode === "text" ? "bg-secondary" : ""}`} onClick={() => patch({ pmpkMode: "text" })}>
            Ввести текст
          </button>
          <button type="button" className={`min-h-11 flex-1 rounded-sm text-sm ${form.pmpkMode === "file" ? "bg-secondary" : ""}`} onClick={() => patch({ pmpkMode: "file" })}>
            Загрузить файл
          </button>
        </div>
        {form.pmpkMode === "text" ? (
          field(
            "diagnosis",
            "Текст заключения",
            <Textarea {...inputProps("diagnosis")} rows={4} value={form.diagnosis} onChange={(e) => patch({ diagnosis: e.target.value })} />
          )
        ) : (
          <>
            <PmpkUpload file={pmpkFile} onFile={onPmpkFile} disabled={saving || analyzing} />
            {!autoAnalyze && pmpkFile && (
              <Button type="button" onClick={requestAnalysis} disabled={analyzing}>
                Анализ
              </Button>
            )}
            {uploadPct !== null && <UploadBar value={uploadPct} />}
          </>
        )}
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {field("pmpkDate", "Дата заключения", <Input {...inputProps("pmpkDate")} type="date" value={form.pmpkDate} onChange={(e) => patch({ pmpkDate: e.target.value })} />)}
          {field("pmpkNextAt", "Срок пересмотра", <Input {...inputProps("pmpkNextAt")} type="date" value={form.pmpkNextAt} onChange={(e) => patch({ pmpkNextAt: e.target.value })} />)}
          {field("pmpkNumber", "Номер протокола", <Input {...inputProps("pmpkNumber")} value={form.pmpkNumber} onChange={(e) => patch({ pmpkNumber: e.target.value })} />)}
          {field("aopVariant", "Вариант АООП", <Input {...inputProps("aopVariant")} value={form.aopVariant} onChange={(e) => patch({ aopVariant: e.target.value })} />)}
        </div>
      </section>

      <section id="tags" className="space-y-3">
        <h2 className="text-h2">Теги</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Теги ученика">
          {tags.map((t) => {
            const on = form.tagIds.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                className={`min-h-11 rounded-full px-3 text-sm ${on ? "text-white" : "bg-secondary"}`}
                style={on ? { background: t.color } : undefined}
                onClick={() => patch({ tagIds: on ? form.tagIds.filter((id) => id !== t.id) : [...form.tagIds, t.id] })}
              >
                {t.name}
              </button>
            );
          })}
          {!tags.length && <p className="text-small text-muted-foreground">Тегов пока нет — создайте первый.</p>}
        </div>
        <div className="flex gap-2">
          <Input
            aria-label="Название нового тега"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="Новый тег"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                createTag();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={createTag} disabled={!newTag.trim()}>
            Создать
          </Button>
        </div>
      </section>

      <section id="consent" className="space-y-3">
        <h2 className="text-h2">Согласие на обработку персональных данных</h2>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <Checkbox
            checked={form.consent.given}
            onCheckedChange={(v) => {
              clearError("signedBy");
              patch({ consent: { ...form.consent, given: !!v } });
            }}
          />
          Согласие получено
        </label>
        {form.consent.given && (
          <div className="grid gap-3 md:grid-cols-2">
            {field(
              "consentDate",
              "Дата подписания",
              <Input {...inputProps("consentDate")} type="date" value={form.consent.givenAt} onChange={(e) => patch({ consent: { ...form.consent, givenAt: e.target.value } })} />
            )}
            <div>
              <Label htmlFor="signedBy">Кто подписал</Label>
              {filledContacts.length || form.consent.signedByLegacy ? (
                <Select
                  value={form.consent.signedByKey || (form.consent.signedByLegacy ? "__legacy" : "")}
                  onValueChange={(v) => {
                    clearError("signedBy");
                    patch({ consent: { ...form.consent, signedByKey: v === "__legacy" ? "" : v } });
                  }}
                >
                  <SelectTrigger id="signedBy" className={`mt-1 ${errors.signedBy ? "border-destructive" : ""}`} aria-invalid={errors.signedBy ? true : undefined}>
                    <SelectValue placeholder="Выберите из контактов" />
                  </SelectTrigger>
                  <SelectContent>
                    {filledContacts.map((c) => (
                      <SelectItem key={c.key} value={c.key}>
                        {contactLabel(c)}
                      </SelectItem>
                    ))}
                    {form.consent.signedByLegacy && !form.consent.signedByKey && <SelectItem value="__legacy">{form.consent.signedByLegacy}</SelectItem>}
                  </SelectContent>
                </Select>
              ) : (
                <p id="signedBy" tabIndex={-1} className="mt-2 text-small text-muted-foreground">
                  Сначала заполните ФИО родителя в разделе выше — он появится в этом списке.
                </p>
              )}
              {errors.signedBy && (
                <p role="alert" className="mt-1 text-caption text-destructive">
                  {errors.signedBy}
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:left-[264px]">
        <div className="mx-auto flex max-w-content items-center justify-between gap-2">
          <p className="hidden text-caption text-muted-foreground sm:block">{dirty ? "Есть несохранённые изменения" : " "}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={cancel}>
              Отмена
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        </div>
      </div>

      <AlertDialog open={consentOpen} onOpenChange={setConsentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Анализ заключения</AlertDialogTitle>
            <AlertDialogDescription>
              Текст заключения будет передан модели. Она предложит теги и поля карточки: ФИО, школа, класс, даты. В карточку попадёт только то, что вы примете.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={dontAsk} onCheckedChange={(v) => setDontAsk(!!v)} />
            Больше не спрашивать
          </label>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setHasConsent(true);
                setConsentOpen(false);
                if (dontAsk) {
                  void api("/api/settings", { method: "PATCH", body: JSON.stringify({ aiPmpkConsentAt: new Date().toISOString() }) });
                }
                if (pmpkFile) void startPreview(pmpkFile);
              }}
            >
              Продолжить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {analyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-label="Анализ заключения" className="w-full max-w-sm rounded-xl bg-card p-8 text-center shadow-lg">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <p className="mt-4 text-h3">Анализ заключения</p>
            <p className="mt-2 text-small text-muted-foreground">Читаем файл и подставляем поля карточки</p>
          </div>
        </div>
      )}
      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Уйти без сохранения?</AlertDialogTitle>
            <AlertDialogDescription>Изменения в карточке не сохранены и будут потеряны.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Остаться</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDirty(false);
                router.push(pupilId ? `/pupils/${pupilId}` : "/pupils");
              }}
            >
              Уйти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
