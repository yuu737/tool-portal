import Image from "next/image";
import Link from "next/link";
import type { Locale, Dictionary } from "@/lib/getDictionary";

type Props = {
  lang: Locale;
  dict: Dictionary["footer"];
};

export default function Footer({ lang, dict }: Props) {
  return (
    <footer className="border-t border-gray-200 bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          {/* ロゴ・コピーライト */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Image src="/logo.png" alt="Yuustudio Logo" width={24} height={24} className="rounded object-contain" />
            <span>&copy; {new Date().getFullYear()} Yuustudio. All rights reserved.</span>
          </div>

          {/* リンク */}
          <nav className="flex flex-wrap justify-center gap-6 text-sm text-gray-500">
            <Link href={`/${lang}`} className="transition-colors hover:text-blue-600">
              {dict.home}
            </Link>
            <Link href={`/${lang}/about`} className="transition-colors hover:text-blue-600">
              {dict.about}
            </Link>
            <Link href={`/${lang}/privacy`} className="transition-colors hover:text-blue-600">
              {dict.privacy}
            </Link>
            <Link href={`/${lang}/contact`} className="transition-colors hover:text-blue-600">
              {dict.contact}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
