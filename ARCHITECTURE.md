# Yuustudio Tool Portal - Architecture & Development Guide

> **対象読者**: 他のAIエージェント、新規開発者、外部コントリビューター
> **最終更新**: 2026-03

---

## 1. プロジェクト概要

| 項目 | 値 |
|---|---|
| サイト名 | **Yuustudio** (https://yuustudio.app) |
| 目的 | 無料のブラウザ完結型Webツールポータル |
| フレームワーク | Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 |
| デプロイ形式 | **静的HTMLエクスポート** (`output: "export"`) — サーバーランタイムなし |
| 対応言語 | 日本語 (`ja`) / 英語 (`en`) — URL パスベース i18n |
| デザインテーマ | ライトモードのみ。アクセントカラーは `blue-600` |

---

## 2. ディレクトリ構成

```
tool-portal/
├── public/                       # 静的アセット (favicon, SVG アイコン)
├── src/
│   ├── app/
│   │   ├── globals.css           # Tailwind v4 インポート + CSS変数定義
│   │   ├── layout.tsx            # ルートレイアウト (フォント定義)
│   │   ├── page.tsx              # / → /ja へリダイレクト
│   │   ├── sitemap.ts            # 全ページのサイトマップ生成
│   │   └── [lang]/               # ★ i18n ルーティングの起点
│   │       ├── layout.tsx        # Header / Footer / AdSense 配置
│   │       ├── page.tsx          # ホームページ (ヒーロー + ツール一覧)
│   │       ├── about/page.tsx    # 運営者情報ページ
│   │       ├── contact/page.tsx  # お問い合わせページ
│   │       ├── privacy/page.tsx  # プライバシーポリシーページ
│   │       └── tools/
│   │           ├── page.tsx      # ツール一覧 (検索・フィルター付き)
│   │           ├── word-count/page.tsx
│   │           ├── password-generator/page.tsx
│   │           ├── qr-code/page.tsx
│   │           ├── images-to-pdf/page.tsx
│   │           ├── json-formatter/page.tsx
│   │           ├── unit-converter/page.tsx
│   │           ├── base64/page.tsx
│   │           ├── timer-counter/page.tsx
│   │           └── grinding-companion/page.tsx
│   ├── components/
│   │   ├── Header.tsx            # サーバーコンポーネント: ロゴ + ナビ + 言語切替
│   │   ├── Footer.tsx            # サーバーコンポーネント: コピーライト + リンク
│   │   ├── LanguageToggle.tsx    # クライアントコンポーネント: JP/EN 切替ボタン
│   │   ├── AdSenseWrapper.tsx    # 広告枠プレースホルダー (環境変数で制御)
│   │   ├── ToolCard.tsx          # ツールカードUI (アイコン・タイトル・説明・CTA)
│   │   ├── ToolContentSection.tsx# SEOコンテンツ表示 (使い方・特徴・FAQ・技術解説・安全性)
│   │   ├── ToolsExplorer.tsx     # ツール検索 + カテゴリフィルター + タグフィルター
│   │   └── tools/                # ★ 各ツールのクライアントコンポーネント
│   │       ├── Base64ConverterTool.tsx
│   │       ├── GrindingCompanionTool.tsx
│   │       ├── ImagesToPDFTool.tsx
│   │       ├── JSONFormatterTool.tsx
│   │       ├── PasswordGeneratorTool.tsx
│   │       ├── QRCodeTool.tsx
│   │       ├── TimerCounterTool.tsx
│   │       ├── UnitConverterTool.tsx
│   │       └── WordCountTool.tsx
│   ├── dictionaries/
│   │   ├── ja.json               # 日本語辞書 (全UI文字列 + SEOコンテンツ)
│   │   └── en.json               # 英語辞書
│   └── lib/
│       ├── getDictionary.ts      # 辞書ロード + Locale型 + Dictionary型定義
│       ├── tools.ts              # ★ ツールレジストリ (全ツールの登録)
│       └── siteConfig.ts         # サイトURL + hreflang生成 + カテゴリアイコン定義
├── next.config.ts                # output:"export", trailingSlash:true
├── package.json
├── tsconfig.json
└── postcss.config.mjs            # Tailwind CSS v4 PostCSS プラグイン
```

---

## 3. 技術スタック

| レイヤー | 技術 | バージョン |
|---|---|---|
| フレームワーク | Next.js (App Router) | 16.x |
| UI ライブラリ | React | 19.x |
| 型システム | TypeScript | 5.x |
| スタイリング | Tailwind CSS | v4 (`@tailwindcss/postcss`) |
| アニメーション | Framer Motion | 12.x |
| アイコン | Lucide React | 0.577+ |
| PDF生成 | jsPDF | 4.x |
| QRコード生成 | qrcode.react | 4.x |
| QRコード読取 | jsQR | 1.x |
| フォント | Geist Sans / Geist Mono (Google Fonts) |

---

## 4. アーキテクチャの基本原則

### 4.1 完全クライアントサイド処理

- `next.config.ts` で `output: "export"` を設定 → **静的HTMLとして出力**
- API Route は存在しない。全ツールの処理はブラウザ内で完結する
- サーバーへのデータ送信は一切行わない（プライバシーファースト設計）

### 4.2 サーバーコンポーネント / クライアントコンポーネントの分離

| 種類 | 用途 | `"use client"` |
|---|---|---|
| ページファイル (`page.tsx`) | メタデータ生成、辞書ロード、レイアウト構築 | **不要** (サーバーコンポーネント) |
| ツールコンポーネント (`tools/*.tsx`) | インタラクティブなUI | **必須** (`"use client"`) |
| `Header`, `Footer`, `ToolCard` 等 | 静的UI | 不要 |
| `LanguageToggle`, `ToolsExplorer` | ユーザー操作を含むUI | 必須 |

### 4.3 i18n (国際化) の仕組み

```
URL:  /{lang}/tools/{tool-slug}/
例:   /ja/tools/word-count/
      /en/tools/word-count/
```

- `[lang]` は `"ja"` または `"en"` のみ
- ルートページ (`/`) は **クライアントサイドで** `/ja` にリダイレクト（`router.replace`）
  > **注意**: `output: "export"` の静的サイトでは `/` にHTMLが生成されるがサーバーリダイレクトは効かない。Netlify の `_redirects`、Vercel の `vercel.json`、S3+CloudFront のエラードキュメント設定など、**ホスティング側**でも別途 `/ → /ja` リダイレクトを設定することを推奨する。
- **`[lang]` の静的生成には `generateStaticParams` が必須**: `src/app/[lang]/layout.tsx` に `export function generateStaticParams()` が定義されており、`[{ lang: "ja" }, { lang: "en" }]` を返すことで `output: "export"` 時にビルドが通る。この関数を削除・省略するとビルドエラーになるため、絶対に消さないこと。
- 辞書ファイル（`src/dictionaries/ja.json`, `en.json`）に全UIテキストを定義
- `getDictionary(locale)` はサーバーコンポーネント（ページ）でのみ呼び出し、**辞書全体ではなく必要なセクション（slice）だけをクライアントコンポーネントの props として渡す**（バンドルサイズ削減）
- `"server-only"` importで `getDictionary` がクライアントバンドルに混入することをビルド時に強制ブロック
- `LanguageToggle` で言語を切り替え時、Cookie `NEXT_LOCALE` をセット（1年間有効）

---

## 5. ツールレジストリ (`src/lib/tools.ts`)

全ツールはこのファイルの `tools` 配列に登録される。

### 5.1 カテゴリ定義

```typescript
export const CATEGORIES = [
  "GAMING_STATS",   // ゲーム・統計
  "TEXT_PROCESS",    // テキスト・文書
  "DEV_SYSTEM",     // 開発・システム
  "LIFE_UTILITY",   // 日常・生産性
] as const;
```

### 5.2 Tool 型

```typescript
export type Tool = {
  id: string;         // 一意ID (URL slugと辞書キーに使用)
  href: string;       // パス (例: "/tools/word-count")
  icon: string;       // Lucide React アイコン名 (例: "FileText")
  category: Category; // 上記カテゴリの1つ
  tags: string[];     // 英語のタグキー (辞書で各言語に翻訳される)
};
```

### 5.3 登録例

```typescript
{
  id: "word-count",
  href: "/tools/word-count",
  icon: "FileText",
  category: "TEXT_PROCESS",
  tags: ["Text", "Writing", "Counter"],
}
```

### 5.4 ToolCard の iconMap

`src/components/ToolCard.tsx` に `iconMap` が定義されている。新しいアイコンを使う場合、ここに追加が必要:

```typescript
import { FileText, KeyRound, /* 新アイコン */ } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  FileText,
  KeyRound,
  // 新アイコン名: インポートしたアイコン,
};
```

> **フォールバック**: `iconMap` に未登録のアイコン名が来た場合、`const Icon = iconMap[tool.icon] ?? FileText` により `FileText` がフォールバックとして表示される。カードが真っ白になることはないが、意図したアイコンは表示されない。新ツール追加時は必ず登録すること。

---

## 6. 新しいツールを追加する手順 (チェックリスト)

### Step 1: ツールレジストリに登録

**ファイル:** `src/lib/tools.ts`

```typescript
// tools 配列に追加
{
  id: "my-tool",               // kebab-case。辞書キーとURL slugに使用
  href: "/tools/my-tool",
  icon: "Wrench",              // Lucide React のアイコン名
  category: "DEV_SYSTEM",      // CATEGORIES のいずれか
  tags: ["Tag1", "Tag2"],      // 英語のタグキー
},
```

### Step 2: ToolCard の iconMap に追加

**ファイル:** `src/components/ToolCard.tsx`

```typescript
import { /* 既存 */, Wrench } from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  // 既存エントリ...
  Wrench,
};
```

### Step 3: ツールコンポーネントを作成

**ファイル:** `src/components/tools/MyToolTool.tsx`

```typescript
"use client";

import { useState } from "react";
import type { Dictionary } from "@/lib/getDictionary";

// Props は辞書の該当セクションの型を受け取る
type Props = { dict: Dictionary["myTool"] };

export default function MyToolTool({ dict }: Props) {
  // ツールのロジックとUIをここに実装
  return (
    <div className="space-y-6">
      {/* UI はすべて dict から文字列を参照 */}
      <h2>{dict.title}</h2>
      {/* ... */}
    </div>
  );
}
```

**コンポーネント設計ルール:**
- 必ず `"use client"` を宣言
- ハードコードされたUI文字列を**絶対に使わない**。全て `dict` から参照
- 外部サーバーへの通信は行わない（全処理をブラウザ内で完結）
- `localStorage` を使う場合はキー名に `yuu-` プレフィックスを付与 (例: `yuu-gc-cycles`)
- **`localStorage` の読み込みは必ず `useEffect` 内で行うこと**（Hydration Mismatch 防止）:
  ```typescript
  // ✅ 正しい: useState の初期値はサーバーセーフなデフォルト値にする
  const [count, setCount] = useState(0);
  useEffect(() => {
    const saved = localStorage.getItem("yuu-gc-cycles");
    if (saved) setCount(Number(saved));
  }, []);

  // ❌ 誤り: useState の初期値で直接 localStorage を読んではいけない
  // → ビルド時(サーバー)は localStorage が存在しないため
  //   サーバーHTMLとクライアントHTMLが食い違い、Hydration Mismatch 発生
  const [count, setCount] = useState(
    Number(localStorage.getItem("yuu-gc-cycles") ?? 0)  // NG
  );
  ```
- Tailwind CSS でスタイリング。カスタムCSSファイルは作らない
- アクセントカラーは `blue-600` / `blue-50` 系を基本とする

### Step 4: ツールページを作成

**ファイル:** `src/app/[lang]/tools/my-tool/page.tsx`

以下のテンプレートを厳密にコピーして使用する:

```typescript
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import AdSenseWrapper from "@/components/AdSenseWrapper";
import MyToolTool from "@/components/tools/MyToolTool";
import ToolContentSection from "@/components/ToolContentSection";
import { getDictionary, type Locale } from "@/lib/getDictionary";
import { getAlternates } from "@/lib/siteConfig";
import { Wrench } from "lucide-react";  // ツールに合ったアイコン

const supportedLocales: Locale[] = ["ja", "en"];

type Props = { params: Promise<{ lang: string }> };

// --- SEOメタデータ ---
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = lang === "ja" ? "ja" : "en";
  const dict = await getDictionary(locale);
  return {
    title: dict.myTool.meta.title,
    description: dict.myTool.meta.description,
    keywords: dict.myTool.meta.keywords,
    alternates: getAlternates("/tools/my-tool"),
  };
}

// --- ページ本体 ---
export default async function MyToolPage({ params }: Props) {
  const { lang } = await params;
  if (!supportedLocales.includes(lang as Locale)) notFound();
  const locale = lang as Locale;
  const dict = await getDictionary(locale);
  const t = dict.myTool;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      {/* パンくずリスト */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href={`/${locale}`} className="transition-colors hover:text-blue-600">
          {dict.header.home}
        </Link>
        <span>/</span>
        <Link href={`/${locale}/tools`} className="transition-colors hover:text-blue-600">
          {dict.header.tools}
        </Link>
        <span>/</span>
        <span className="text-gray-600">{t.title}</span>
      </nav>

      {/* ページヘッダー */}
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <Wrench size={22} strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">
            {t.title}
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-gray-500 sm:text-base">{t.description}</p>
      </header>

      {/* ツール本体 */}
      <MyToolTool dict={t} />

      {/* 広告枠 */}
      <AdSenseWrapper slot="my-tool-bottom" className="h-[250px]" />

      {/* SEOコンテンツ */}
      <ToolContentSection content={t.content} />
    </div>
  );
}
```

### Step 5: 辞書ファイルに翻訳を追加

**ファイル:** `src/dictionaries/ja.json` & `src/dictionaries/en.json`

追加が必要な箇所は **3か所**:

#### (A) ツール固有セクション (トップレベルキー)

辞書キー名は `tools.ts` の `id` をキャメルケースに変換したもの (例: `my-tool` → `myTool`):

```json
{
  "myTool": {
    "title": "ツール名",
    "description": "ツールの説明",
    // ...ツール固有のUI文字列...
    "meta": {
      "title": "ページタイトル | Yuustudio",
      "description": "SEO用ディスクリプション",
      "keywords": ["キーワード1", "キーワード2"]
    },
    "content": {
      "howTo": {
        "heading": "使い方",
        "steps": ["ステップ1", "ステップ2", "ステップ3"]
      },
      "features": {
        "heading": "このツールの特徴",
        "items": ["特徴1", "特徴2"]
      },
      "faq": {
        "heading": "よくある質問",
        "items": [
          { "q": "質問1", "a": "回答1" }
        ]
      },
      "deepDive": {
        "heading": "技術解説",
        "paragraphs": ["解説テキスト段落1"]
      },
      "security": {
        "heading": "プライバシーと安全性について",
        "paragraphs": ["安全性の説明テキスト"]
      }
    }
  }
}
```

#### (B) `tools` セクション (カード表示用)

```json
{
  "tools": {
    "my-tool": {
      "name": "ツール表示名",
      "description": "ツール一覧に表示される短い説明文"
    }
  }
}
```

#### (C) `toolsSection.tags` (新しいタグを使う場合)

```json
{
  "toolsSection": {
    "tags": {
      "NewTag": "新タグ"
    }
  }
}
```

### Step 6: Dictionary 型定義を更新

**ファイル:** `src/lib/getDictionary.ts`

`Dictionary` 型にツール固有セクションの型を追加:

```typescript
export type Dictionary = {
  // ...既存の定義...
  myTool: {
    title: string;
    description: string;
    // ...ツール固有のUI文字列の型...
    meta: ToolMeta;
    content: ToolContent;
  };
};
```

### Step 7: サイトマップに追加

**ファイル:** `src/app/sitemap.ts`

```typescript
const toolPaths = [
  // ...既存のパス...
  "/tools/my-tool",       // ← 追加
];
```

### Step 8: ビルド確認

```bash
npm run build
```

静的エクスポートなので、ビルド時に全ページが生成される。エラーがないことを確認する。

---

## 7. ページ構造テンプレート

全ツールページは以下の統一構造を持つ:

```
┌─────────────────────────────────┐
│ Header (sticky, ロゴ + ナビ)      │
├─────────────────────────────────┤
│ AdSense (header-banner)          │
├─────────────────────────────────┤
│   パンくずリスト                   │
│   Home / ツール一覧 / ツール名     │
│                                   │
│   ページヘッダー                   │
│   [アイコン] ツール名              │
│   ツールの説明文                   │
│                                   │
│   ┌───────────────────────────┐ │
│   │ ツールコンポーネント          │ │
│   │ (クライアントサイド)          │ │
│   └───────────────────────────┘ │
│                                   │
│   AdSense (tool-bottom)          │
│                                   │
│   ── 区切り線 ──                  │
│   使い方 (番号付きリスト)          │
│   特徴 (チェックマーク付きリスト)   │
│   FAQ (Q&A カード)               │
│   技術解説 (青背景ボックス)        │
│   安全性 (緑背景ボックス)          │
├─────────────────────────────────┤
│ AdSense (footer-banner)          │
├─────────────────────────────────┤
│ Footer                           │
└─────────────────────────────────┘
```

---

## 8. UI スタイリング規約

### 8.1 カラーパレット

| 用途 | クラス |
|---|---|
| ページ背景 | `bg-gray-50` (#f9fafb) |
| カード背景 | `bg-white` |
| メインテキスト | `text-gray-900` |
| サブテキスト | `text-gray-500` / `text-gray-600` |
| ラベル | `text-gray-400` (uppercase, tracking-wider) |
| プライマリアクション | `bg-blue-600 text-white` / `hover:bg-blue-700` |
| プライマリアイコン背景 | `bg-blue-50 text-blue-600` |
| 非アクティブボタン | `border border-gray-200 bg-white text-gray-600` |
| 成功/安全性 | `bg-green-50 border-green-100` |
| エラー | `border-red-200 bg-red-50 text-red-600` |
| 技術解説背景 | `bg-blue-50/40 border-blue-50` |

### 8.2 角丸

| 要素 | クラス |
|---|---|
| カード | `rounded-2xl` |
| ボタン (大) | `rounded-xl` |
| ボタン (小/タブ) | `rounded-xl` |
| タグ / トグル | `rounded-full` |
| input / textarea | `rounded-xl` |
| アイコン背景 | `rounded-xl` |

### 8.3 共通コンポーネントパターン

**タブの切替UI:**
```tsx
<div className="flex gap-2">
  {modes.map((m) => (
    <button
      key={m}
      onClick={() => setMode(m)}
      className={`rounded-xl px-5 py-2 text-sm font-semibold transition ${
        mode === m
          ? "bg-blue-600 text-white shadow-sm"
          : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {dict.tabs[m]}
    </button>
  ))}
