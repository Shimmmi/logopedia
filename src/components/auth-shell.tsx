import { Logo } from "@/components/logo";

export function AuthShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="mb-6">
        <Logo />
      </div>
      <div className="w-full max-w-[440px] rounded-xl border border-border bg-card p-6 shadow-sm">
        <h1 className="text-h1">{title}</h1>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
