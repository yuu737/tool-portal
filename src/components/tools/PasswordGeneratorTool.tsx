"use client";

import { useState, useCallback, useEffect } from "react";
import type { Dictionary } from "@/lib/getDictionary";

type Props = {
  dict: Dictionary["passwordGenerator"];
};

// ── 文字セット ──────────────────────────────────────────────
const CHARSET = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  numbers: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}|;:,.<>?",
} as const;

type CharKey = keyof typeof CHARSET;

// ── オプション型 ────────────────────────────────────────────
type Options = Record<CharKey, boolean>;

// ── プリセット ──────────────────────────────────────────────
type PresetKey = "simple" | "standard" | "strong";

const PRESETS: Record<PresetKey, { length: number } & Options> = {
  simple:   { length:  8, uppercase: false, lowercase: true,  numbers: true,  symbols: false },
  standard: { length: 12, uppercase: true,  lowercase: true,  numbers: true,  symbols: false },
  strong:   { length: 20, uppercase: true,  lowercase: true,  numbers: true,  symbols: true  },
};

// ── パスワード生成 ───────────────────────────────────────────
function createPassword(length: number, opts: Options): string {
  let pool = "";
  const guaranteed: string[] = [];

  const keys: CharKey[] = ["uppercase", "lowercase", "numbers", "symbols"];
  for (const key of keys) {
    if (!opts[key]) continue;
    const chars = CHARSET[key];
    pool += chars;
    guaranteed.push(chars[Math.floor(Math.random() * chars.length)]);
  }

  if (!pool) return "";

  const arr = [...guaranteed];
  while (arr.length < length) {
    arr.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  // Fisher–Yates シャッフル
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }

  return arr.slice(0, length).join("");
}

// ── 強度チェッカー ───────────────────────────────────────────
type StrengthLevel = 0 | 1 | 2 | 3 | 4;
type AdviceKey = keyof Dictionary["passwordGenerator"]["checker"]["advice"];

function checkStrength(pw: string): { level: StrengthLevel; adviceKeys: AdviceKey[] } {
  if (!pw) return { level: 0, adviceKeys: [] };

  const hasUC = /[A-Z]/.test(pw);
  const hasLC = /[a-z]/.test(pw);
  const hasN  = /[0-9]/.test(pw);
  const hasSy = /[^A-Za-z0-9]/.test(pw);

  let s = 0;
  if (pw.length >=  8) s += 20;
  if (pw.length >= 12) s += 15;
  if (pw.length >= 16) s += 10;
  if (pw.length >= 20) s += 10;
  if (hasUC) s += 10;
  if (hasLC) s += 10;
  if (hasN)  s += 10;
  if (hasSy) s += 15;
  const types = [hasUC, hasLC, hasN, hasSy].filter(Boolean).length;
  if (types >= 3) s += 5;
  if (types >= 4) s += 5;
  if (pw.length < 6) s = Math.max(0, s - 30);
  if (pw.length < 4) s = 0;
  s = Math.min(100, s);

  const level: StrengthLevel = s <= 20 ? 0 : s <= 40 ? 1 : s <= 60 ? 2 : s <= 80 ? 3 : 4;

  const advice: AdviceKey[] = [];
  if (pw.length < 8)       advice.push("tooShort");
  else if (pw.length < 12) advice.push("addLength");
  if (!hasUC) advice.push("addUppercase");
  if (!hasLC) advice.push("addLowercase");
  if (!hasN)  advice.push("addNumbers");
  if (!hasSy) advice.push("addSymbols");
  if (!advice.length) advice.push("great");

  return { level, adviceKeys: advice };
}

// ── 強度 UI メタデータ ───────────────────────────────────────
const STRENGTH_META: {
  key: keyof Dictionary["passwordGenerator"]["checker"]["strength"] & string;
  bar: string;
  text: string;
}[] = [
  { key: "veryWeak",   bar: "bg-red-500",     text: "text-red-600"     },
  { key: "weak",       bar: "bg-orange-500",  text: "text-orange-600"  },
  { key: "fair",       bar: "bg-yellow-500",  text: "text-yellow-600"  },
  { key: "strong",     bar: "bg-blue-500",    text: "text-blue-600"    },
  { key: "veryStrong", bar: "bg-emerald-500", text: "text-emerald-600" },
];

