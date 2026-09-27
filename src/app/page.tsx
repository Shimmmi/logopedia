import Link from "next/link";
import { FolderOpen, CalendarDays, Users, Sparkles, ShieldCheck, Clock, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { readSession } from "@/server/auth";
import { prisma } from "@/server/db";
import { expandEvent } from "@/server/schedule";
import { formatDateTime } from "@/lib/format";

const SCENARIOS = [
  { icon: Users, title: "Картотека", text: "Карточки учеников, теги, согласия родителей и динамика по направлениям." },
  { icon: CalendarDays, title: "Расписание", text: "День, неделя и месяц. Повторы, отпуска и отчёты посещаемости." },
  { icon: FolderOpen, title: "Документы", text: "Папки, версии, корзина и поиск по содержимому файлов." },
  { icon: Sparkles, title: "Рабочая документация", text: "Черновики диагностики, программы, заключения и заданий с проверкой специалиста." },
];

const FAQ = [
  {
    q: "Где хранятся данные?",
    a: "На серверах в Российской Федерации. Диагнозы шифруются. Вы можете выгрузить или удалить данные из кабинета.",
  },
  {
    q: "Что уходит в сервис генерации текстов?",
    a: "Только обезличенный фрагмент, нужный для черновика. ФИО и контакты ребёнка в запрос не включаются.",
  },
  {
    q: "Нужно ли согласие родителей?",
    a: "Да. Обработка данных ребёнка допустима при согласии законного представителя, которое хранится в карточке.",
  },
  {
    q: "Можно ли начать бесплатно?",
    a: "Да. Бесплатный тариф включает картотеку, расписание и базовые лимиты документов.",
  },
  {
    q: "Подходит ли сервис для планшета?",
    a: "Да. Кабинет рассчитан на ноутбук и планшет: крупные кнопки, карточки вместо узких таблиц, меню в шапке.",
  },
  {
    q: "Заменяет ли генерация заключение ПМПК?",
    a: "Нет. Это черновик для специалиста. Юридическую силу имеет только документ, который вы проверили и подписали.",
  },
];

export default async function HomePage() {
  const user = await readSession();
  const member = user ? await memberSnapshot(user.id, user.timezone || "Europe/Moscow") : null;
  return (
    <div className="min-h-screen">
      <SiteHeader user={user ? { name: user.name } : null} />
      <main>
        {member ? (
          <MemberHome name={user!.name} snapshot={member} />
        ) : (
        <section className="content-wrap grid items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-6 md:py-20">
          <div>
            <h1 className="text-display text-balance">Картотека, расписание и документы логопеда — в одном кабинете</h1>
            <p className="mt-4 max-w-xl text-lg text-muted-foreground">
              Меньше времени на отчётность, спокойное хранение данных по 152-ФЗ и черновики документов, которые вы проверяете сами.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/register">Создать кабинет</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="#how">Как это работает</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <p className="text-caption text-muted-foreground">Пример интерфейса</p>
            <div className="mt-3 rounded-lg bg-accent p-4">
              <div className="text-small text-primary">Пример: Иванова Мария, 2 класс</div>
              <div className="mt-1 text-lg font-medium">Индивидуальное · постановка [Р]</div>
              <div className="text-small text-muted-foreground">Сегодня, 10:00 — запланировано</div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-small">
              <div className="rounded-lg bg-secondary p-3">
                <div className="font-medium">Согласие ОПД</div>
                <div className="text-muted-foreground">прикреплено</div>
              </div>
              <div className="rounded-lg bg-secondary p-3">
                <div className="font-medium">ПМПК</div>
                <div className="text-muted-foreground">пересмотр в мае</div>
              </div>
            </div>
          </div>
        </section>
        )}

        {!member && (
        <section className="content-wrap grid gap-4 px-4 pb-16 md:grid-cols-2 md:px-6 lg:grid-cols-4">
          {SCENARIOS.map((s) => (
            <div key={s.title} className="rounded-xl border border-border bg-card p-5">
              <s.icon className="h-5 w-5 text-primary" strokeWidth={1.75} />
              <h2 className="mt-3 text-h3">{s.title}</h2>
              <p className="mt-2 text-small text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </section>
        )}

        {!member && (
        <section id="how" className="bg-card">
          <div className="content-wrap grid gap-6 px-4 py-16 md:grid-cols-3 md:px-6">
            {[
              { n: "1", t: "Создайте кабинет", d: "Подтвердите почту и добавьте первого ученика." },
              { n: "2", t: "Ведите работу", d: "Ставьте занятия, храните файлы и согласия." },
              { n: "3", t: "Готовьте документы", d: "Соберите черновик и проверьте его перед печатью." },
            ].map((s) => (
              <div key={s.n} className="rounded-xl border border-border p-5">
                <div className="text-caption text-primary">Шаг {s.n}</div>
                <h2 className="mt-2 text-h2">{s.t}</h2>
                <p className="mt-2 text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>
        )}

        <section id="security" className="content-wrap px-4 py-16 md:px-6">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-h1">Безопасность данных</h2>
              <p className="mt-3 max-w-xl text-muted-foreground">
                Вы остаётесь оператором персональных данных детей. Сервис обрабатывает их по вашему поручению.
              </p>
            </div>
            <ul className="space-y-3 text-small">
              <li className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" /> Серверы в РФ, шифрование заключений.
              </li>
              <li className="flex gap-2">
                <Clock className="mt-0.5 h-5 w-5 text-primary" /> Выгрузка и удаление данных из кабинета.
              </li>
              <li className="flex gap-2">
                <Sparkles className="mt-0.5 h-5 w-5 text-primary" /> В генерацию уходит обезличенный текст без ФИО ребёнка.
              </li>
            </ul>
          </div>
        </section>

        <section className="content-wrap px-4 pb-20 md:px-6">
          <h2 className="text-h1">Вопросы</h2>
          <Accordion type="single" collapsible className="mt-6 divide-y divide-border">
            {FAQ.filter((f) => !member || f.q !== "Можно ли начать бесплатно?").map((f, i) => (
              <AccordionItem key={f.q} value={`q${i}`}>
                <AccordionTrigger>{f.q}</AccordionTrigger>
                <AccordionContent>{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

type Snapshot = {
  pupils: { id: string; fullName: string; grade: string | null }[];
  next: { title: string; when: string } | null;
};

async function memberSnapshot(userId: string, tz: string): Promise<Snapshot> {
  const now = new Date();
  const [pupils, events] = await Promise.all([
    prisma.pupil.findMany({
      where: { userId, status: { not: "ARCHIVE" } },
      orderBy: { updatedAt: "desc" },
      take: 4,
      select: { id: true, fullName: true, grade: true },
    }),
    prisma.scheduleEvent.findMany({
      where: { userId },
      include: { exceptions: true },
      take: 40,
    }),
  ]);
  const next = events
    .flatMap((event) => expandEvent(event, now, new Date(now.getTime() + 7 * 86400000)))
    .filter((item) => item.status === "SCHEDULED")
    .sort((a, b) => a.start.getTime() - b.start.getTime())[0];
  return {
    pupils,
    next: next ? { title: next.title, when: formatDateTime(next.start, tz) } : null,
  };
}

function MemberHome({ name, snapshot }: { name: string; snapshot: Snapshot }) {
  const first = name.split(" ")[0] || name;
  return (
    <section className="content-wrap px-4 py-16 md:px-6 md:py-20">
      <p className="text-caption text-primary">Вы вошли</p>
      <h1 className="mt-2 text-display text-balance">Здравствуйте, {first}</h1>
      <p className="mt-4 max-w-xl text-lg text-muted-foreground">
        {snapshot.next ? `Ближайшее занятие: ${snapshot.next.title}, ${snapshot.next.when}.` : "На ближайшую неделю занятий не стоит."}
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/dashboard">Кабинет</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/ai?tab=pictures">Лист с заданиями</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/library">Библиотека</Link>
        </Button>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        <Link href="/schedule" className="rounded-xl border border-border bg-card p-5">
          <CalendarDays className="h-5 w-5 text-primary" />
          <h2 className="mt-3 text-h3">Расписание</h2>
          <p className="mt-2 text-small text-muted-foreground">{snapshot.next ? snapshot.next.when : "Открыть неделю"}</p>
        </Link>
        <Link href="/pupils" className="rounded-xl border border-border bg-card p-5">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="mt-3 text-h3">Ученики</h2>
          <p className="mt-2 text-small text-muted-foreground">
            {snapshot.pupils.length ? snapshot.pupils.map((p) => p.fullName).join(", ") : "Добавьте первого ученика"}
          </p>
        </Link>
        <Link href="/library" className="rounded-xl border border-border bg-card p-5">
          <BookOpen className="h-5 w-5 text-primary" />
          <h2 className="mt-3 text-h3">Наработки</h2>
          <p className="mt-2 text-small text-muted-foreground">Листы, черновики и методические карточки</p>
        </Link>
      </div>
    </section>
  );
}
