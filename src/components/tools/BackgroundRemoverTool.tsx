"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
  type DragEvent,
  type ClipboardEvent,
  type ChangeEvent,
} from "react";
import {
  Upload,
  Download,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  ChevronsLeftRight,
  Loader2,
  ImageOff,
} from "lucide-react";
import type { Dictionary } from "@/lib/getDictionary";

type Props = { dict: Dictionary["backgroundRemover"] };

type Status =
  | "idle"      // component mounted, model not yet loaded
  | "loading"   // model download in progress
  | "ready"     // model loaded, waiting for image
  | "processing" // AI inference running
  | "done"      // result available
  | "error";

// ---------- Pure utility functions (no DOM deps) ----------

function boxBlur(
  src: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array<ArrayBuffer> {
  if (radius <= 0) return src.slice();
  const tmp = new Uint8Array(src.length);
  const out = new Uint8Array(src.length);
  const r = Math.round(radius);

  // Horizontal
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, cnt = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < width) { sum += src[y * width + nx]; cnt++; }
      }
      tmp[y * width + x] = sum / cnt;
    }
  }
  // Vertical
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0, cnt = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < height) { sum += tmp[ny * width + x]; cnt++; }
      }
      out[y * width + x] = sum / cnt;
    }
  }
  return out;
}

/** Otsu's method: find threshold that maximises between-class variance. */
function otsuThreshold(mask: Uint8Array | Uint8Array<ArrayBuffer>): number {
  const hist = new Int32Array(256);
  for (let i = 0; i < mask.length; i++) hist[mask[i]]++;
  const n = mask.length;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sumB = 0, maxVar = 0, best = 127;
  for (let i = 0; i < 256; i++) {
    wB += hist[i];
    if (wB === 0 || wB === n) continue;
    const wF = n - wB;
    sumB += i * hist[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const v = wB * wF * (mB - mF) ** 2;
    if (v > maxVar) { maxVar = v; best = i; }
  }
  return best;
}

/**
 * Build composited RGBA from raw mask using:
 *  1. smooth – box-blur the mask before thresholding (noise reduction)
 *  2. Otsu threshold  – auto-computed from the raw mask
 *  3. refine  – controls soft-range around the threshold
 *               (0 = very soft ±80, 10 = hard binary ±0)
 *  4. feather – box-blur after thresholding (edge softening)
 */
function buildComposite(
  origRGBA: Uint8ClampedArray,
  rawMask: Uint8Array,
  width: number,
  height: number,
  smooth: number,
  feather: number,
  refine: number
): Uint8ClampedArray {
  // Otsu on the raw mask (bimodal distribution is clearest before blur)
  const thresh = otsuThreshold(rawMask);

  // Pre-threshold smooth
  let mask: Uint8Array<ArrayBuffer> = rawMask.slice();
  if (smooth > 0) mask = boxBlur(mask, width, height, smooth);

  // Threshold clamp with softness controlled by refine
  const softRange = (10 - refine) * 8;           // refine=10 → 0, refine=0 → 80
  const lo = Math.max(0, thresh - softRange);
  const hi = Math.min(255, thresh + softRange);
  const range = hi - lo;
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i];
    if (v <= lo) mask[i] = 0;
    else if (v >= hi) mask[i] = 255;
    else mask[i] = range > 0 ? Math.round((v - lo) / range * 255) : (v >= thresh ? 255 : 0);
  }

  // Post-threshold feather (soften the hard boundary)
  if (feather > 0) mask = boxBlur(mask, width, height, feather * 2);

  const result = new Uint8ClampedArray(origRGBA.length);
  for (let i = 0; i < width * height; i++) {
    result[i * 4]     = origRGBA[i * 4];
    result[i * 4 + 1] = origRGBA[i * 4 + 1];
    result[i * 4 + 2] = origRGBA[i * 4 + 2];
    result[i * 4 + 3] = mask[i];
  }
  return result;
}

