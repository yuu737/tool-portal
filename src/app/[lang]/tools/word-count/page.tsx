import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import AdSenseWrapper from "@/components/AdSenseWrapper";
import WordCountTool from "@/components/tools/WordCountTool";
import ToolContentSection from "@/components/ToolContentSection";
import { getDictionary, type Locale } from "@/lib/getDictionary";
import { getAlternates } from "@/lib/siteConfig";

const supportedLocales: Locale[] = ["ja", "en"];

type Props = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = lang === "ja" ? "ja" : "en";
  const dict = await getDictionary(locale);
  return {
    title: dict.wordCount.meta.title,
    description: dict.wordCount.meta.description,
    keywords: dict.wordCount.meta.keywords,
    alternates: getAlternates("/tools/word-count"),
  };
}

export default async function WordCountPage({ params }: Props) {
  const { lang } = await params;
  if (!supportedLocales.includes(lang as Locale)) {
    notFound();
  }
  const locale = lang as Locale;
  const dict = await getDictionary(locale);
  const t = dict.wordCount;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* パンくずリスト */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={`/${locale}`} className="transition-colors hover:text-blue-600">
          {dict.header.home}
        </Link>
        <span>/</span>
        <Link href={`/${locale}/tools`} className="transition-colors hover:text-blue-600">
          {dict.header.tools}
        </Link>
        <span>/</span>
        <span className="text-gray-600">{t.title}</span>
      </nav>

      {/* ページヘッダー */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-2xl">
            📝
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {t.title}
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-gray-500 sm:text-base">{t.description}</p>
      </header>

      {/* ツール本体 */}
      <WordCountTool dict={t} locale={locale} />

      {/* 広告枠 */}
      <AdSenseWrapper slot="word-count-bottom" className="h-[250px]" />

      {/* 解説セクション */}
      <ToolContentSection content={t.content} />
    </div>
  );
}