</div>
```

**ラベル:**
```tsx
<label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
  {label}
</label>
```

**テキストエリア:**
```tsx
<textarea
  className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
  spellCheck={false}
/>
```

### 8.4 レスポンシブ設計

- コンテンツ最大幅: ツールページ `max-w-3xl`、レイアウト `max-w-6xl`
- グリッド: `grid gap-6 sm:grid-cols-2 lg:grid-cols-3`
- テキストサイズ: `text-sm sm:text-base` でモバイル対応
- パディング: `px-4 sm:px-6`

---

## 9. 辞書ファイルの構造ルール

### 9.1 全体構成

```
ja.json / en.json
├── header          # ヘッダーナビ文字列
├── hero            # トップページヒーロー
├── toolsSection    # ツール一覧ページ (検索, カテゴリ, タグ)
├── toolCard        # ToolCard の CTA テキスト
├── about           # 運営者情報ページ
├── privacy         # プライバシーポリシー
├── contact         # お問い合わせ
├── [toolKey]       # ★ 各ツール固有セクション (キャメルケース)
│   ├── title
│   ├── description
│   ├── (ツール固有UI文字列)
│   ├── meta        # SEOメタデータ { title, description, keywords[] }
│   └── content     # SEOコンテンツ { howTo, features, faq, deepDive, security }
├── footer          # フッターリンク
└── tools           # ★ カード表示用 { [tool-id]: { name, description } }
```

### 9.2 SEOコンテンツ (`content`) の型

```typescript
type ToolContent = {
  howTo:     { heading: string; steps: string[] };       // 番号付きステップ
  features:  { heading: string; items: string[] };       // 特徴リスト
  faq:       { heading: string; items: { q: string; a: string }[] }; // Q&A
  deepDive:  { heading: string; paragraphs: string[] };  // 技術解説
  security:  { heading: string; paragraphs: string[] };  // 安全性
};
```

### 9.3 命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| ツールID (`tools.ts`) | kebab-case | `word-count`, `qr-code` |
| 辞書のツールキー | キャメルケース | `wordCount`, `qrCode` |
| URL slug | kebab-case (= ツールID) | `/tools/word-count` |
| タグキー (`tags[]`) | PascalCase (英語) | `"Text"`, `"Counter"` |
| カテゴリ | SCREAMING_SNAKE_CASE | `"DEV_SYSTEM"` |
| localStorage キー | `yuu-` プレフィックス | `yuu-gc-cycles` |

---

## 10. 共有コンポーネント詳細

### ToolContentSection

SEOコンテンツを5セクションで描画する。`content: ToolContent` を受け取るだけで良い。

### ToolCard

ツールカードUI。`LocalizedTool` 型 (id, href, icon, name, description, category, tags) を受け取る。`iconMap` に未登録のアイコン名が指定された場合は `FileText` がフォールバックとして使われるが、新ツール追加時は必ず `iconMap` に登録すること。

### ToolsExplorer

ツール一覧ページ専用。検索ワード・カテゴリ・タグによるフィルタリング。URLクエリパラメータ (`?q=`, `?cat=`, `?tag=`) と同期。Framer Motion でアニメーション付きグリッド表示。

### AdSenseWrapper

環境変数 `NEXT_PUBLIC_ADSENSE_ENABLED=true` の場合のみ広告枠を表示。未設定時は `null` を返す（何も描画しない）。

### Header / Footer

- サーバーコンポーネント
- `lang: Locale` と辞書の該当セクションを props で受け取る
- レイアウトの `max-w-6xl` に合わせてセンタリング

---

## 11. SEO・メタデータ

### ページレベルメタデータ

各ツールページの `generateMetadata` で以下を設定:
- `title`: 辞書の `meta.title`
- `description`: 辞書の `meta.description`
- `keywords`: 辞書の `meta.keywords` (配列)
- `alternates`: `getAlternates("/tools/{slug}")` で canonical + hreflang 生成

### サイトマップ

`src/app/sitemap.ts` で全ページを列挙。新ツール追加時は `toolPaths` に追加が必要。

### hreflang

`getAlternates(path)` が以下を生成:
- canonical → `/ja{path}` (日本語がデフォルト)
- `ja` → `/ja{path}`
- `en` → `/en{path}`
- `x-default` → `/ja{path}`

---

## 12. ビルド・デプロイ

```bash
# 開発サーバー起動
npm run dev

