import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdSenseWrapper from "@/components/AdSenseWrapper";
import { getDictionary, type Locale } from "@/lib/getDictionary";
import { getAlternates } from "@/lib/siteConfig";

const supportedLocales: Locale[] = ["ja", "en"];

export function generateStaticParams() {
  return supportedLocales.map((lang) => ({ lang }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  if (lang === "en") {
    return {
      title: { default: "Yuustudio | Free Web Tools", template: "%s | Yuustudio" },
      description:
        "Word counters, password generators, QR code creators and more — free web tools for everyday use.",
      keywords: ["web tools", "free tools", "word counter", "password generator", "QR code"],
      alternates: getAlternates(),
      openGraph: {
        type: "website",
        locale: "en_US",
        siteName: "Yuustudio",
        title: "Yuustudio | Free Web Tools",
        description: "Word counters, password generators, QR code creators and more — free.",
      },
      twitter: {
        card: "summary_large_image",
        title: "Yuustudio | Free Web Tools",
        description: "Word counters, password generators, QR code creators and more — free.",
      },
    };
  }
  return {
    title: { default: "Yuustudio | 便利なWebツール集", template: "%s | Yuustudio" },
    description:
      "文字数カウント、パスワード生成、QRコード作成など、日常で役立つ便利なWebツールを無料で提供するポータルサイトです。",
    keywords: ["Webツール", "無料ツール", "文字数カウント", "パスワード生成", "QRコード"],
    alternates: getAlternates(),
    openGraph: {
      type: "website",
      locale: "ja_JP",
      siteName: "Yuustudio",
      title: "Yuustudio | 便利なWebツール集",
      description: "文字数カウント、パスワード生成、QRコード作成など、日常で役立つ便利なWebツールを無料で提供。",
    },
    twitter: {
      card: "summary_large_image",
      title: "Yuustudio | 便利なWebツール集",
      description:
        "文字数カウント、パスワード生成、QRコード作成など、日常で役立つ便利なWebツールを無料で提供。",
    },
  };
}

export default async function LangLayout({ children, params }: Props) {
  const { lang } = await params;
  if (!supportedLocales.includes(lang as Locale)) {
    notFound();
  }
  const locale = lang as Locale;
  const dict = await getDictionary(locale);

  return (
    <>
      <Header lang={locale} dict={dict.header} />

      {/* ヘッダー下の広告枠 */}
      <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
        <AdSenseWrapper slot="header-banner" className="h-[90px]" />
      </div>

      {/* メインコンテンツ */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>

      {/* コンテンツ下の広告枠 */}
      <div className="mx-auto w-full max-w-6xl px-4 pb-4 sm:px-6">
        <AdSenseWrapper slot="footer-banner" className="h-[90px]" />
      </div>

      <Footer lang={locale} dict={dict.footer} />
    </>
  );
}
