import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Тарифы" };

const PLANS = [
  {
    name: "Бесплатный",
    price: "0 ₽",
    items: ["Картотека и расписание", "500 МБ документов", "1 текстовый черновик, 1 анализ, 2 листа A4", "Потолок ИИ 40 ₽ в месяц"],
    cta: "Начать бесплатно",
    href: "/register",
    highlight: true,
  },
  {
    name: "Профессиональный",
    price: "990 ₽/мес",
    items: ["5 ГБ", "20 текстов, 10 анализов, 20 листов A4", "Потолок ИИ 500 ₽ в месяц", "Аудио до 15 мин"],
    cta: "Выбрать",
    href: "/register",
    highlight: false,
  },
  {
    name: "Премиум",
    price: "2 490 ₽/мес",
    items: ["25 ГБ", "70 текстов, 20 анализов, 40 листов A4", "Потолок ИИ 1 600 ₽ в месяц", "Выбор моделей, отмеченных для тарифа"],
    cta: "Выбрать",
    href: "/register",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="content-wrap px-4 py-16 md:px-6">
        <h1 className="text-h1">Тарифы</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          Считаются и число запросов, и рубли за месяц. Срабатывает тот лимит, который наступил раньше. Снимок цен — 27 сентября 2026.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PLANS.map((p) => (
            <div key={p.name} className={`rounded-xl border bg-card p-6 ${p.highlight ? "border-primary" : "border-border"}`}>
              <h2 className="text-h3">{p.name}</h2>
              <div className="mt-2 text-3xl font-semibold">{p.price}</div>
              <ul className="mt-4 space-y-2 text-small text-muted-foreground">
                {p.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <Button asChild className="mt-6 w-full" variant={p.highlight ? "default" : "outline"}>
                <Link href={p.href}>{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
