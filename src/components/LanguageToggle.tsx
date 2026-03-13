"use client";

import { usePathname, useRouter } from "next/navigation";
import type { Locale } from "@/lib/getDictionary";

type Props = {
  lang: Locale;
};

export default function LanguageToggle({ lang }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  const switchTo = (newLang: Locale) => {
    if (newLang === lang) return;

    // /ja/... または /en/... のプレフィックスを置換
    const newPath = pathname.replace(/^\/(ja|en)/, `/${newLang}`);

    // Cookie を更新して次回アクセス時にも反映
    document.cookie = `NEXT_LOCALE=${newLang};path=/;max-age=${60 * 60 * 24 * 365};SameSite=Lax`;

    router.push(newPath);
  };

  return (
    <div
      className="flex items-center rounded-full border border-gray-200 bg-gray-50 p-0.5 text-xs font-semibold"
      aria-label="言語切替 / Language toggle"
    >
      <button
        onClick={() => switchTo("ja")}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          lang === "ja"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-gray-500 hover:text-gray-800"
        }`}
        aria-current={lang === "ja" ? "true" : undefined}
      >
        JP
      </button>
      <button
        onClick={() => switchTo("en")}
        className={`rounded-full px-2.5 py-1 transition-colors ${
          lang === "en"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-gray-500 hover:text-gray-800"
        }`}
        aria-current={lang === "en" ? "true" : undefined}
      >
        EN
      </button>
    </div>
  );
}
