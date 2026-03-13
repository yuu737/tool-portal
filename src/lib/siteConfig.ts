/** サイト固有の定数とSEOヘルパー */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://toolbox-yuu.vercel.app";

/**
 * hreflang タグ用 alternates オブジェクトを生成する。
 * @param path - ロケールを除いたパス (例: "/tools/word-count")
 */
export function getAlternates(path: string = "") {
  return {
    canonical: `${SITE_URL}/ja${path}`,
    languages: {
      ja: `${SITE_URL}/ja${path}`,
      en: `${SITE_URL}/en${path}`,
      "x-default": `${SITE_URL}/ja${path}`,
    },
  };
}
