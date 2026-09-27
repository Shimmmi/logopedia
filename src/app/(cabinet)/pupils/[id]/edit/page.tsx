"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { PupilForm, PupilFormValue, contactKey, matchSignedBy, splitFullName } from "@/components/pupil-form";
import { ErrorState } from "@/components/error-state";
import { formatPhone } from "@/lib/phone";
import { Skeleton } from "@/components/ui/skeleton";

function isoDate(v?: string | Date | null) {
  if (!v) return "";
  return String(v).slice(0, 10);
}

export default function EditPupilPage() {
  const { id } = useParams<{ id: string }>();
  const [initial, setInitial] = useState<Partial<PupilFormValue> | null>(null);
  const [title, setTitle] = useState("Карточка");
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    fetch(`/api/pupils/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || "Не удалось загрузить карточку");
        return r.json();
      })
      .then((d) => {
        const p = d.pupil;
        setTitle(p.fullName || "Карточка");
        const contacts = (p.contacts || []).map((c: { fullName: string; role: string; phone?: string; email?: string; isPrimary: boolean; links?: { type: "telegram" | "max" | "vk"; value: string }[] }) => ({
          key: contactKey(),
          fullName: c.fullName,
          role: c.role,
          phone: c.phone ? formatPhone(c.phone) : "",
          email: c.email || "",
          isPrimary: c.isPrimary,
          links: c.links || [],
        }));
        const signedBy = p.consent?.signedBy || "";
        const signedByKey = matchSignedBy(signedBy, contacts);
        setInitial({
          ...splitFullName(p.fullName || ""),
          birthDate: isoDate(p.birthDate),
          gender: p.gender || "",
          grade: p.grade || "",
          school: p.school || "",
          enrolledAt: isoDate(p.enrolledAt),
          status: p.status,
          diagnosis: p.diagnosis || "",
          pmpkDate: isoDate(p.pmpkDate),
          pmpkNextAt: isoDate(p.pmpkNextAt),
          pmpkNumber: p.pmpkNumber || "",
          aopVariant: p.aopVariant || "",
          pmpkMode: "text",
          tagIds: (p.tags || []).map((t: { id: string }) => t.id),
          contacts,
          consent: {
            given: !!p.consent?.given,
            givenAt: isoDate(p.consent?.givenAt),
            signedByKey,
            signedByLegacy: signedByKey ? "" : signedBy,
          },
        });
      })
      .catch((e: Error) => setError(e.message));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!initial) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  return (
    <div>
      <PageHeader title={`${title} — редактирование`} crumbs={[{ href: "/pupils", label: "Ученики" }, { href: `/pupils/${id}`, label: title }, { label: "Редактирование" }]} />
      <PupilForm pupilId={id} initial={initial} />
    </div>
  );
}
