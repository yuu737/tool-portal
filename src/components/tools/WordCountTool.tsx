"use client";

import { useState, useCallback } from "react";
import type { Dictionary } from "@/lib/getDictionary";

type Props = {
  dict: Dictionary["wordCount"];
  locale: string;
};

type Stats = {
  charsWithSpaces: number;
  charsWithoutSpaces: number;
  words: number;
  lines: number;
};

function calcWords(text: string, locale: string): number {
  if (text.trim() === "") return 0;

  // Intl.Segmenter が使えるなら日本語を含む多言語に対応
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
    let count = 0;
    for (const seg of segmenter.segment(text)) {
      if (seg.isWordLike) count++;
    }
    return count;
  }

  // フォールバック: ASCII/ラテン語圏向けのスペース区切り
  return text.trim().split(/\s+/).length;
}

function calcStats(text: string, locale: string): Stats {
  return {
    charsWithSpaces: text.length,
    charsWithoutSpaces: text.replace(/\s/g, "").length,
    words: calcWords(text, locale),
    lines: text === "" ? 0 : text.split("\n").length,
  };
}

const statConfig = [
  {
    key: "charsWithSpaces" as const,
    color: "bg-blue-50 border-blue-100",
    numColor: "text-blue-600",
  },
  {
    key: "charsWithoutSpaces" as const,
    color: "bg-violet-50 border-violet-100",
    numColor: "text-violet-600",
  },
  {
    key: "words" as const,
    color: "bg-emerald-50 border-emerald-100",
    numColor: "text-emerald-600",
  },
  {
    key: "lines" as const,
    color: "bg-amber-50 border-amber-100",
    numColor: "text-amber-600",
  },
] as const;

export default function WordCountTool({ dict, locale }: Props) {
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  const stats = calcStats(text, locale);

  const handleClear = useCallback(() => {
    setText("");
  }, []);

  const handleCopy = useCallback(async () => {
    const result = [
      `${dict.stats.charsWithSpaces}: ${stats.charsWithSpaces.toLocaleString()}`,
      `${dict.stats.charsWithoutSpaces}: ${stats.charsWithoutSpaces.toLocaleString()}`,
      `${dict.stats.words}: ${stats.words.toLocaleString()}`,
      `${dict.stats.lines}: ${stats.lines.toLocaleString()}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API が使えない環境でも静かに失敗
    }
  }, [stats, dict.stats]);

  return (
    <div className="space-y-6">
      {/* テキストエリア */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={dict.placeholder}
          className="block w-full resize-none p-4 text-base leading-relaxed text-gray-800 placeholder:text-gray-400 focus:outline-none sm:p-5 sm:text-sm"
          style={{ minHeight: "280px" }}
          aria-label={dict.placeholder}
          spellCheck={false}
        />

        {/* テキストエリア下部ツールバー */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50 px-4 py-2.5 sm:px-5">
          <span className="text-xs text-gray-400">
            {stats.charsWithSpaces.toLocaleString()} chars
          </span>
          <div className="flex items-center gap-2">
            {/* クリアボタン */}
            <button
              onClick={handleClear}
              disabled={text === ""}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              {dict.buttons.clear}
            </button>

            {/* コピーボタン */}
            <button
              onClick={handleCopy}
              disabled={text === ""}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {copied ? (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  {dict.buttons.copied}
                </>
              ) : (
                <>
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  {dict.buttons.copyResult}
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* スタットカードグリッド */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statConfig.map(({ key, color, numColor }) => (
          <div
            key={key}
            className={`flex flex-col items-center rounded-2xl border p-5 ${color} transition-transform hover:scale-[1.02]`}
          >
            <span
              className={`text-4xl font-extrabold tabular-nums tracking-tight ${numColor} sm:text-5xl`}
            >
              {stats[key].toLocaleString()}
            </span>
            <span className="mt-2 text-center text-xs font-medium leading-snug text-gray-500 sm:text-sm">
              {dict.stats[key]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
