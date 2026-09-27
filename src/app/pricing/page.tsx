import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Тарифы" };

const PLANS = [
  {
    name: "Бесплатный",
    price: "0 ₽",
    items: ["Картотека и расписание", "500 МБ документов", "10 черновиков в месяц", "10 листов A4 в месяц"],
    cta: "Начать бесплатно",
    href: "/register",
    highlight: true,
  },
  {
    name: "Профессиональный",
    price: "990 ₽/мес",
    items: ["5 ГБ", "80 черновиков в месяц", "20 анализов, аудио до 15 мин", "60 листов A4 в месяц"],
    cta: "Выбрать",
    href: "/register",
    highlight: false,
  },
  {
    name: "Премиум",
    price: "2 490 ₽/мес",
    items: ["25 ГБ", "Безлимитные черновики, анализ и картинки", "Продвинутая модель"],
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
          Начните бесплатно. Оплата подключается позже через российскую платёжную систему.
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
