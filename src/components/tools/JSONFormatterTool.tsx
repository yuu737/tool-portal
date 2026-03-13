"use client";

import { useState, useMemo } from "react";
import type { Dictionary } from "@/lib/getDictionary";

type IndentType = 2 | 4 | "tab";
type Props = { dict: Dictionary["jsonFormatter"] };

const SAMPLE_JSON = `{
  "name": "ToolBox",
  "tools": ["Word Counter", "Password Generator", "QR Code"],
  "version": 1,
  "free": true,
  "author": {
    "name": "yuu",
    "role": "developer"
  }
}`;

export default function JSONFormatterTool({ dict }: Props) {
  const [input, setInput] = useState("");
  const [indent, setIndent] = useState<IndentType>(2);
  const [copied, setCopied] = useState(false);

  const { output, error, isValid } = useMemo(() => {
    if (!input.trim()) return { output: "", error: null, isValid: null };
    try {
      const parsed = JSON.parse(input);
      const spaces = indent === "tab" ? "\t" : indent;
      return { output: JSON.stringify(parsed, null, spaces), error: null, isValid: true };
    } catch (e) {
      return { output: "", error: (e as Error).message, isValid: false };
    }
  }, [input, indent]);

  const handleMinify = () => {
    if (!input.trim()) return;
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed));
    } catch {
      /* silently ignore — error is already shown */
    }
  };

  const handleFormat = () => {
    if (!output) return;
    setInput(output);
  };

  const handleCopy = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusColor =
    isValid === null
      ? "text-gray-400"
      : isValid
      ? "text-green-600"
      : "text-red-500";

  const statusText =
    isValid === null
      ? dict.status.empty
      : isValid
      ? dict.status.valid
      : dict.status.invalid;

  const indentOptions: [IndentType, string][] = [
    [2, dict.indent.two],
    [4, dict.indent.four],
    ["tab", dict.indent.tab],
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
        {/* Indent Selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-500">{dict.indent.label}:</span>
          <div className="flex overflow-hidden rounded-lg border border-gray-200 text-sm">
            {indentOptions.map(([val, label]) => (
              <button
                key={val}
                onClick={() => setIndent(val)}
                className={`border-r px-3 py-1.5 last:border-r-0 transition-colors ${
                  indent === val
                    ? "bg-blue-600 font-medium text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="ml-auto flex flex-wrap gap-2">
          <button
            onClick={() => setInput(SAMPLE_JSON)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50"
          >
            {dict.buttons.sample}
          </button>
          <button
            onClick={handleMinify}
            disabled={isValid !== true}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
          >
            {dict.buttons.minify}
          </button>
          <button
            onClick={handleFormat}
            disabled={isValid !== true}
            className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-600 transition hover:bg-blue-100 disabled:opacity-40"
          >
            {dict.buttons.format}
          </button>
          <button
            onClick={() => setInput("")}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-500 transition hover:bg-gray-50"
          >
            {dict.buttons.clear}
          </button>
        </div>
      </div>

      {/* Status Badge */}
      <div className={`text-sm font-semibold ${statusColor}`}>{statusText}</div>

      {/* Two-panel editor */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Input Panel */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {dict.inputLabel}
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={dict.placeholder}
            className="h-80 w-full resize-none rounded-xl border border-gray-200 bg-gray-950 p-4 font-mono text-sm text-gray-100 placeholder-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            spellCheck={false}
          />
        </div>

        {/* Output Panel */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {dict.outputLabel}
            </label>
            <button
              onClick={handleCopy}
              disabled={!output}
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              {copied ? dict.buttons.copied : dict.buttons.copy}
            </button>
          </div>
          {error ? (
            <div className="h-80 overflow-auto rounded-xl border border-red-200 bg-red-50 p-4 font-mono text-sm text-red-700">
              {error}
            </div>
          ) : (
            <pre className="h-80 w-full overflow-auto rounded-xl border border-gray-800 bg-gray-950 p-4 font-mono text-sm text-emerald-400">
              {output || (
                <span className="text-gray-600">{dict.placeholder}</span>
              )}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
