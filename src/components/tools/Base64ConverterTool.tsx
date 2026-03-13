"use client";

import { useState, useMemo } from "react";
import type { Dictionary } from "@/lib/getDictionary";

type Mode = "encode" | "decode";
type Props = { dict: Dictionary["base64"] };

function encodeToBase64(text: string): string {
  // Handles full Unicode including Japanese characters
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function decodeFromBase64(b64: string): { result: string; error: boolean } {
  try {
    const cleaned = b64.trim().replace(/\s/g, "");
    const binary = atob(cleaned);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { result: new TextDecoder().decode(bytes), error: false };
  } catch {
    return { result: "", error: true };
  }
}

export default function Base64ConverterTool({ dict }: Props) {
  const [mode, setMode] = useState<Mode>("encode");
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);

  const { output, hasError } = useMemo(() => {
    if (!input.trim()) return { output: "", hasError: false };
    if (mode === "encode") {
      return { output: encodeToBase64(input), hasError: false };
    } else {
      const { result, error } = decodeFromBase64(input);
      return { output: result, hasError: error };
    }
  }, [input, mode]);

  const handleCopy = () => {
    if (!output || hasError) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSwap = () => {
    if (!output || hasError) return;
    const newMode = mode === "encode" ? "decode" : "encode";
    setMode(newMode);
    setInput(output);
  };

  const handleClear = () => setInput("");

  const inputLabel  = mode === "encode" ? dict.labels.input      : dict.labels.inputDecode;
  const outputLabel = mode === "encode" ? dict.labels.output     : dict.labels.outputDecode;
  const placeholder = mode === "encode" ? dict.placeholders.encode : dict.placeholders.decode;

  return (
    <div className="space-y-6">
      {/* Mode Tabs */}
      <div className="flex gap-2">
        {(["encode", "decode"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => { setMode(m); setInput(""); }}
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

      {/* Input */}
      <div className="space-y-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {inputLabel}
        </label>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          rows={6}
          className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 p-4 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          spellCheck={false}
        />
      </div>

      {/* Output */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            {outputLabel}
          </label>
          <div className="flex gap-2">
            <button
              onClick={handleSwap}
              disabled={!output || hasError}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500 transition hover:bg-gray-50 disabled:opacity-40"
            >
              {dict.buttons.swap}
            </button>
            <button
              onClick={handleCopy}
              disabled={!output || hasError}
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              {copied ? dict.buttons.copied : dict.buttons.copy}
            </button>
          </div>
        </div>

        {hasError ? (
          <div className="min-h-[100px] rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
            {dict.errors.invalidBase64}
          </div>
        ) : (
          <div
            className={`min-h-[100px] break-all rounded-xl border p-4 font-mono text-sm ${
              output
                ? "border-blue-200 bg-blue-50 text-blue-800"
                : "border-gray-200 bg-gray-50 text-gray-400"
            }`}
          >
            {output || "—"}
          </div>
        )}
      </div>

      {/* Clear */}
      <button
        onClick={handleClear}
        className="text-sm text-gray-400 transition hover:text-gray-600"
      >
        {dict.buttons.clear}
      </button>
    </div>
  );
}
