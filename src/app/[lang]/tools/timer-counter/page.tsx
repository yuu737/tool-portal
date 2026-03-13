import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import AdSenseWrapper from "@/components/AdSenseWrapper";
import TimerCounterTool from "@/components/tools/TimerCounterTool";
import ToolContentSection from "@/components/ToolContentSection";
import { getDictionary, type Locale } from "@/lib/getDictionary";
import { getAlternates } from "@/lib/siteConfig";
import { Timer } from "lucide-react";

const supportedLocales: Locale[] = ["ja", "en"];

type Props = { params: Promise<{ lang: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = lang === "ja" ? "ja" : "en";
  const dict = await getDictionary(locale);
  return {
    title: dict.timerCounter.meta.title,
    description: dict.timerCounter.meta.description,
    keywords: dict.timerCounter.meta.keywords,
    alternates: getAlternates("/tools/timer-counter"),
  };
}

export default async function TimerCounterPage({ params }: Props) {
  const { lang } = await params;
  if (!supportedLocales.includes(lang as Locale)) notFound();
  const locale = lang as Locale;
  const dict = await getDictionary(locale);
  const t = dict.timerCounter;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={`/${locale}`}>{dict.header.home}</Link>
        <span>/</span>
        <Link href={`/${locale}/tools`}>{dict.header.tools}</Link>
        <span>/</span>
        <span className="text-gray-600">{t.title}</span>
      </nav>

      {/* Page Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Timer size={22} strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {t.title}
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-gray-500 sm:text-base">{t.description}</p>
      </header>

      {/* Tool */}
      <TimerCounterTool dict={t} locale={locale} />

      {/* AdSense */}
      <AdSenseWrapper slot="timer-counter-bottom" className="h-[250px]" />

      {/* SEO Content */}
      <ToolContentSection content={t.content} />
    </div>
  );
}
