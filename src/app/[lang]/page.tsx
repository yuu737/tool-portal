import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import ToolCard from "@/components/ToolCard";
import AdSenseWrapper from "@/components/AdSenseWrapper";
import { getDictionary, type Locale } from "@/lib/getDictionary";
import { getAlternates } from "@/lib/siteConfig";
import { tools } from "@/lib/tools";

const supportedLocales: Locale[] = ["ja", "en"];

type Props = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = lang === "ja" ? "ja" : "en";
  return {
    alternates: getAlternates(""),
    ...(locale === "ja"
      ? {
          title: "ToolBox | 便利なWebツール集",
          description:
            "文字数カウント、パスワード生成、QRコード作成など、日常で役立つ便利なWebツールを無料で提供するポータルサイトです。",
          keywords: ["Webツール", "無料ツール", "文字数カウント", "パスワード生成", "QRコード生成"],
        }
      : {
          title: "ToolBox | Free Web Tools",
          description:
            "Word counters, password generators, QR code creators and more — free web tools for everyday use.",
          keywords: ["web tools", "free tools", "word counter", "password generator", "QR code generator"],
        }),
  };
}

export default async function Home({ params }: Props) {
  const { lang } = await params;
  if (!supportedLocales.includes(lang as Locale)) {
    notFound();
  }
  const locale = lang as Locale;
  const dict = await getDictionary(locale);

  const localizedTools = tools.map((tool) => ({
    ...tool,
    name: dict.tools[tool.id]?.name ?? tool.id,
    description: dict.tools[tool.id]?.description ?? "",
    href: `/${locale}${tool.href}`,
  }));

  return (
    <>
      {/* ヒーロー */}
      <section className="pb-10 pt-4 text-center">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          {dict.hero.heading}
          <span className="text-blue-600">{dict.hero.headingHighlight}</span>
          {dict.hero.headingSuffix}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-gray-500 sm:text-lg">
          {dict.hero.description.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              {i === 0 && <br className="hidden sm:inline" />}
            </span>
          ))}
        </p>
        <div className="mt-6">
          <Link
            href={`/${locale}/tools`}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
          >
            {dict.hero.cta}
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* ツール一覧グリッド */}
      <section>
        <h2 className="mb-6 text-xl font-bold text-gray-800">{dict.toolsSection.heading}</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {localizedTools.map((tool) => (
            <ToolCard key={tool.id} tool={tool} cta={dict.toolCard.cta} />
          ))}
        </div>
      </section>

      {/* グリッド下の広告枠 */}
      <div className="mt-10">
        <AdSenseWrapper slot="content-bottom" className="h-[250px]" />
      </div>
    </>
  );
}
