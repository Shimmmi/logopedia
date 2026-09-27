import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="text-h1">Страница не найдена</h1>
      <p className="text-muted-foreground">Проверьте адрес или вернитесь на главную.</p>
      <Button asChild>
        <Link href="/">На главную</Link>
      </Button>
    </div>
  );
}
