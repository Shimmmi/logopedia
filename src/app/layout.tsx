import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { A11Y_BOOTSTRAP } from "@/lib/a11y";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "LogoPed — кабинет учителя-логопеда",
    template: "%s — LogoPed",
  },
  description:
    "Картотека учеников, расписание, документы и генерация рабочей документации. Хранение по 152-ФЗ.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "LogoPed" },
  openGraph: {
    title: "LogoPed — кабинет учителя-логопеда",
    description: "Картотека, расписание и документы логопеда в одном кабинете.",
    url: "https://logoped.site",
    siteName: "LogoPed",
    locale: "ru_RU",
    type: "website",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: A11Y_BOOTSTRAP }} />
      </head>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