// ── メインコンポーネント ─────────────────────────────────────
const INITIAL_OPTS: Options = { uppercase: true, lowercase: true, numbers: true, symbols: false };

export default function PasswordGeneratorTool({ dict }: Props) {
  const [length,   setLength]   = useState(12);
  const [opts,     setOpts]     = useState<Options>(INITIAL_OPTS);
  const [password, setPassword] = useState("");
  const [copied,   setCopied]   = useState(false);
  const [preset,   setPreset]   = useState<PresetKey | null>("standard");

  // マウント後に初回パスワードを生成（Hydration エラー回避）
  useEffect(() => {
    setPassword(createPassword(12, INITIAL_OPTS));
  }, []);

  const [checkPw,  setCheckPw]  = useState("");
  const [showPw,   setShowPw]   = useState(false);

  // ── 生成ヘルパー ────────────────────────────────────────────
  function go(len: number, o: Options, p: PresetKey | null = null) {
    const anyEnabled = Object.values(o).some(Boolean);
    setPassword(anyEnabled ? createPassword(len, o) : "");
    setCopied(false);
    setPreset(p);
  }

  // ── プリセット適用 ──────────────────────────────────────────
  const applyPreset = (key: PresetKey) => {
    const p = PRESETS[key];
    const newOpts: Options = {
      uppercase: p.uppercase,
      lowercase: p.lowercase,
      numbers:   p.numbers,
      symbols:   p.symbols,
    };
    setLength(p.length);
    setOpts(newOpts);
    go(p.length, newOpts, key);
  };

  // ── オプション変更 ──────────────────────────────────────────
  const toggleOpt = (key: CharKey, value: boolean) => {
    const newOpts = { ...opts, [key]: value };
    setOpts(newOpts);
    go(length, newOpts, null);
  };

  const handleLength = (len: number) => {
    setLength(len);
    go(len, opts, null);
  };

  // ── クリップボードコピー ────────────────────────────────────
  const handleCopy = useCallback(async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* silent */ }
  }, [password]);

  // ── 再生成 ─────────────────────────────────────────────────
  const handleRegenerate = () => go(length, opts, preset);

  // ── 強度計算 ────────────────────────────────────────────────
  const strength  = checkStrength(checkPw);
  const sMeta     = STRENGTH_META[strength.level];
  const hasAnyOpt = Object.values(opts).some(Boolean);

  // ── チェックボックスリスト ──────────────────────────────────
  const checkboxItems: { key: CharKey; label: string }[] = [
    { key: "uppercase", label: dict.options.uppercase },
    { key: "lowercase", label: dict.options.lowercase },
    { key: "numbers",   label: dict.options.numbers   },
    { key: "symbols",   label: dict.options.symbols   },
  ];

  return (
    <div className="space-y-6">

      {/* ══════════ 生成カード ══════════ */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

        {/* ヘッダー */}
        <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-xs text-white">
              ⚙
            </span>
            {dict.sections.generator}
          </h2>
        </div>

        <div className="space-y-5 px-5 py-5">

          {/* プリセットボタン */}
          <div>
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
              {dict.presets.label}
            </p>
            <div className="flex flex-wrap gap-2">
              {(["simple", "standard", "strong"] as const).map((key) => {
                const p = PRESETS[key];
                const active = preset === key;
                return (
                  <button
                    key={key}
                    onClick={() => applyPreset(key)}
                    className={`group flex flex-col rounded-xl border px-4 py-2.5 text-left transition-all ${
                      active
                        ? "border-blue-500 bg-blue-600 text-white shadow-md"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                    }`}
                  >
                    <span className="text-sm font-semibold">{dict.presets[key]}</span>
                    <span className={`mt-0.5 text-xs ${active ? "text-blue-200" : "text-gray-400"}`}>
                      {p.length} chars
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 長さスライダー */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">{dict.options.length}</label>
              <span className="min-w-[3rem] rounded-lg bg-blue-50 px-2.5 py-0.5 text-center text-sm font-bold text-blue-700">
                {length}
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={64}
              value={length}
              onChange={(e) => handleLength(Number(e.target.value))}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-600"
            />
            <div className="mt-1 flex justify-between text-xs text-gray-400">
              <span>4</span>
              <span>64</span>
            </div>
          </div>

          {/* 文字種チェックボックス */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {checkboxItems.map(({ key, label }) => (
              <label
                key={key}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl border p-3 text-sm transition-all ${
                  opts[key]
                    ? "border-blue-200 bg-blue-50 text-blue-800 shadow-sm"
                    : "border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={opts[key]}
                  onChange={(e) => toggleOpt(key, e.target.checked)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>

          {/* 生成パスワード表示 */}
          <div className="overflow-hidden rounded-xl bg-gray-950 ring-1 ring-gray-800">
            <div className="flex items-center gap-3 px-4 py-3">
              {/* ドットアクセサリー風 */}
              <div className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
              </div>
              <span className="text-xs text-gray-500 select-none">password</span>
            </div>
            <div className="flex items-center gap-3 border-t border-gray-800 px-4 py-3">
              <span className="flex-1 break-all font-mono text-base tracking-widest text-emerald-400 select-all sm:text-sm">
                {hasAnyOpt ? password || "–" : "–"}
              </span>
              <div className="flex flex-shrink-0 items-center gap-2">
                {/* 再生成ボタン */}
                <button
                  onClick={handleRegenerate}
                  disabled={!hasAnyOpt}
                  title={dict.buttons.regenerate}
                  className="rounded-lg bg-gray-800 p-2 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-40"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
                {/* コピーボタン */}
                <button
                  onClick={handleCopy}
                  disabled={!hasAnyOpt || !password}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40"
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      {dict.buttons.copied}
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      {dict.buttons.copy}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ══════════ 強度チェックカード ══════════ */}
      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">

        {/* ヘッダー */}
        <div className="border-b border-gray-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold text-gray-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-xs text-white">
              🔍
            </span>
            {dict.sections.checker}
          </h2>
        </div>

        <div className="space-y-4 px-5 py-5">

          {/* 入力フィールド */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {dict.checker.label}
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                value={checkPw}
                onChange={(e) => setCheckPw(e.target.value)}
                placeholder={dict.checker.placeholder}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 pr-12 font-mono text-sm text-gray-800 placeholder:font-sans placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 transition-colors hover:text-gray-600"
                aria-label="toggle visibility"
              >
                {showPw ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* 強度ゲージ & アドバイス */}
          {checkPw.length > 0 && (
            <div className="space-y-3 rounded-xl bg-gray-50 p-4">
              {/* ラベル行 */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  {dict.checker.strength.label}
                </span>
                <span className={`text-sm font-bold ${sMeta.text}`}>
                  {dict.checker.strength[sMeta.key as keyof typeof dict.checker.strength]}
                </span>
              </div>

              {/* 5 セグメントバー */}
              <div className="flex gap-1.5">
                {STRENGTH_META.map((meta, i) => (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                      i <= strength.level ? meta.bar : "bg-gray-200"
                    }`}
                  />
                ))}
              </div>

              {/* アドバイスリスト */}
              <ul className="space-y-1.5 pt-0.5">
                {strength.adviceKeys.map((key) => {
                  const isGood = key === "great";
                  return (
                    <li key={key} className="flex items-start gap-2 text-xs text-gray-600">
                      <span
                        className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          isGood
                            ? "bg-emerald-100 text-emerald-600"
                            : "bg-amber-100 text-amber-600"
                        }`}
                      >
                        {isGood ? "✓" : "!"}
                      </span>
                      {dict.checker.advice[key]}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* 空状態のヒント */}
          {checkPw.length === 0 && (
            <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
              {dict.checker.placeholder}
            </p>
          )}

        </div>
      </section>

    </div>
  );
}
