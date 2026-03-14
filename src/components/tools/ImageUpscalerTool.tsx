"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from "react";
import {
  Upload,
  Download,
  RefreshCw,
  ShieldCheck,
  Loader2,
  ImageOff,
} from "lucide-react";
import type { Dictionary } from "@/lib/getDictionary";

type Props = { dict: Dictionary["imageUpscaler"] };

type Status = "idle" | "loading" | "ready" | "processing" | "done" | "error";
type Scale = 2 | 4;
type Denoise = "none" | "low" | "high";

export default function ImageUpscalerTool({ dict }: Props) {
  // ─── State ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState<Status>("idle");
  const [loadPct, setLoadPct] = useState(0);
  const [loadFile, setLoadFile] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [scale, setScale] = useState<Scale>(2);
  const [denoise, setDenoise] = useState<Denoise>("low");

  const [origUrl, setOrigUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [origDims, setOrigDims] = useState({ w: 0, h: 0 });
  const [resultDims, setResultDims] = useState({ w: 0, h: 0 });

  const [isDragging, setIsDragging] = useState(false);

  // ─── Refs ───────────────────────────────────────────────────────────────────
  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const prevOrigUrlRef = useRef("");
  const prevResultUrlRef = useRef("");
  const currentFileRef = useRef<File | null>(null);

  // ─── Worker init ────────────────────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL("./workers/upscalerWorker.ts", import.meta.url)
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as {
        type: string;
        progress?: number;
        file?: string;
        message?: string;
        rgbaBuffer?: ArrayBuffer;
        width?: number;
        height?: number;
      };

      switch (msg.type) {
        case "progress":
          setLoadPct(msg.progress ?? 0);
          setLoadFile(msg.file ?? "");
          break;

        case "loaded":
          setStatus("ready");
          break;

        case "inferring":
          setStatus("processing");
          break;

        case "result": {
          const w = msg.width!;
          const h = msg.height!;
          const rgba = new Uint8ClampedArray(msg.rgbaBuffer!);

          // Draw to canvas for preview + download
          const canvas = canvasRef.current!;
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.putImageData(new ImageData(rgba, w, h), 0, 0);

          // Create blob URL for preview
          canvas.toBlob((blob) => {
            if (!blob) return;
            if (prevResultUrlRef.current) URL.revokeObjectURL(prevResultUrlRef.current);
            const url = URL.createObjectURL(blob);
            prevResultUrlRef.current = url;
            setResultUrl(url);
            setResultDims({ w, h });
            setStatus("done");
          }, "image/png");
          break;
        }

        case "error":
          setStatus("error");
          setErrorMsg(msg.message ?? "Unknown error");
          break;
      }
    };

    setStatus("loading");
    worker.postMessage({ type: "load" });

    return () => { worker.terminate(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── File handler ───────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (!workerRef.current) return;

    if (prevOrigUrlRef.current) URL.revokeObjectURL(prevOrigUrlRef.current);
    if (prevResultUrlRef.current) URL.revokeObjectURL(prevResultUrlRef.current);
    const url = URL.createObjectURL(file);
    prevOrigUrlRef.current = url;
    prevResultUrlRef.current = "";
    setOrigUrl(url);
    setResultUrl("");
    currentFileRef.current = file;

    // Get original dimensions
    const img = new Image();
    img.onload = () => {
      setOrigDims({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = url;

    setStatus("ready");
  }, []);

  // ─── Process (enhance) ─────────────────────────────────────────────────────
  const enhance = useCallback(() => {
    const file = currentFileRef.current;
    if (!file || !workerRef.current) return;

    setStatus("processing");
    file.arrayBuffer().then((imageBuffer) => {
      workerRef.current!.postMessage(
        { type: "process", data: { imageBuffer, mimeType: file.type, scale, denoise } },
        [imageBuffer]
      );
    });
  }, [scale, denoise]);

  // ─── Drag & drop / paste / input ───────────────────────────────────────────
  const onDragOver = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  useEffect(() => {
    const handler = (e: globalThis.ClipboardEvent) => {
      const img = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (img) handleFile(img.getAsFile()!);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [handleFile]);

  // ─── Download ───────────────────────────────────────────────────────────────
  const downloadPNG = () => {
    if (!canvasRef.current) return;
    const a = document.createElement("a");
    a.href = canvasRef.current.toDataURL("image/png");
    a.download = `upscaled-${scale}x.png`;
    a.click();
  };

  // ─── Reset ──────────────────────────────────────────────────────────────────
  const reset = () => {
    if (prevOrigUrlRef.current) URL.revokeObjectURL(prevOrigUrlRef.current);
    if (prevResultUrlRef.current) URL.revokeObjectURL(prevResultUrlRef.current);
    prevOrigUrlRef.current = "";
    prevResultUrlRef.current = "";
    currentFileRef.current = null;
    setOrigUrl("");
    setResultUrl("");
    setOrigDims({ w: 0, h: 0 });
    setResultDims({ w: 0, h: 0 });
    setStatus("ready");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Derived ────────────────────────────────────────────────────────────────
  const hasImage = !!origUrl && status !== "idle" && status !== "loading";

  // ─── JSX ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Privacy badge */}
      <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-2.5 text-sm text-green-700">
        <ShieldCheck size={16} className="shrink-0" />
        <span>{dict.privacyNote}</span>
      </div>

      {/* ── Loading model ── */}
      {(status === "idle" || status === "loading") && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center space-y-4">
          <Loader2 size={36} className="mx-auto animate-spin text-blue-500" />
          <p className="font-semibold text-gray-700">
            {loadPct < 5 ? dict.loadingModel : dict.downloadingModel.replace("{pct}", String(loadPct))}
          </p>
          {loadFile && (
            <p className="text-xs text-gray-400 truncate max-w-xs mx-auto">{loadFile}</p>
          )}
          <div className="mx-auto max-w-xs h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${loadPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{loadPct}%</p>
        </div>
      )}

      {/* ── Upload Zone ── */}
      {status === "ready" && !hasImage && (
        <div
          className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer
            ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40"}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-500">
            <Upload size={32} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-700">{dict.dropZone.heading}</p>
            <p className="mt-1 text-sm text-gray-400">{dict.dropZone.sub}</p>
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
              onClick={(ev) => { ev.stopPropagation(); fileInputRef.current?.click(); }}
            >
              {dict.selectFile}
            </button>
            <p className="text-xs text-gray-400">{dict.pasteHint}</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={onInputChange} />
        </div>
      )}

      {/* ── Settings + Preview (image loaded) ── */}
      {hasImage && status !== "error" && (
        <>
          {/* Original image preview */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <img
              src={origUrl}
              alt=""
              className="mx-auto max-h-64 rounded-xl object-contain"
            />
            <p className="mt-2 text-center text-xs text-gray-400">
              {dict.metrics.original}: {origDims.w} × {origDims.h}
            </p>
          </div>

          {/* Settings card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-5">
            {/* Scale selector */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">{dict.scale.label}</label>
              <div className="flex gap-2">
                {([2, 4] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScale(s)}
                    disabled={status === "processing"}
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors
                      ${scale === s
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300"}`}
                  >
                    {s === 2 ? dict.scale.x2 : dict.scale.x4}
                  </button>
                ))}
              </div>
            </div>

            {/* Denoise selector */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">{dict.denoise.label}</label>
              <div className="flex gap-2">
                {(["none", "low", "high"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDenoise(d)}
                    disabled={status === "processing"}
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors
                      ${denoise === d
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300"}`}
                  >
                    {dict.denoise[d]}
                  </button>
                ))}
              </div>
            </div>

            {/* Enhance button */}
            <button
              onClick={enhance}
              disabled={status === "processing"}
              className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {status === "processing" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  {dict.processing}
                </span>
              ) : (
                dict.enhance
              )}
            </button>
          </div>
        </>
      )}

      {/* ── Error ── */}
      {status === "error" && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
          <ImageOff size={28} className="mx-auto text-red-400" />
          <p className="font-semibold text-red-700">{dict.errorTitle}</p>
          <p className="text-sm text-red-500">{errorMsg}</p>
          <button
            onClick={reset}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-100 transition-colors"
          >
            {dict.newImage}
          </button>
        </div>
      )}

      {/* ── Result ── */}
      {status === "done" && resultUrl && (
        <div className="space-y-4">
          {/* Before / After comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Before */}
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <p className="mb-2 text-center text-xs font-semibold text-gray-500">{dict.beforeLabel}</p>
              <div className="relative overflow-hidden rounded-xl bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                <img src={origUrl} alt="" className="mx-auto max-h-56 object-contain" />
              </div>
              <p className="mt-2 text-center text-xs text-gray-400">{origDims.w} × {origDims.h}</p>
            </div>

            {/* After */}
            <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-3">
              <p className="mb-2 text-center text-xs font-semibold text-blue-600">{dict.afterLabel}</p>
              <div className="relative overflow-hidden rounded-xl bg-[repeating-conic-gradient(#e5e7eb_0%_25%,transparent_0%_50%)] bg-[length:16px_16px]">
                <img src={resultUrl} alt="" className="mx-auto max-h-56 object-contain" />
              </div>
              <p className="mt-2 text-center text-xs text-blue-600 font-medium">{resultDims.w} × {resultDims.h}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <button
              onClick={downloadPNG}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Download size={16} />
              {dict.downloadPNG}
            </button>
            <button
              onClick={reset}
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={16} />
              {dict.newImage}
            </button>
          </div>

          {/* Drop another image */}
          <div
            className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors cursor-pointer
              ${isDragging ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-gray-50/50 hover:border-blue-300"}`}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={20} className="text-gray-400" />
            <p className="text-sm text-gray-500">{dict.dropZone.heading}</p>
            <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={onInputChange} />
          </div>
        </div>
      )}
    </div>
  );
}