function drawToCanvas(
  canvas: HTMLCanvasElement,
  composited: Uint8ClampedArray,
  width: number,
  height: number,
  bgType: string,
  customColor: string
): void {
  canvas.width  = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);

  if (bgType !== "transparent") {
    ctx.fillStyle = bgType === "custom" ? customColor : bgType;
    ctx.fillRect(0, 0, width, height);
  }

  const tmp = document.createElement("canvas");
  tmp.width  = width;
  tmp.height = height;
  tmp.getContext("2d")!.putImageData(new ImageData(composited as unknown as Uint8ClampedArray<ArrayBuffer>, width, height), 0, 0);
  ctx.drawImage(tmp, 0, 0);
}

// ---------- Component ----------

export default function BackgroundRemoverTool({ dict }: Props) {
  const [status,      setStatus]      = useState<Status>("idle");
  const [loadPct,     setLoadPct]     = useState(0);
  const [loadFile,    setLoadFile]    = useState("");
  const [errorMsg,    setErrorMsg]    = useState("");
  const [origUrl,     setOrigUrl]     = useState("");
  const [isDragging,  setIsDragging]  = useState(false);
  const [sliderPos,   setSliderPos]   = useState(50);
  const [isSliding,   setIsSliding]   = useState(false);
  const [bgType,      setBgType]      = useState<"transparent" | "white" | "black" | "custom">("transparent");
  const [customColor, setCustomColor] = useState("#00d4ff");
  const [smooth,      setSmooth]      = useState(0);
  const [feather,     setFeather]     = useState(0);
  const [refine,      setRefine]      = useState(0);

  const workerRef         = useRef<Worker | null>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sliderContainerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef      = useRef<HTMLInputElement | null>(null);
  const prevOrigUrlRef    = useRef("");
  const maskDataRef       = useRef<Uint8Array | null>(null);
  const origRGBARef       = useRef<Uint8ClampedArray | null>(null);
  const imgDimsRef        = useRef({ width: 0, height: 0 });

  // -- Initialise worker and auto-load model on mount --
  useEffect(() => {
    const worker = new Worker(
      new URL("./workers/bgRemoverWorker.ts", import.meta.url)
    );
    workerRef.current = worker;

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data as {
        type: string;
        progress?: number;
        file?: string;
        message?: string;
        maskBuffer?: ArrayBuffer;
        origBuffer?: ArrayBuffer;
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
          maskDataRef.current  = new Uint8Array(msg.maskBuffer!);
          origRGBARef.current  = new Uint8ClampedArray(msg.origBuffer!);
          imgDimsRef.current   = { width: w, height: h };
          // Auto-apply optimal defaults for clean separation:
          //   smooth=1  : light pre-blur to reduce mask noise
          //   refine=8  : hard threshold (softRange=16) → removes faint bg residue
          //   feather=1 : slight post-blur for natural edges
          setSmooth(1);
          setRefine(8);
          setFeather(1);
          setStatus("done");
          break;
        }
        case "error":
          setStatus("error");
          setErrorMsg(msg.message ?? "Unknown error");
          break;
      }
    };

    // Start loading immediately
    setStatus("loading");
    worker.postMessage({ type: "load" });

    return () => { worker.terminate(); };
  }, []);

  // -- Re-composite when result data or display params change --
  useEffect(() => {
    if (status !== "done") return;
    const { width, height } = imgDimsRef.current;
    if (!maskDataRef.current || !origRGBARef.current || !compositeCanvasRef.current) return;

    const composited = buildComposite(
      origRGBARef.current,
      maskDataRef.current,
      width, height,
      smooth, feather, refine
    );
    drawToCanvas(
      compositeCanvasRef.current,
      composited, width, height,
      bgType, customColor
    );
  }, [status, bgType, customColor, smooth, feather, refine]);

  // -- File handler --
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (!workerRef.current) return;

    // Revoke previous URL
    if (prevOrigUrlRef.current) URL.revokeObjectURL(prevOrigUrlRef.current);
    const url = URL.createObjectURL(file);
    prevOrigUrlRef.current = url;
    setOrigUrl(url);
    maskDataRef.current  = null;
    origRGBARef.current  = null;
    setStatus("processing");

    // Downscale to max 1536px before inference.
    // RMBG-1.4 processes at 1024×1024 internally, so sending a 6000×4000 image
    // just wastes decode/encode time without any quality benefit.
    const MAX_SIDE = 1536;
    (async () => {
      let imageBuffer: ArrayBuffer;
      let mimeType: string;

      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      if (scale < 1) {
        const w = Math.round(bitmap.width * scale);
        const h = Math.round(bitmap.height * scale);
        const cv = Object.assign(document.createElement("canvas"), { width: w, height: h });
        cv.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
        bitmap.close();
        imageBuffer = await new Promise<ArrayBuffer>((res, rej) =>
          cv.toBlob((b) => (b ? b.arrayBuffer().then(res) : rej(new Error("toBlob failed"))), "image/png")
        );
        mimeType = "image/png";
      } else {
        bitmap.close();
        imageBuffer = await file.arrayBuffer();
        mimeType = file.type;
      }

      workerRef.current!.postMessage(
        { type: "process", data: { imageBuffer, mimeType } },
        [imageBuffer]
      );
    })();
  }, []);

  // -- Drag & Drop --
  const onDragOver  = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = ()              => setIsDragging(false);
  const onDrop      = (e: DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  // -- Paste --
  const onPaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    const items = Array.from(e.clipboardData.items);
    const img = items.find((i) => i.type.startsWith("image/"));
    if (img) handleFile(img.getAsFile()!);
  }, [handleFile]);

  // Global paste listener
  useEffect(() => {
    const handler = (e: globalThis.ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const img = items.find((i) => i.type.startsWith("image/"));
      if (img) handleFile(img.getAsFile()!);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [handleFile]);

  // -- Input change --
  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  // -- Before/After slider --
  const onSliderPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setIsSliding(true);
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
  };
  const onSliderPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!isSliding || !sliderContainerRef.current) return;
    const rect = sliderContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSliderPos(x * 100);
  };
  const onSliderPointerUp = () => setIsSliding(false);

  // -- Download --
  const downloadPNG = () => {
    if (!compositeCanvasRef.current) return;
    const a = document.createElement("a");
    a.href = compositeCanvasRef.current.toDataURL("image/png");
    a.download = "background-removed.png";
    a.click();
  };

  // -- Reset --
  const reset = () => {
    if (prevOrigUrlRef.current) URL.revokeObjectURL(prevOrigUrlRef.current);
    prevOrigUrlRef.current = "";
    setOrigUrl("");
    maskDataRef.current = null;
    origRGBARef.current = null;
    setStatus("ready");
    setSmooth(0);
    setFeather(0);
    setRefine(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ===================== RENDER =====================

  const isReady  = status === "ready"  || status === "done";
  const isDone   = status === "done";

  return (
    <div className="space-y-6" onPaste={onPaste}>
      {/* Privacy badge */}
      <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-2.5 text-sm text-green-700">
        <ShieldCheck size={16} className="shrink-0" />
        <span>{dict.privacyNote}</span>
      </div>

      {/* ---- Loading model ---- */}
      {(status === "idle" || status === "loading") && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center space-y-4">
          <Loader2 size={36} className="mx-auto animate-spin text-indigo-500" />
          <p className="font-semibold text-gray-700">
            {loadPct < 5 ? dict.loadingModel : dict.downloadingModel.replace("{pct}", String(loadPct))}
          </p>
          {loadFile && (
            <p className="text-xs text-gray-400 truncate max-w-xs mx-auto">{loadFile}</p>
          )}
          {/* Progress bar */}
          <div className="mx-auto max-w-xs h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${loadPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{loadPct}%</p>
        </div>
      )}

      {/* ---- Upload Zone (ready & no image yet) ---- */}
      {(status === "ready") && (
        <div
          className={`relative flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed p-12 text-center transition-colors cursor-pointer
            ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40"}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-500">
            <Upload size={32} strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-700">{dict.dropZone.heading}</p>
            <p className="mt-1 text-sm text-gray-400">{dict.dropZone.sub}</p>
          </div>
          <div className="flex flex-col gap-1">
            <button
              type="button"
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              {dict.selectFile}
            </button>
            <p className="text-xs text-gray-400">{dict.pasteHint}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={onInputChange}
          />
        </div>
      )}

      {/* ---- Processing ---- */}
      {status === "processing" && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-8 text-center space-y-3">
          {origUrl && (
            <img src={origUrl} alt="" className="mx-auto max-h-40 rounded-xl object-contain opacity-50 blur-sm" />
          )}
          <Loader2 size={28} className="mx-auto animate-spin text-indigo-500" />
          <p className="font-semibold text-indigo-700">{dict.processing}</p>
        </div>
      )}

      {/* ---- Error ---- */}
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

      {/* ---- Result: Before/After comparison ---- */}
      {isDone && (
        <>
          {/* Comparison slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400 px-1">
              <span>{dict.beforeLabel}</span>
              <span className="flex items-center gap-1">
                <ChevronsLeftRight size={12} />
                {dict.dragToCompare}
              </span>
              <span>{dict.afterLabel}</span>
            </div>

            <div
              ref={sliderContainerRef}
              className="relative overflow-hidden rounded-2xl border border-gray-200 select-none cursor-ew-resize"
              style={{
                background: "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 20px 20px",
              }}
              onPointerDown={onSliderPointerDown}
              onPointerMove={onSliderPointerMove}
              onPointerUp={onSliderPointerUp}
            >
              {/* After (result) — full width, underneath */}
              <canvas
                ref={compositeCanvasRef}
                className="block w-full h-auto"
                style={{ maxHeight: "60vh", objectFit: "contain" }}
              />

              {/* Before (original) — clipped to left side */}
              <div
                className="absolute inset-0 overflow-hidden pointer-events-none"
                style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
              >
                <img
                  src={origUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>

              {/* Divider */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)] pointer-events-none"
                style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
              >
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
                  <ChevronsLeftRight size={16} className="text-gray-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Controls row */}
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Background color */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <SlidersHorizontal size={14} />
                {dict.bgColor.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {(["transparent", "white", "black", "custom"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setBgType(opt)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
                      ${bgType === opt
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-300 bg-white text-gray-600 hover:border-indigo-300"}`}
                  >
                    {opt === "transparent" ? (
                      <span
                        className="h-3.5 w-3.5 rounded-sm border border-gray-300"
                        style={{ background: "repeating-conic-gradient(#ccc 0% 25%,#fff 0% 50%) 50%/6px 6px" }}
                      />
                    ) : opt === "custom" ? (
                      <span
                        className="h-3.5 w-3.5 rounded-sm border border-gray-300"
                        style={{ background: customColor }}
                      />
                    ) : (
                      <span
                        className="h-3.5 w-3.5 rounded-sm border border-gray-300"
                        style={{ background: opt }}
                      />
                    )}
                    {dict.bgColor[opt]}
                  </button>
                ))}
              </div>
              {bgType === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="h-8 w-14 cursor-pointer rounded border border-gray-300"
                  />
                  <span className="text-xs font-mono text-gray-500">{customColor}</span>
                </div>
              )}
            </div>

            {/* Edge adjustment */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <SlidersHorizontal size={14} />
                {dict.edgeAdjust.label}
              </p>
              {(
                [
                  { key: "smooth" as const,  val: smooth,  set: setSmooth,  label: dict.edgeAdjust.smooth  },
                  { key: "feather" as const, val: feather, set: setFeather, label: dict.edgeAdjust.feather },
                  { key: "refine" as const,  val: refine,  set: setRefine,  label: dict.edgeAdjust.refine  },
                ] as const
              ).map(({ val, set, label }) => (
                <label key={label} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs text-gray-500">{label}</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={val}
                    onChange={(e) => set(Number(e.target.value))}
                    className="flex-1 accent-indigo-600"
                  />
                  <span className="w-6 text-right text-xs tabular-nums text-gray-500">{val}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={downloadPNG}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <Download size={16} />
              {dict.downloadPNG}
            </button>
            <button
              onClick={reset}
              className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RefreshCw size={15} />
              {dict.newImage}
            </button>
          </div>

          {/* Drop another image hint */}
          {isReady && isDone && (
            <div
              className={`rounded-xl border-2 border-dashed p-4 text-center text-sm text-gray-400 transition-colors cursor-pointer
                ${isDragging ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {dict.dropZone.sub}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={onInputChange}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