# 静的HTMLエクスポート (本番ビルド)
npm run build
# → out/ ディレクトリに静的ファイルが生成される

# ESLint
npm run lint
```

### ルートリダイレクト (`/` → `/ja`) のホスティング設定

`src/app/page.tsx` の `router.replace("/ja")` はクライアントサイドのリダイレクトのため、ブラウザでJSが実行される前（検索エンジンクローラー、JS無効環境、一部CDN）では効かない。ホスティング側で別途設定することを強く推奨する:

| ホスティング | 設定方法 |
|---|---|
| Netlify | `public/_redirects` に `/ /ja/ 301` を追加 |
| Vercel (static) | `vercel.json` の `redirects` に設定 |
| GitHub Pages | 対応が難しいため Netlify/Vercel を推奨 |
| S3+CloudFront | エラードキュメント or Lambda@Edge でリダイレクト |

### 環境変数

| 変数名 | 説明 | デフォルト |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | サイトのベースURL | `https://yuustudio.app` |
| `NEXT_PUBLIC_ADSENSE_ENABLED` | 広告枠を表示するか | (未設定 = 非表示) |

---

## 13. 既存ツール一覧

| ID | 辞書キー | カテゴリ | 概要 |
|---|---|---|---|
| `word-count` | `wordCount` | TEXT_PROCESS | 文字数・単語数・行数カウント |
| `password-generator` | `passwordGenerator` | DEV_SYSTEM | ランダムパスワード生成 + 強度チェック |
| `qr-code` | `qrCode` | LIFE_UTILITY | QRコード生成 (URL/テキスト/WiFi) + カメラ読取 |
| `images-to-pdf` | `imagesToPdf` | TEXT_PROCESS | 画像をPDFに変換 (ドラッグ&ドロップ) |
| `json-formatter` | `jsonFormatter` | DEV_SYSTEM | JSON整形・バリデーション |
| `unit-converter` | `unitConverter` | LIFE_UTILITY | 長さ・重さ・温度・データ容量変換 |
| `base64` | `base64` | DEV_SYSTEM | Base64エンコード/デコード |
| `timer-counter` | `timerCounter` | LIFE_UTILITY | タイマー + ストップウォッチ + カウンター + 確率計算 |
| `grinding-companion` | `grindingCompanion` | GAMING_STATS | ゲーム周回支援 (ドロップ率計算 + サイクルタイマー) |

