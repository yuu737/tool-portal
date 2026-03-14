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
type Mode = 1 | 2 | 4;

const MAX_INPUT = 256;

export default function ImageUpscalerTool({ dict }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [progress, setProgress] = useState({ total: 0, done: 0 });

  const [mode, setMode] = useState<Mode>(2);

  const [origUrl, setOrigUrl] = useState("");
  const [resultUrl, setResultUrl] = useState("");
  const [origDims, setOrigDims] = useState({ w: 0, h: 0 });
  const [resultDims, setResultDims] = useState({ w: 0, h: 0 });

  const [isDragging, setIsDragging] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
        pngBuffer?: ArrayBuffer;
        width?: number;
        height?: number;
        message?: string;
        total?: number;
        done?: number;
      };

      switch (msg.type) {
        case "loading":
          setStatus("loading");
          break;
        case "loaded":
          setStatus("ready");
          break;
        case "inferring":
          setProgress({ total: msg.total ?? 0, done: msg.done ?? 0 });
          break;
        case "result": {
          const w = msg.width!;
          const h = msg.height!;
          const blob = new Blob([msg.pngBuffer!], { type: "image/png" });
          if (prevResultUrlRef.current)
            URL.revokeObjectURL(prevResultUrlRef.current);
          const url = URL.createObjectURL(blob);
          prevResultUrlRef.current = url;
          setResultUrl(url);
          setResultDims({ w, h });
          setStatus("done");
          break;
        }
        case "error":
          setStatus("error");
          setErrorMsg(msg.message ?? "Unknown error");
          break;
      }
    };

    // Preload model
    worker.postMessage({ type: "load" });

    return () => { worker.terminate(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── File handler ───────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;

    if (prevOrigUrlRef.current) URL.revokeObjectURL(prevOrigUrlRef.current);
    if (prevResultUrlRef.current) URL.revokeObjectURL(prevResultUrlRef.current);
    const url = URL.createObjectURL(file);
    prevOrigUrlRef.current = url;
    prevResultUrlRef.current = "";
    setOrigUrl(url);
    setResultUrl("");
    currentFileRef.current = file;

    const img = new Image();
    img.onload = () => setOrigDims({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;

    setStatus((prev) => (prev === "loading" ? "loading" : "ready"));
  }, []);

  // ─── Process ────────────────────────────────────────────────────────────────
  const enhance = useCallback(() => {
    const file = currentFileRef.current;
    if (!file || !workerRef.current) return;
    setStatus("processing");
    setProgress({ total: 0, done: 0 });
    file.arrayBuffer().then((imageBuffer) => {
      workerRef.current!.postMessage(
        { type: "process", data: { imageBuffer, mimeType: file.type, mode, maxInput: MAX_INPUT } },
        [imageBuffer]
      );
    });
  }, [mode]);

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
    if (!resultUrl) return;
    const a = document.createElement("a");
    a.href = resultUrl;
    a.download = "upscaled.png";
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
    setProgress({ total: 0, done: 0 });
    setStatus((prev) => (prev === "loading" ? "loading" : "ready"));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hasImage = !!origUrl;
  const isModelLoading = status === "loading" || status === "idle";
  const canProcess = hasImage && !isModelLoading && status !== "processing";

  return (
    <div className="space-y-6">
      {/* Privacy badge */}
      <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-2.5 text-sm text-green-700">
        <ShieldCheck size={16} className="shrink-0" />
        <span>{dict.privacyNote}</span>
      </div>

      {/* Model loading indicator */}
      {isModelLoading && (
        <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
          <Loader2 size={16} className="shrink-0 animate-spin" />
          <span>{dict.loadingModel}</span>
        </div>
      )}

      {/* ── Upload Zone ── */}
      {!hasImage && (
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

      {/* ── Image loaded ── */}
      {hasImage && status !== "error" && (
        <>
          {/* Original preview */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <img src={origUrl} alt="" className="mx-auto max-h-64 rounded-xl object-contain" />
            <p className="mt-2 text-center text-xs text-gray-400">
              {dict.metrics.original}: {origDims.w} × {origDims.h}
            </p>
          </div>

          {/* Settings */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700">{dict.mode.label}</label>
              <div className="flex gap-2">
                {([1, 2, 4] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    disabled={status === "processing"}
                    className={`flex-1 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors
                      ${mode === m
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-blue-300"}`}
                  >
                    {m === 1 ? dict.mode.x1 : m === 2 ? dict.mode.x2 : dict.mode.x4}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400">{dict.mode.hint}</p>
            </div>

            <button
              onClick={enhance}
              disabled={!canProcess}
              className="w-full rounded-xl bg-blue-600 py-3.5 text-base font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {status === "processing" ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  {progress.total > 0
                    ? `${dict.processing} (${progress.done}/${progress.total})`
                    : dict.processing}
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
          <button onClick={reset} className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-600 hover:bg-red-100 transition-colors">
            {dict.newImage}
          </button>
        </div>
      )}

      {/* ── Result ── */}
      {status === "done" && resultUrl && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-200 bg-white p-3">
              <p className="mb-2 text-center text-xs font-semibold text-gray-500">{dict.beforeLabel}</p>
              <img src={origUrl} alt="" className="mx-auto max-h-56 rounded-xl object-contain" />
              <p className="mt-2 text-center text-xs text-gray-400">{origDims.w} × {origDims.h}</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/30 p-3">
              <p className="mb-2 text-center text-xs font-semibold text-blue-600">{dict.afterLabel}</p>
              <img src={resultUrl} alt="" className="mx-auto max-h-56 rounded-xl object-contain" />
              <p className="mt-2 text-center text-xs text-blue-600 font-medium">{resultDims.w} × {resultDims.h}</p>
            </div>
          </div>

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
