import Link from "next/link";
import type { Locale, Dictionary } from "@/lib/getDictionary";
import LanguageToggle from "@/components/LanguageToggle";

type Props = {
  lang: Locale;
  dict: Dictionary["header"];
};

export default function Header({ lang, dict }: Props) {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* ロゴ */}
        <Link href={`/${lang}`} className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-lg font-bold text-white">
            T
          </div>
          <span className="text-xl font-bold text-gray-900">ToolBox</span>
        </Link>

        {/* ナビゲーション + 言語切替 */}
        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="flex items-center gap-4 sm:gap-6">
            <Link
              href={`/${lang}`}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600"
            >
              {dict.home}
            </Link>
            <Link
              href={`/${lang}/tools`}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-blue-600"
            >
              {dict.tools}
            </Link>
          </nav>

          {/* JP / EN トグル */}
          <LanguageToggle lang={lang} />
        </div>
      </div>
    </header>
  );
}
