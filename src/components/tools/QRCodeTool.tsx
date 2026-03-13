"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import type { Dictionary } from "@/lib/getDictionary";
import { Camera, ImageIcon, Copy, Check, RefreshCw, X } from "lucide-react";

type Props = { dict: Dictionary["qrCode"] };
type TabType = "url" | "text" | "wifi" | "scan";
type WifiSecurity = "WPA" | "WEP" | "nopass";
type ErrorLevel = "L" | "M" | "Q" | "H";

function escapeWifi(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/"/g, '\\"')
    .replace(/:/g, "\\:");
}

const ERROR_LEVELS: ErrorLevel[] = ["L", "M", "Q", "H"];

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-gray-600">{label}</label>
      <div className="flex items-center gap-2">
        <label className="relative cursor-pointer">
          <span className="block h-8 w-8 rounded-lg border border-gray-300 shadow-sm" style={{ backgroundColor: value }} />
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <input
          type="text" value={value}
          onChange={(e) => { if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) onChange(e.target.value); }}
          maxLength={7}
          className="w-24 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 font-mono text-xs text-gray-700 focus:border-blue-400 focus:bg-white focus:outline-none"
        />
      </div>
    </div>
  );
}

// ── QR Camera Scanner ─────────────────────────────────────────────────────────
function CameraScanner({
  onResult,
  scanningLabel,
  stopLabel,
}: {
  onResult: (text: string) => void;
  scanningLabel: string;
  stopLabel: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  }, []);

  const start = useCallback(async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);

      const tick = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const jsQR = (await import("jsqr")).default;
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        if (code?.data) {
          stop();
          onResult(code.data);
          return;
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setError((e as Error).message || "Camera error");
    }
  }, [onResult, stop]);

  useEffect(() => () => stop(), [stop]);

  return (
    <div className="space-y-3">
      {!active ? (
        <button
          onClick={start}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Camera size={16} /> {scanningLabel}
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-xl bg-black">
          <video ref={videoRef} className="w-full rounded-xl" playsInline muted />
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="h-40 w-40 rounded-2xl border-2 border-white/70 shadow-lg" />
          </div>
          <button
            onClick={stop}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function QRCodeTool({ dict }: Props) {
  const [tab, setTab]           = useState<TabType>("url");
  const [urlVal, setUrlVal]     = useState("");
  const [textVal, setTextVal]   = useState("");
  const [ssid, setSsid]         = useState("");
  const [wifiPw, setWifiPw]     = useState("");
  const [wifiSec, setWifiSec]   = useState<WifiSecurity>("WPA");
  const [fgColor,  setFgColor]  = useState("#000000");
  const [bgColor,  setBgColor]  = useState("#FFFFFF");
  const [margin,   setMargin]   = useState(2);
  const [level,    setLevel]    = useState<ErrorLevel>("M");
  const [dlPng, setDlPng]       = useState(false);
  const [dlSvg, setDlSvg]       = useState(false);
  // ── Scan state ─────────────────────────────────────────────────────────────
  const [scanResult, setScanResult] = useState("");
  const [scanCopied, setScanCopied] = useState(false);
  const [scanHistory, setScanHistory] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const qrValue = useMemo<string>(() => {
    if (tab === "scan") return "";
    if (tab === "url")  return urlVal.trim();
    if (tab === "text") return textVal;
    if (tab === "wifi") {
      if (!ssid.trim()) return "";
      const s = escapeWifi(ssid);
      const pw = escapeWifi(wifiPw);
      if (wifiSec === "nopass") return `WIFI:T:nopass;S:${s};;;`;
      return `WIFI:T:${wifiSec};S:${s};P:${pw};;`;
    }
    return "";
  }, [tab, urlVal, textVal, ssid, wifiPw, wifiSec]);

  const isEmpty = !qrValue;

  const qrProps = { value: qrValue || " ", bgColor, fgColor, level, marginSize: margin };

  const handleDownloadPNG = useCallback(async () => {
    if (isEmpty || !svgRef.current) return;
    try {
      const svgStr = new XMLSerializer().serializeToString(svgRef.current);
      const blob = new Blob([svgStr], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const SIZE = 1024;
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = SIZE;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject(); return; }
          ctx.drawImage(img, 0, 0, SIZE, SIZE);
          URL.revokeObjectURL(url);
          const a = document.createElement("a");
          a.href = canvas.toDataURL("image/png");
          a.download = "qrcode.png";
          a.click();
          resolve();
        };
        img.onerror = reject;
        img.src = url;
      });
      setDlPng(true);
      setTimeout(() => setDlPng(false), 2000);
    } catch { /* silent */ }
  }, [isEmpty]);

  const handleDownloadSVG = useCallback(() => {
    if (isEmpty || !svgRef.current) return;
    const svgStr = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "qrcode.svg"; a.click();
    URL.revokeObjectURL(url);
    setDlSvg(true);
    setTimeout(() => setDlSvg(false), 2000);
  }, [isEmpty]);

  // ── Scan handlers ───────────────────────────────────────────────────────────
  const handleScanResult = useCallback((text: string) => {
    setScanResult(text);
    setScanHistory((h) => [text, ...h.filter((x) => x !== text)].slice(0, 10));
  }, []);

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const jsQR = (await import("jsqr")).default;
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code?.data) {
        handleScanResult(code.data);
      } else {
        setScanResult("__no_result__");
      }
    } catch {
      setScanResult("__error__");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [handleScanResult]);

  const handleCopyScan = useCallback(async () => {
    if (!scanResult || scanResult.startsWith("__")) return;
    try {
      await navigator.clipboard.writeText(scanResult);
      setScanCopied(true);
      setTimeout(() => setScanCopied(false), 2000);
    } catch { /* silent */ }
  }, [scanResult]);

  const TABS: { key: TabType; label: string }[] = [
    { key: "url",  label: dict.tabs.url },
    { key: "text", label: dict.tabs.text },
    { key: "wifi", label: dict.tabs.wifi },
    { key: "scan", label: dict.tabs.scan },
  ];

  const isScanTab = tab === "scan";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ══ Left panel ══ */}
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex rounded-xl border border-gray-200 bg-gray-100 p-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all ${
                tab === key
                  ? key === "scan"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* URL */}
        {tab === "url" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{dict.input.url.label}</label>
            <input type="url" value={urlVal} onChange={(e) => setUrlVal(e.target.value)} placeholder={dict.input.url.placeholder}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" autoComplete="off" spellCheck={false} />
          </div>
        )}

        {/* Text */}
        {tab === "text" && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">{dict.input.text.label}</label>
            <textarea value={textVal} onChange={(e) => setTextVal(e.target.value)} placeholder={dict.input.text.placeholder} rows={4}
              className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" spellCheck={false} />
          </div>
        )}

        {/* Wi-Fi */}
        {tab === "wifi" && (
          <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{dict.input.wifi.security}</label>
              <div className="flex gap-2">
                {(["WPA", "WEP", "nopass"] as const).map((sec) => (
                  <button key={sec} onClick={() => setWifiSec(sec)}
                    className={`flex-1 rounded-lg border py-2 text-xs font-semibold transition-colors ${wifiSec === sec ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 bg-gray-50 text-gray-500 hover:border-blue-200"}`}>
                    {dict.input.wifi.securityTypes[sec]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{dict.input.wifi.ssid}</label>
              <input type="text" value={ssid} onChange={(e) => setSsid(e.target.value)} placeholder={dict.input.wifi.ssidPlaceholder}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" autoComplete="off" spellCheck={false} />
            </div>
            {wifiSec !== "nopass" && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">{dict.input.wifi.password}</label>
                <input type="password" value={wifiPw} onChange={(e) => setWifiPw(e.target.value)} placeholder={dict.input.wifi.passwordPlaceholder}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100" autoComplete="off" />
              </div>
            )}
          </div>
        )}

        {/* ── Scan Tab ── */}
        {tab === "scan" && (
          <div className="space-y-3 rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
            <CameraScanner
              onResult={handleScanResult}
              scanningLabel={dict.scan.cameraLabel}
              stopLabel={dict.scan.stopLabel}
            />
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-3 text-xs text-gray-400">{dict.scan.orUpload}</span>
              </div>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-3 text-sm font-medium text-gray-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              <ImageIcon size={16} /> {dict.scan.imageLabel}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
          </div>
        )}

        {/* Customize — only shown on generate tabs */}
        {!isScanTab && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">{dict.customize.heading}</p>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ColorInput label={dict.customize.fgColor} value={fgColor} onChange={setFgColor} />
                <ColorInput label={dict.customize.bgColor} value={bgColor} onChange={setBgColor} />
              </div>
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-600">{dict.customize.margin}</label>
                  <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-600">{margin}</span>
                </div>
                <input type="range" min={0} max={8} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="w-full accent-blue-600" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-gray-600">{dict.customize.errorLevel}</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ERROR_LEVELS.map((lv) => (
                    <button key={lv} onClick={() => setLevel(lv)} title={dict.customize.errorLevels[lv]}
                      className={`rounded-lg border py-1.5 text-xs font-bold transition-colors ${level === lv ? "border-blue-500 bg-blue-600 text-white" : "border-gray-200 bg-gray-50 text-gray-500 hover:border-blue-200 hover:text-blue-600"}`}>
                      {lv}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-gray-400">{dict.customize.errorLevels[level]}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ══ Right panel ══ */}
      <div className="lg:sticky lg:top-24 lg:self-start">
        {isScanTab ? (
          /* ── Scan result panel ── */
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{dict.scan.result}</p>
            </div>
            <div className="min-h-[200px] p-5">
              {!scanResult ? (
                <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                    <Camera size={26} className="text-gray-300" />
                  </div>
                  <p className="text-sm text-gray-400">{dict.scan.empty}</p>
                </div>
              ) : scanResult === "__no_result__" ? (
                <div className="rounded-xl bg-amber-50 p-4 text-center text-sm text-amber-700">{dict.scan.noResult}</div>
              ) : scanResult === "__error__" ? (
                <div className="rounded-xl bg-red-50 p-4 text-center text-sm text-red-700">{dict.scan.error}</div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3">
                    <p className="flex-1 break-all text-sm text-blue-900">{scanResult}</p>
                    <button onClick={handleCopyScan} className={`shrink-0 rounded-lg p-1.5 transition-colors ${scanCopied ? "bg-green-100 text-green-700" : "bg-white text-gray-500 hover:bg-blue-100 hover:text-blue-700"}`}>
                      {scanCopied ? <Check size={16} /> : <Copy size={16} />}
                    </button>
                  </div>
                  <div className="flex gap-2">
                    {scanResult.startsWith("http") && (
                      <a href={scanResult} target="_blank" rel="noopener noreferrer"
                        className="flex-1 rounded-xl bg-blue-600 py-2 text-center text-xs font-semibold text-white hover:bg-blue-700 transition-colors">
                        {dict.scan.openUrl}
                      </a>
                    )}
                    <button onClick={() => setScanResult("")}
                      className="flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                      <RefreshCw size={12} /> {dict.scan.clear}
                    </button>
                  </div>
                </div>
              )}

              {/* Scan history */}
              {scanHistory.length > 1 && (
                <div className="mt-4 space-y-1.5">
                  <p className="text-xs font-semibold text-gray-400">{dict.scan.history}</p>
                  {scanHistory.slice(1).map((item, i) => (
                    <button key={i} onClick={() => setScanResult(item)}
                      className="w-full truncate rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5 text-left text-xs text-gray-600 hover:border-blue-200 hover:bg-blue-50 transition-colors">
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── QR Preview panel ── */
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-3.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{dict.preview.heading}</p>
            </div>
            <div className="flex min-h-[300px] items-center justify-center p-8">
              {isEmpty ? (
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                    <svg className="h-8 w-8 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
                      <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth={1.5} />
                      <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth={1.5} />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14 14h3v3m0 3h3m-3-3h3M17 14v3" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-400">{dict.preview.empty}</p>
                </div>
              ) : (
                <div className="rounded-xl p-3 shadow-sm ring-1 ring-gray-100" style={{ backgroundColor: bgColor }}>
                  <QRCodeCanvas {...qrProps} size={220} />
                </div>
              )}
            </div>
            <div className="border-t border-gray-100 px-5 py-4">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={handleDownloadPNG} disabled={isEmpty}
                  className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${dlPng ? "bg-emerald-600 text-white" : "bg-blue-600 text-white hover:bg-blue-500"}`}>
                  {dlPng ? <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>{dict.preview.downloaded}</> : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>{dict.preview.downloadPNG}</>}
                </button>
                <button onClick={handleDownloadSVG} disabled={isEmpty}
                  className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${dlSvg ? "border-emerald-500 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-600"}`}>
                  {dlSvg ? <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>{dict.preview.downloaded}</> : <><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>{dict.preview.downloadSVG}</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Off-screen SVG for download */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: "-9999px", pointerEvents: "none" }}>
        <QRCodeSVG ref={svgRef} {...qrProps} size={512} />
      </div>
    </div>
  );
}