---

## 14. 高度な実装パターン (参考)

以下は既存の複雑なツールで使われている高度なパターン。新ツール作成時の参考としてください:

### Web Worker (TimerCounterTool)
- インライン Blob URL で Web Worker を生成
- 200ms 間隔のティックでバックグラウンドでもタイマーを正確に維持
- `workerHandlerRef` パターンで stale closure 問題を回避

### Document Picture-in-Picture (PiP)
- `documentPictureInPicture.requestWindow()` で独立ウィンドウを生成
- `ReactDOM.createRoot()` で PiP ウィンドウ内に React サブツリーをマウント
- 親のスタイルシートをコピーして PiP ウィンドウに適用
- `pipHandlersRef` パターン: mutable ref に最新のハンドラーを同期的に保持し、PiP側のボタンが常に最新の state にアクセス

### AudioContext バックグラウンド維持
- 無音 AudioContext ループでモバイルブラウザのバックグラウンドタブ制限を回避
- Media Session API で OS レベルのメディアコントロールを統合
- ユーザーがトグルで ON/OFF 可能
- **⚠️ 自動再生ポリシーの厳守**: `AudioContext` の作成・`resume()`・無音再生開始は、**必ずユーザーの直接的なインタラクション（ボタンのクリックイベント）を起点として呼び出すこと**。ページロード直後・`useEffect` の初回実行・タイマー自動開始などのタイミングで呼び出すと、iOS Safari・Android Chrome ともにブラウザレベルでブロックされコンソールエラーが発生し機能が動作しない。

