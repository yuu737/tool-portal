"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  Lock,
  Unlock,
  Download,
  X,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import type { Dictionary } from "@/lib/getDictionary";

type Props = { dict: Dictionary["imageOptimizer"] };

// User-facing format key — used for state, display, and download extension
type FormatKey = "webp" | "jpg" | "jpeg" | "png";

function getMimeType(key: FormatKey): "image/webp" | "image/jpeg" | "image/png" {
  if (key === "webp") return "image/webp";
  if (key === "png") return "image/png";
  return "image/jpeg"; // both "jpg" and "jpeg" map to image/jpeg
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ImageOptimizerTool({ dict }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string>("");
  const [originalSize, setOriginalSize] = useState<number>(0);
  const [naturalW, setNaturalW] = useState<number>(0);
  const [naturalH, setNaturalH] = useState<number>(0);

  const [format, setFormat] = useState<FormatKey>("webp");
  const [quality, setQuality] = useState<number>(80); // Default 80 to avoid size inflation at 100
  const [resizeW, setResizeW] = useState<number | "">("");
  const [resizeH, setResizeH] = useState<number | "">("");
  const [lockAspect, setLockAspect] = useState<boolean>(true);

  const [optimizedUrl, setOptimizedUrl] = useState<string>("");
  const [optimizedSize, setOptimizedSize] = useState<number>(0);
  const [processing, setProcessing] = useState<boolean>(false);

  const [isDragging, setIsDragging] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const processTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aspectRatioRef = useRef<number>(1);
  const prevOptUrlRef = useRef<string>("");

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (prevOptUrlRef.current) URL.revokeObjectURL(prevOptUrlRef.current);
    };
  }, []);

  const processImage = useCallback(
    (
      img: HTMLImageElement,
      fmtKey: FormatKey,
      q: number,
      targetW: number | "",
      targetH: number | ""
    ) => {
      const w =
        typeof targetW === "number" && targetW > 0
          ? Math.round(targetW)
          : img.naturalWidth;
      const h =
        typeof targetH === "number" && targetH > 0
          ? Math.round(targetH)
          : img.naturalHeight;

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, w, h);

      const mime = getMimeType(fmtKey);
      const qualityValue = fmtKey === "png" ? undefined : q / 100;
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          if (prevOptUrlRef.current) URL.revokeObjectURL(prevOptUrlRef.current);
          prevOptUrlRef.current = url;
          setOptimizedUrl(url);
          setOptimizedSize(blob.size);
          setProcessing(false);
        },
        mime,
        qualityValue
      );
    },
    []
  );

  const scheduleProcess = useCallback(
    (fmtKey: FormatKey, q: number, w: number | "", h: number | "") => {
      if (!imgRef.current) return;
      setProcessing(true);
      if (processTimerRef.current) clearTimeout(processTimerRef.current);
      processTimerRef.current = setTimeout(() => {
        if (imgRef.current) processImage(imgRef.current, fmtKey, q, w, h);
      }, 100);
    },
    [processImage]
  );

  const loadFile = useCallback(
    (f: File) => {
      if (!f.type.startsWith("image/")) return;

      const url = URL.createObjectURL(f);
      setFile(f);
      setOriginalUrl(url);
      setOriginalSize(f.size);

      const img = new window.Image();
      img.onload = () => {
        imgRef.current = img;
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        setNaturalW(w);
        setNaturalH(h);
        setResizeW(w);
        setResizeH(h);
        aspectRatioRef.current = w / h;
        processImage(img, format, quality, w, h);
      };
      img.src = url;
    },
    [format, quality, processImage]
  );

  const handleFormatChange = (key: FormatKey) => {
    setFormat(key);
    scheduleProcess(key, quality, resizeW, resizeH);
  };

  const handleQualityChange = (q: number) => {
    setQuality(q);
    scheduleProcess(format, q, resizeW, resizeH);
  };

  const handleWidthChange = (val: string) => {
    const n = val === "" ? "" : Math.max(1, parseInt(val) || 1);
    setResizeW(n);
    if (lockAspect && typeof n === "number") {
      const newH = Math.round(n / aspectRatioRef.current);
      setResizeH(newH);
      scheduleProcess(format, quality, n, newH);
    } else {
      scheduleProcess(format, quality, n, resizeH);
    }
  };

  const handleHeightChange = (val: string) => {
    const n = val === "" ? "" : Math.max(1, parseInt(val) || 1);
    setResizeH(n);
    if (lockAspect && typeof n === "number") {
      const newW = Math.round(n * aspectRatioRef.current);
      setResizeW(newW);
      scheduleProcess(format, quality, newW, n);
    } else {
      scheduleProcess(format, quality, resizeW, n);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) loadFile(f);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
  };

  const handleDownload = () => {
    if (!optimizedUrl || !file) return;
    const base = file.name.replace(/\.[^.]+$/, "");
    const a = document.createElement("a");
    a.href = optimizedUrl;
    a.download = `${base}-optimized.${format}`; // format itself is the extension: webp/jpg/jpeg/png
    a.click();
  };

  const handleReset = () => {
    if (originalUrl) URL.revokeObjectURL(originalUrl);
    if (prevOptUrlRef.current) {
      URL.revokeObjectURL(prevOptUrlRef.current);
      prevOptUrlRef.current = "";
    }
    setFile(null);
    setOriginalUrl("");
    setOptimizedUrl("");
    setOriginalSize(0);
    setOptimizedSize(0);
    setNaturalW(0);
    setNaturalH(0);
    imgRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const reduction =
    originalSize > 0 && optimizedSize > 0
      ? Math.round((1 - optimizedSize / originalSize) * 100)
      : 0;

  const formats: { key: FormatKey; label: string }[] = [
    { key: "webp", label: dict.formats.webp },
    { key: "jpg", label: dict.formats.jpg },
    { key: "jpeg", label: dict.formats.jpeg },
    { key: "png", label: dict.formats.png },
  ];

  return (
    <div className="space-y-6">
      {!file ? (
        /* ── Drop Zone ── */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 transition-colors select-none ${
            isDragging
              ? "border-blue-400 bg-blue-50"
              : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50"
          }`}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Upload size={32} strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-base font-semibold text-gray-700">
              {dict.dropZone.heading}
            </p>
            <p className="mt-1 text-sm text-gray-400">{dict.dropZone.sub}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-blue-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors">
            <Upload size={14} />
            {dict.selectFile}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Preview comparison ── */}
          <div className="grid grid-cols-2 gap-4">
            {/* Original */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {dict.original}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {formatBytes(originalSize)}
                </span>
              </div>
              <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-[repeating-conic-gradient(#e8e8e8_0%_25%,white_0%_50%)_0_0_/_16px_16px]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={originalUrl}
                  alt="Original"
                  className="h-44 w-full object-contain"
                />
              </div>
              <p className="text-center text-xs text-gray-400">
                {naturalW} × {naturalH} px
              </p>
            </div>

            {/* Optimized */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {dict.optimized}
                </span>
                {optimizedSize > 0 && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      reduction >= 0
                        ? "bg-green-100 text-green-700"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {reduction >= 0 ? `−${reduction}%` : `+${Math.abs(reduction)}%`}
                  </span>
                )}
              </div>
              <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-[repeating-conic-gradient(#e8e8e8_0%_25%,white_0%_50%)_0_0_/_16px_16px]">
                {processing ? (
                  <div className="flex h-44 items-center justify-center">
                    <RefreshCw size={24} className="animate-spin text-blue-400" />
                  </div>
                ) : optimizedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={optimizedUrl}
                    alt="Optimized"
                    className="h-44 w-full object-contain"
                  />
                ) : null}
              </div>
              <p className="text-center text-xs text-gray-400">
                {optimizedSize > 0 ? formatBytes(optimizedSize) : "—"} ·{" "}
                <span className="font-medium">.{format}</span>
              </p>
            </div>
          </div>

          {/* ── Metrics row ── */}
          {originalSize > 0 && optimizedSize > 0 && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-400">{dict.metrics.original}</p>
                <p className="mt-0.5 text-sm font-bold text-gray-700">
                  {formatBytes(originalSize)}
                </p>
              </div>
              <div className="rounded-xl bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-400">{dict.metrics.optimized}</p>
                <p className="mt-0.5 text-sm font-bold text-gray-700">
                  {formatBytes(optimizedSize)}
                </p>
              </div>
              <div
                className={`rounded-xl p-3 text-center ${
                  reduction >= 0 ? "bg-green-50" : "bg-red-50"
                }`}
              >
                <p
                  className={`text-xs ${
                    reduction >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {dict.metrics.reduction}
                </p>
                <p
                  className={`mt-0.5 text-base font-extrabold ${
                    reduction >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {reduction >= 0
                    ? `−${reduction}%`
                    : `+${Math.abs(reduction)}%`}
                </p>
              </div>
            </div>
          )}

          {/* ── Controls ── */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">
            {/* Format selector */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {dict.format}
              </label>
              <div className="flex gap-2">
                {formats.map(({ key, label }) => {
                  const isWebP = key === "webp";
                  const isActive = format === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleFormatChange(key)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                        isActive
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:text-blue-600"
                      }`}
                    >
                      {label}
                      {isWebP && !isActive && (
                        <span className="ml-1 text-xs text-blue-500">★</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quality slider */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  {dict.quality}
                </label>
                <span
                  className={`text-sm font-bold ${
                    format === "png" ? "text-gray-300" : "text-blue-600"
                  }`}
                >
                  {format === "png" ? dict.lossless : `${quality}%`}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={quality}
                disabled={format === "png"}
                onChange={(e) => handleQualityChange(Number(e.target.value))}
                className="w-full accent-blue-600 disabled:opacity-30"
              />
            </div>

            {/* Resize */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                {dict.resize}
              </label>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <p className="mb-1 text-xs text-gray-400">{dict.width}</p>
                  <input
                    type="number"
                    min={1}
                    value={resizeW}
                    onChange={(e) => handleWidthChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setLockAspect(!lockAspect)}
                  title={dict.lockAspect}
                  className={`mb-0.5 rounded-lg border p-2 transition-colors ${
                    lockAspect
                      ? "border-blue-200 bg-blue-50 text-blue-600"
                      : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
                  }`}
                >
                  {lockAspect ? <Lock size={16} /> : <Unlock size={16} />}
                </button>
                <div className="flex-1">
                  <p className="mb-1 text-xs text-gray-400">{dict.height}</p>
                  <input
                    type="number"
                    min={1}
                    value={resizeH}
                    onChange={(e) => handleHeightChange(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-200"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── EXIF notice ── */}
          <div className="flex items-start gap-2.5 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            <span>{dict.exifNotice}</span>
          </div>

          {/* ── Action buttons ── */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!optimizedUrl || processing}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download size={16} />
              {dict.download}
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              <X size={16} />
              {dict.newFile}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
