import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getDictionary, type Locale } from "@/lib/getDictionary";

const supportedLocales: Locale[] = ["ja", "en"];

type Props = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = lang === "ja" ? "ja" : "en";
  const dict = await getDictionary(locale);
  return {
    title: dict.privacy.title,
    description: dict.privacy.description,
  };
}

export default async function PrivacyPage({ params }: Props) {
  const { lang } = await params;
  if (!supportedLocales.includes(lang as Locale)) {
    notFound();
  }
  const locale = lang as Locale;
  const dict = await getDictionary(locale);
  const t = dict.privacy;

  const sections = [
    { id: "basic", data: t.sections.basic },
    { id: "adsense", data: t.sections.adsense },
    { id: "analytics", data: t.sections.analytics },
    { id: "personalInfo", data: t.sections.personalInfo },
    { id: "cookies", data: t.sections.cookies },
    { id: "disclaimer", data: t.sections.disclaimer },
    { id: "changes", data: t.sections.changes },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-10">
      {/* パンくずリスト */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={`/${locale}`} className="transition-colors hover:text-blue-600">
          {dict.header.home}
        </Link>
        <span>/</span>
        <span className="text-gray-600">{t.title}</span>
      </nav>

      {/* ページヘッダー */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-2xl">
            📄
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {t.title}
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-gray-500 sm:text-base">{t.description}</p>
        <p className="text-xs text-gray-400">
          {t.lastUpdated}: {t.lastUpdatedDate}
        </p>
      </header>

      {/* セクション一覧 */}
      <div className="space-y-1 rounded-2xl border border-gray-100 bg-white shadow-sm">
        {sections.map(({ id, data }, index) => (
          <section
            key={id}
            className={`p-6 ${index !== sections.length - 1 ? "border-b border-gray-100" : ""}`}
          >
            <h2 className="mb-3 text-base font-bold text-gray-900 sm:text-lg">{data.heading}</h2>
            <p className="text-sm leading-relaxed text-gray-600 sm:text-base">{data.text}</p>
          </section>
        ))}
      </div>

      {/* 問い合わせへの誘導 */}
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
        <p className="text-sm text-blue-800">
          {locale === "ja"
            ? "プライバシーポリシーに関するお問い合わせは、"
            : "For inquiries about this privacy policy, please "}
          <Link href={`/${locale}/contact`} className="font-semibold underline hover:text-blue-600">
            {locale === "ja" ? "お問い合わせページ" : "contact us"}
          </Link>
          {locale === "ja" ? "からご連絡ください。" : "."}
        </p>
      </div>
    </div>
  );
}