### localStorage 永続化
- キー名は `yuu-` プレフィックスで名前空間を分離
- `useState` の初期値は必ずサーバーセーフなデフォルト値（`0`, `""`, `false` 等）を使う
- `useEffect` 内でのみ localStorage を**読み**、変更時の `useEffect` または直接の setState コールバックで**書き込む**
- これにより静的ビルド時のサーバーHTML（localStorage なし）とクライアント初期レンダリングが一致し、Hydration Mismatch を回避できる

---

## 15. やってはいけないこと (注意事項)

1. **UI文字列のハードコード禁止** — 全テキストは辞書ファイル経由
2. **外部サーバー通信禁止** — 全処理はブラウザ内完結
3. **ダークモードCSS不要** — ライトモードのみ設計
4. **API Route 作成不可** — `output: "export"` のため動作しない
5. **`getDictionary` をクライアントコンポーネントで呼ばない** — `"server-only"` でガードされている。辞書全体をクライアントに渡すためのラッパーも作らないこと
6. **辞書の片方だけ更新しない** — `ja.json` と `en.json` は常にペアで更新
7. **`tools.ts` への登録を忘れない** — ホームページとツール一覧に表示されなくなる
8. **`iconMap` への追加を忘れない** — `FileText` フォールバックは表示されるが意図したアイコンにならない
9. **`sitemap.ts` への追加を忘れない** — 検索エンジンにインデックスされない
10. **`localStorage` を `useState` の初期値で直接読まない** — ビルド時にサーバー(localStorage なし)とクライアントのHTMLが食い違い Hydration Mismatch が発生する。必ず `useEffect` 内で読み込むこと
11. **`AudioContext` / 無音再生をページロード直後や `useEffect` 初回で自動起動しない** — iOS Safari・Android Chrome の自動再生ポリシーにより強制ブロックされる。必ずユーザーのクリックイベントを起点にすること
12. **`[lang]/layout.tsx` の `generateStaticParams` を削除しない** — 静的エクスポートで `[lang]` セグメントのページが生成されなくなりビルドエラーになる
