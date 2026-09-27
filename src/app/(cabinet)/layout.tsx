import { redirect } from "next/navigation";
import { readSession } from "@/server/auth";
import { getLimits } from "@/server/limits";
import { CabinetShell } from "@/components/cabinet-shell";

export default async function CabinetLayout({ children }: { children: React.ReactNode }) {
  const user = await readSession();
  if (!user) redirect("/login");
  const limits = await getLimits(user.id);
  return (
    <CabinetShell
      user={{
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        plan: limits.plan,
        timezone: user.timezone,
        onboardingDone: user.onboardingDone,
        mustChangePassword: user.mustChangePassword,
        a11yLargeText: user.a11yLargeText,
        a11yHighContrast: user.a11yHighContrast,
        a11yReduceMotion: user.a11yReduceMotion,
      }}
    >
      {children}
    </CabinetShell>
  );
}
