"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import type { Dictionary } from "@/lib/getDictionary";

type Props = {
  dict: Dictionary["qrCode"];
};

type TabType = "url" | "text" | "wifi";
type WifiSecurity = "WPA" | "WEP" | "nopass";
type ErrorLevel = "L" | "M" | "Q" | "H";

// ── Wi-Fi 特殊文字のエスケープ ───────────────────────────────
function escapeWifi(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/"/g, '\\"')
    .replace(/:/g, "\\:");
}

const ERROR_LEVELS: ErrorLevel[] = ["L", "M", "Q", "H"];

// ── カラーピッカー付きインプット ─────────────────────────────
function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <div className="flex items-center gap-2">
        <label className="relative cursor-pointer">
          <span
            className="block h-8 w-8 rounded-lg border border-gray-300 shadow-sm"
            style={{ backgroundColor: value }}
          />
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => {
            if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value);
          }}
          maxLength={7}
          className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-mono text-xs text-gray-700 focus:border-blue-400 focus:bg-white focus:outline-none"
        />
      </div>
    </div>
  );
}

// ── メインコンポーネント ─────────────────────────────────────
export default function QRCodeTool({ dict }: Props) {
  // ── 入力状態 ─────────────────────────────────────────────
  const [tab, setTab]           = useState<TabType>("url");
  const [urlVal, setUrlVal]     = useState("");
  const [textVal, setTextVal]   = useState("");
  const [ssid, setSsid]         = useState("");
  const [wifiPw, setWifiPw]     = useState("");
  const [wifiSec, setWifiSec]   = useState<WifiSecurity>("WPA");

  // ── スタイル状態 ─────────────────────────────────────────
  const [fgColor,  setFgColor]  = useState("#000000");
  const [bgColor,  setBgColor]  = useState("#FFFFFF");
  const [margin,   setMargin]   = useState(2);
  const [level,    setLevel]    = useState<ErrorLevel>("M");

  // ── ダウンロードフィードバック ───────────────────────────
  const [dlPng, setDlPng] = useState(false);
  const [dlSvg, setDlSvg] = useState(false);

  // ── ref ──────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);

  // ── QR コード値の計算 ────────────────────────────────────
  const qrValue = useMemo<string>(() => {
    if (tab === "url")  return urlVal.trim();
    if (tab === "text") return textVal;
    if (tab === "wifi") {
      if (!ssid.trim()) return "";
      const s  = escapeWifi(ssid);
      const pw = escapeWifi(wifiPw);
      if (wifiSec === "nopass") return `WIFI:T:nopass;S:${s};;;`;
      return `WIFI:T:${wifiSec};S:${s};P:${pw};;`;
    }
    return "";
  }, [tab, urlVal, textVal, ssid, wifiPw, wifiSec]);

  const isEmpty = !qrValue;

  // ── QR 共通 props ────────────────────────────────────────
  const qrProps = {
    value: qrValue || " ",
    bgColor,
    fgColor,
    level,
    marginSize: margin,
  };

  // ── PNG ダウンロード（SVG → 1024px canvas） ───────────────
  const handleDownloadPNG = useCallback(async () => {
    if (isEmpty || !svgRef.current) return;
    try {
      const svg  = svgRef.current;
      const svgStr = new XMLSerializer().serializeToString(svg);
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url  = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const SIZE = 1024;
          const canvas = document.createElement("canvas");
          canvas.width  = SIZE;
          canvas.height = SIZE;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(); return; }
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          URL.revokeObjectURL(url);

          const a = document.createElement("a");
          a.href     = canvas.toDataURL("image/png");
          a.download = "qrcode.png";
          a.click();
          resolve();
        };
        img.onerror = reject;
        img.src     = url;
      });

      setDlPng(true);
      setTimeout(() => setDlPng(false), 2000);
    } catch { /* silent */ }
  }, [isEmpty]);

  // ── SVG ダウンロード ──────────────────────────────────────
  const handleDownloadSVG = useCallback(() => {
    if (isEmpty || !svgRef.current) return;
    const svgStr = new XMLSerializer().serializeToString(svgRef.current);
    const blob   = new Blob([svgStr], { type: "image/svg+xml" });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement("a");
    a.href       = url;
    a.download   = "qrcode.svg";
    a.click();
    URL.revokeObjectURL(url);

    setDlSvg(true);
    setTimeout(() => setDlSvg(false), 2000);
  }, [isEmpty]);

  // ── タブ切り替え ─────────────────────────────────────────
  const TABS: { key: TabType; label: string }[] = [
    { key: "url",  label: dict.tabs.url  },
    { key: "text", label: dict.tabs.text },
    { key: "wifi", label: dict.tabs.wifi },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

      {/* ══════════ 左パネル：入力 + カスタマイズ ══════════ */}
      <div className="space-y-4">

        {/* タブ */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-100 p-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                tab === key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── URL 入力 ── */}
        {tab === "url" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {dict.input.url.label}
            </label>
            <input
              type="url"
              value={urlVal}
              onChange={(e) => setUrlVal(e.target.value)}
              placeholder={dict.input.url.placeholder}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}

        {/* ── テキスト入力 ── */}
        {tab === "text" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              {dict.input.text.label}
            </label>
            <textarea
              value={textVal}
              onChange={(e) => setTextVal(e.target.value)}
              placeholder={dict.input.text.placeholder}
              rows={4}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              spellCheck={false}
            />
          </div>
        )}

        {/* ── Wi-Fi 入力 ── */}
        {tab === "wifi" && (
          <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            {/* セキュリティ方式 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {dict.input.wifi.security}
              </label>
              <div className="flex gap-2">
                {(["WPA", "WEP", "nopass"] as const).map((sec) => (
                  <button
                    key={sec}
                    onClick={() => setWifiSec(sec)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${
                      wifiSec === sec
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-gray-50 text-gray-500 hover:border-blue-200"
                    }`}
                  >
                    {dict.input.wifi.securityTypes[sec]}
                  </button>
                ))}
              </div>
            </div>

            {/* SSID */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {dict.input.wifi.ssid}
              </label>
              <input
                type="text"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder={dict.input.wifi.ssidPlaceholder}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {/* パスワード（オープン以外） */}
            {wifiSec !== "nopass" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {dict.input.wifi.password}
                </label>
                <input
                  type="password"
                  value={wifiPw}
                  onChange={(e) => setWifiPw(e.target.value)}
                  placeholder={dict.input.wifi.passwordPlaceholder}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  autoComplete="off"
                />
              </div>
            )}
          </div>
        )}

        {/* ══ カスタマイズパネル ══ */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
            {dict.customize.heading}
          </p>
          <div className="space-y-4">

            {/* 色 */}
            <div className="grid grid-cols-2 gap-4">
              <ColorInput
                label={dict.customize.fgColor}
                value={fgColor}
                onChange={setFgColor}
              />
              <ColorInput
                label={dict.customize.bgColor}
                value={bgColor}
                onChange={setBgColor}
              />
            </div>

            {/* 余白スライダー */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">
                  {dict.customize.margin}
                </label>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">
                  {margin}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={8}
                value={margin}
                onChange={(e) => setMargin(Number(e.target.value))}
                className="w-full accent-blue-600"
              />
            </div>

            {/* 誤り訂正レベル */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-gray-600">
                {dict.customize.errorLevel}
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {ERROR_LEVELS.map((lv) => (
                  <button
                    key={lv}
                    onClick={() => setLevel(lv)}
                    title={dict.customize.errorLevels[lv]}
                    className={`rounded-lg border py-1.5 text-xs font-bold transition-colors ${
                      level === lv
                        ? "border-blue-500 bg-blue-600 text-white"
                        : "border-gray-200 bg-gray-50 text-gray-500 hover:border-blue-200 hover:text-blue-600"
                    }`}
                  >
                    {lv}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                {dict.customize.errorLevels[level]}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ 右パネル：プレビュー + DL ══════════ */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">

          {/* ヘッダー */}
          <div className="border-b border-gray-100 px-5 py-3.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {dict.preview.heading}
            </p>
          </div>

          {/* QR コード表示エリア */}
          <div className="flex min-h-[300px] items-center justify-center p-8">
            {isEmpty ? (
              /* 空状態 */
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                  <svg
                    className="h-8 w-8 text-gray-300"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
                    <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
                    <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.5} />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M14 14h3v3m0 3h3m-3-3h3M17 14v3" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">{dict.preview.empty}</p>
              </div>
            ) : (
              /* QR コード */
              <div
                className="rounded-xl p-3 shadow-sm ring-1 ring-gray-100"
                style={{ backgroundColor: bgColor }}
              >
                <QRCodeCanvas {...qrProps} size={220} />
              </div>
            )}
          </div>

          {/* ダウンロードボタン */}
          <div className="border-t border-gray-100 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              {/* PNG */}
              <button
                onClick={handleDownloadPNG}
                disabled={isEmpty}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  dlPng
                    ? "bg-emerald-600 text-white"
                    : "bg-blue-600 text-white hover:bg-blue-500"
                }`}
              >
                {dlPng ? (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {dict.preview.downloaded}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {dict.preview.downloadPNG}
                  </>
                )}
              </button>

              {/* SVG */}
              <button
                onClick={handleDownloadSVG}
                disabled={isEmpty}
                className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  dlSvg
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-600"
                }`}
              >
                {dlSvg ? (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {dict.preview.downloaded}
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    {dict.preview.downloadSVG}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── SVG：PNG/SVG ダウンロード用（画面外） ── */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", top: "-9999px", pointerEvents: "none" }}
      >
        <QRCodeSVG ref={svgRef} {...qrProps} size={512} />
      </div>
    </div>
  );
}
