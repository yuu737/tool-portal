import { NextRequest, NextResponse } from "next/server";

export const locales = ["ja", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ja";

function getLocale(request: NextRequest): Locale {
  // Cookie が設定済みならそれを優先
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }

  // Accept-Language ヘッダーから言語を判定
  const acceptLang = request.headers.get("accept-language") ?? "";
  const preferred = acceptLang.split(",")[0].split("-")[0].toLowerCase().trim();
  return preferred === "ja" ? "ja" : "en";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // すでにロケールプレフィックスがある場合はスルー
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );
  if (pathnameHasLocale) return NextResponse.next();

  // ロケールプレフィックスを付けてリダイレクト
  const locale = getLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname}`;

  const response = NextResponse.redirect(url);
  // Cookie にも保存（次回アクセス時に利用）
  response.cookies.set("NEXT_LOCALE", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 年
    sameSite: "lax",
  });
  return response;
}

export const config = {
  // _next, api, favicon, 静的ファイルを除くすべてのパスに適用
  matcher: ["/((?!_next|api|favicon\\.ico|.*\\..*).*)"],
};
