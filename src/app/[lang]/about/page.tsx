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
    title: dict.about.title,
    description: dict.about.description,
  };
}

const techStack = [
  { name: "Next.js", color: "bg-gray-900 text-white" },
  { name: "React", color: "bg-blue-500 text-white" },
  { name: "TypeScript", color: "bg-blue-700 text-white" },
  { name: "Tailwind CSS", color: "bg-cyan-500 text-white" },
  { name: "Vercel", color: "bg-black text-white" },
];

export default async function AboutPage({ params }: Props) {
  const { lang } = await params;
  if (!supportedLocales.includes(lang as Locale)) {
    notFound();
  }
  const locale = lang as Locale;
  const dict = await getDictionary(locale);
  const t = dict.about;

  const sections = [
    { icon: "👤", data: t.profile },
    { icon: "🎯", data: t.mission },
    { icon: "🔒", data: t.safety },
    { icon: "🌐", data: t.i18n },
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
            🙋
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {t.title}
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-gray-500 sm:text-base">{t.description}</p>
      </header>

      {/* 運営者カード */}
      <div className="flex items-center gap-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-3xl font-bold text-white">
          y
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-gray-400">
            {t.operatorLabel}
          </p>
          <p className="mt-0.5 text-xl font-bold text-gray-900">{t.operatorName}</p>
        </div>
      </div>

      {/* セクション一覧 */}
      <div className="space-y-4">
        {sections.map(({ icon, data }) => (
          <section
            key={data.heading}
            className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
          >
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-gray-900 sm:text-lg">
              <span>{icon}</span>
              {data.heading}
            </h2>
            <p className="text-sm leading-relaxed text-gray-600 sm:text-base">{data.text}</p>
          </section>
        ))}
      </div>

      {/* 使用技術 */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900 sm:text-lg">
          <span>⚙️</span>
          {t.techStack.heading}
        </h2>
        <div className="flex flex-wrap gap-2">
          {techStack.map((tech) => (
            <span
              key={tech.name}
              className={`${tech.color} rounded-full px-3 py-1 text-xs font-semibold`}
            >
              {tech.name}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
