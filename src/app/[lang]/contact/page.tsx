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
    title: dict.contact.title,
    description: dict.contact.description,
  };
}

export default async function ContactPage({ params }: Props) {
  const { lang } = await params;
  if (!supportedLocales.includes(lang as Locale)) {
    notFound();
  }
  const locale = lang as Locale;
  const dict = await getDictionary(locale);
  const t = dict.contact;

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
            ✉️
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {t.title}
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-gray-500 sm:text-base">{t.description}</p>
      </header>

      {/* メールアドレスカード */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <p className="mb-2 text-xs font-medium uppercase tracking-widest text-gray-400">
          {t.emailLabel}
        </p>
        <a
          href="mailto:yuu386182@gmail.com"
          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:bg-blue-800"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
          yuu386182@gmail.com
        </a>
      </div>

      {/* お問い合わせ受付内容 */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-gray-900 sm:text-lg">
          {t.inquiryTypesHeading}
        </h2>
        <ul className="space-y-2">
          {t.inquiryTypes.map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-gray-600 sm:text-base">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-600 font-bold">
                ✓
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* 注意書き */}
      <div className="rounded-2xl border border-yellow-100 bg-yellow-50 p-5">
        <p className="text-sm leading-relaxed text-yellow-800">{t.note}</p>
      </div>
    </div>
  );
}
