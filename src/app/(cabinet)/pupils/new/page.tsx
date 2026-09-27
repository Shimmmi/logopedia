import { PageHeader } from "@/components/page-header";
import { PupilForm } from "@/components/pupil-form";

export default function NewPupilPage() {
  return (
    <div>
      <PageHeader title="Новый ученик" crumbs={[{ href: "/pupils", label: "Ученики" }, { label: "Новый" }]} />
      <PupilForm />
    </div>
  );
}
