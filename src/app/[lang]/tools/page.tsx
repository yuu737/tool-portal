import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdSenseWrapper from "@/components/AdSenseWrapper";
import ToolsExplorer from "@/components/ToolsExplorer";
import { getDictionary, type Locale } from "@/lib/getDictionary";
import { getAlternates } from "@/lib/siteConfig";
import { tools, CATEGORIES } from "@/lib/tools";

const supportedLocales: Locale[] = ["ja", "en"];

type Props = {
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = lang === "ja" ? "ja" : "en";

  const title =
    locale === "ja" ? "ツール一覧 – 無料Webツール集" : "All Tools – Free Web Tools";
  const description =
    locale === "ja"
      ? "文字数カウント・パスワード生成・QRコード・PDF変換など、すべて無料・ブラウザ完結の便利なWebツール一覧です。"
      : "Browse all free web tools: word counter, password generator, QR code, PDF converter, JSON formatter, unit converter, and Base64 encoder.";

  return {
    title,
    description,
    alternates: getAlternates("/tools", locale),
    openGraph: { title, description, type: "website" },
  };
}

export default async function ToolsPage({ params }: Props) {
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
    tags: tool.tags.map((key) => dict.toolsSection.tags[key] ?? key),
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
          {dict.toolsSection.heading}
        </h1>
        <p className="text-sm text-gray-500 sm:text-base">
          {dict.toolsSection.description}
        </p>
      </header>

      <Suspense>
        <ToolsExplorer
          tools={localizedTools}
          dict={dict.toolsSection}
          cta={dict.toolCard.cta}
          categories={CATEGORIES}
        />
      </Suspense>

      <AdSenseWrapper slot="tools-list-bottom" className="h-[250px]" />
    </div>
  );
}
