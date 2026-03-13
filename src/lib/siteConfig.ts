import type { Category } from "./tools";

/** サイト固有の定数とSEOヘルパー */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://yuustudio.app";

/**
 * hreflang タグ用 alternates オブジェクトを生成する。
 * @param path   - ロケールを除いたパス (例: "/tools/word-count")
 * @param locale - 現在のロケール。canonical URL に使用 (デフォルト: "ja")
 */
export function getAlternates(path: string = "", locale: string = "ja") {
  return {
    canonical: `${SITE_URL}/${locale}${path}`,
    languages: {
      ja: `${SITE_URL}/ja${path}`,
      en: `${SITE_URL}/en${path}`,
      "x-default": `${SITE_URL}/ja${path}`,
    },
  };
}

/** カテゴリ → Lucide アイコン名 */
export const CATEGORY_ICONS: Record<Category, string> = {
  GAMING_STATS: "Gamepad2",
  TEXT_PROCESS: "FileText",
  DEV_SYSTEM: "Code",
  LIFE_UTILITY: "CalendarClock",
};
