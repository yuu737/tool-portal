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
  type ReactNode,
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
  Eraser,
  Paintbrush2,
  Wand2,
  Undo2,
  ZoomIn,
  ZoomOut,
  MousePointer2,
} from "lucide-react";
import type { Dictionary } from "@/lib/getDictionary";

type Props = { dict: Dictionary["backgroundRemover"] };

type Status =
  | "idle"        // component mounted, model not loaded
  | "loading"     // model download in progress
  | "ready"       // model loaded, waiting for image
  | "processing"  // AI inference running
  | "done"        // result available
  | "error";

type EditMode = "none" | "erase" | "restore" | "ai";

// ─── Pure utility functions ───────────────────────────────────────────────────

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
 * Build alpha channel from raw mask.
 * smooth → pre-blur; Otsu threshold; refine → soft-range; feather → post-blur.
 */
function buildCompositeAlpha(
  rawMask: Uint8Array,
  width: number,
  height: number,
  smooth: number,
  feather: number,
  refine: number
): Uint8Array<ArrayBuffer> {
  const thresh = otsuThreshold(rawMask);
  let mask: Uint8Array<ArrayBuffer> = rawMask.slice();

  if (smooth > 0) mask = boxBlur(mask, width, height, smooth);

  const softRange = (10 - refine) * 8;
  const lo = Math.max(0, thresh - softRange);
  const hi = Math.min(255, thresh + softRange);
  const range = hi - lo;
  for (let i = 0; i < mask.length; i++) {
    const v = mask[i];
    if (v <= lo) mask[i] = 0;
    else if (v >= hi) mask[i] = 255;
    else mask[i] = range > 0 ? Math.round((v - lo) / range * 255) : (v >= thresh ? 255 : 0);
  }

  if (feather > 0) mask = boxBlur(mask, width, height, feather * 2);
  return mask;
}

/** Map a pointer event to image-pixel coordinates on a canvas element. */
function toImgCoords(
  e: { clientX: number; clientY: number },
  canvas: HTMLCanvasElement
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.round((e.clientX - rect.left) / rect.width  * canvas.width),
    y: Math.round((e.clientY - rect.top)  / rect.height * canvas.height),
  };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BackgroundRemoverTool({ dict }: Props) {
  // ── state ──
  const [status,       setStatus]       = useState<Status>("idle");
  const [loadPct,      setLoadPct]      = useState(0);
  const [loadFile,     setLoadFile]     = useState("");
  const [errorMsg,     setErrorMsg]     = useState("");
  const [origUrl,      setOrigUrl]      = useState("");
  const [isDragging,   setIsDragging]   = useState(false);
  const [sliderPos,    setSliderPos]    = useState(50);
  const [isSliding,    setIsSliding]    = useState(false);
  const [bgType,       setBgType]       = useState<"transparent" | "white" | "black" | "custom">("transparent");
  const [customColor,  setCustomColor]  = useState("#00d4ff");
  const [smooth,       setSmooth]       = useState(0);
  const [feather,      setFeather]      = useState(0);
  const [refine,       setRefine]       = useState(0);
  // brush state
  const [editMode,     setEditMode]     = useState<EditMode>("none");
  const [brushSize,    setBrushSize]    = useState(20);
  const [zoom,         setZoom]         = useState(1);
  const [canUndo,      setCanUndo]      = useState(false);
  const [isAiRefining, setIsAiRefining] = useState(false);

  // ── core refs ──
  const workerRef          = useRef<Worker | null>(null);
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const innerContainerRef  = useRef<HTMLDivElement | null>(null);   // used for slider width
  const fileInputRef       = useRef<HTMLInputElement | null>(null);
  const prevOrigUrlRef     = useRef("");
  const maskDataRef        = useRef<Uint8Array | null>(null);       // raw AI mask (mutable for ROI)
  const origRGBARef        = useRef<Uint8ClampedArray | null>(null);
  const imgDimsRef         = useRef({ width: 0, height: 0 });

  // ── brush / overlay refs ──
  const computedAlphaRef   = useRef<Uint8Array | null>(null);       // cached alpha after edge-adjust
  const brushOverrideRef   = useRef<Uint8Array | null>(null);       // 0=AI, 1=force-erase, 2=force-restore
  const maskHistoryRef     = useRef<Uint8Array[]>([]);
  const brushCanvasRef     = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef       = useRef(false);
  const lastPosRef         = useRef<{ x: number; y: number } | null>(null);
  const aiRectStartRef     = useRef<{ x: number; y: number } | null>(null);
  const aiRectRef          = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  // ── stale-closure-safe refs for bg params (needed in renderCanvas called from event handlers) ──
  const bgTypeRef      = useRef(bgType);
  const customColorRef = useRef(customColor);
  const smoothRef      = useRef(smooth);
  const featherRef     = useRef(feather);
  const refineRef      = useRef(refine);
  const editModeRef    = useRef(editMode);
  const brushSizeRef   = useRef(brushSize);
  const isAiRefiningRef = useRef(isAiRefining);

  useEffect(() => { bgTypeRef.current      = bgType;      }, [bgType]);
  useEffect(() => { customColorRef.current = customColor; }, [customColor]);
  useEffect(() => { smoothRef.current      = smooth;      }, [smooth]);
  useEffect(() => { featherRef.current     = feather;     }, [feather]);
  useEffect(() => { refineRef.current      = refine;      }, [refine]);
  useEffect(() => { editModeRef.current    = editMode;    }, [editMode]);
  useEffect(() => { brushSizeRef.current   = brushSize;   }, [brushSize]);
  useEffect(() => { isAiRefiningRef.current = isAiRefining; }, [isAiRefining]);

  // ─── renderCanvas (imperative, reads only from refs) ──────────────────────
  const renderCanvas = useCallback(() => {
    const canvas = compositeCanvasRef.current;
    const orig   = origRGBARef.current;
    const alpha  = computedAlphaRef.current;
    if (!canvas || !orig || !alpha) return;

    const { width, height } = imgDimsRef.current;
    const override = brushOverrideRef.current;

    canvas.width  = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, width, height);

    const bg = bgTypeRef.current;
    if (bg !== "transparent") {
      ctx.fillStyle = bg === "custom" ? customColorRef.current : bg;
      ctx.fillRect(0, 0, width, height);
    }

    const composited = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      composited[i * 4]     = orig[i * 4];
      composited[i * 4 + 1] = orig[i * 4 + 1];
      composited[i * 4 + 2] = orig[i * 4 + 2];
      const ov = override ? override[i] : 0;
      composited[i * 4 + 3] = ov === 1 ? 0 : ov === 2 ? 255 : alpha[i];
    }

    const tmp = document.createElement("canvas");
    tmp.width  = width;
    tmp.height = height;
    tmp.getContext("2d")!.putImageData(
      new ImageData(composited as unknown as Uint8ClampedArray<ArrayBuffer>, width, height),
      0, 0
    );
    ctx.drawImage(tmp, 0, 0);
  }, []);

  // ─── updateComputed: recalculates edge-adjusted alpha, then renders ────────
  const updateComputed = useCallback(() => {
    const raw = maskDataRef.current;
    if (!raw) return;
    const { width, height } = imgDimsRef.current;
    computedAlphaRef.current = buildCompositeAlpha(
      raw, width, height,
      smoothRef.current, featherRef.current, refineRef.current
    );
    renderCanvas();
  }, [renderCanvas]);

  // ─── Brush helpers ────────────────────────────────────────────────────────

  const applyBrush = useCallback((cx: number, cy: number, mode: "erase" | "restore") => {
    const override = brushOverrideRef.current;
    if (!override) return;
    const { width, height } = imgDimsRef.current;
    const r  = Math.ceil(brushSizeRef.current / 2);
    const r2 = r * r;
    const val = mode === "erase" ? 1 : 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r2) continue;
        const px = cx + dx, py = cy + dy;
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        override[py * width + px] = val;
      }
    }
  }, []);

  const applyBrushLine = useCallback((
    x1: number, y1: number,
    x2: number, y2: number,
    mode: "erase" | "restore"
  ) => {
    const dx = x2 - x1, dy = y2 - y1;
    const dist = Math.hypot(dx, dy);
    const step = Math.max(brushSizeRef.current / 4, 1);
    const steps = Math.ceil(dist / step);
    for (let i = 0; i <= steps; i++) {
      const t = steps === 0 ? 0 : i / steps;
      applyBrush(Math.round(x1 + dx * t), Math.round(y1 + dy * t), mode);
    }
  }, [applyBrush]);

  /** Draw brush cursor / AI selection rect on the overlay canvas. */
  const drawOverlay = useCallback((imgX?: number, imgY?: number) => {
    const bc = brushCanvasRef.current;
    const cc = compositeCanvasRef.current;
    if (!bc || !cc) return;

    const rect = cc.getBoundingClientRect();
    bc.width  = rect.width;
    bc.height = rect.height;
    const ctx = bc.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, bc.width, bc.height);

    const mode    = editModeRef.current;
    const scaleX  = rect.width  / cc.width;
    const scaleY  = rect.height / cc.height;

    if (imgX !== undefined && imgY !== undefined && (mode === "erase" || mode === "restore")) {
      const cx = imgX * scaleX;
      const cy = imgY * scaleY;
      const r  = (brushSizeRef.current / 2) * scaleX;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = mode === "erase" ? "rgba(239,68,68,0.85)" : "rgba(34,197,94,0.85)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = mode === "erase" ? "rgba(239,68,68,0.12)" : "rgba(34,197,94,0.12)";
      ctx.fill();
    }

    if (mode === "ai") {
      // Crosshair cursor
      if (imgX !== undefined && imgY !== undefined) {
        const cx = imgX * scaleX;
        const cy = imgY * scaleY;
        ctx.strokeStyle = "rgba(99,102,241,0.85)";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
        ctx.stroke();
      }
      // Selection rectangle
      const rect2 = aiRectRef.current;
      if (rect2 && rect2.w > 2 && rect2.h > 2) {
        ctx.strokeStyle = "rgba(99,102,241,0.9)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(rect2.x * scaleX, rect2.y * scaleY, rect2.w * scaleX, rect2.h * scaleY);
        ctx.fillStyle = "rgba(99,102,241,0.08)";
        ctx.setLineDash([]);
        ctx.fillRect(rect2.x * scaleX, rect2.y * scaleY, rect2.w * scaleX, rect2.h * scaleY);
      }
    }
  }, []);

  const pushHistory = useCallback(() => {
    const ov = brushOverrideRef.current;
    if (!ov) return;
    const stack = maskHistoryRef.current;
    stack.push(ov.slice());
    if (stack.length > 20) stack.shift();
    setCanUndo(true);
  }, []);

  const undo = useCallback(() => {
    const stack = maskHistoryRef.current;
    const prev  = stack.pop();
    if (!prev) return;
    brushOverrideRef.current = prev;
    if (stack.length === 0) setCanUndo(false);
    renderCanvas();
  }, [renderCanvas]);

  const triggerAIROI = useCallback((x: number, y: number, w: number, h: number) => {
    if (!workerRef.current) return;
    workerRef.current.postMessage({ type: "roi", data: { x, y, w, h } });
    setIsAiRefining(true);
  }, []);

  // ─── Worker init ──────────────────────────────────────────────────────────
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
        maskPatch?: ArrayBuffer;
        x?: number;
        y?: number;
        w?: number;
        h?: number;
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
          // Init brush state
          brushOverrideRef.current = new Uint8Array(w * h);
          maskHistoryRef.current   = [];
          aiRectRef.current        = null;
          setCanUndo(false);
          setEditMode("none");
          setZoom(1);
          setIsAiRefining(false);
          // Set edge defaults (effect fires after these batched updates)
          setSmooth(1);
          setRefine(8);
          setFeather(1);
          setStatus("done");
          break;
        }

        case "roi-inferring":
          // isAiRefining already set by triggerAIROI, nothing extra needed
          break;

        case "roi-result": {
          const patch = new Uint8Array(msg.maskPatch!);
          const { x: px, y: py, w: pw, h: ph } = msg as Required<typeof msg>;
          const { width: imgW } = imgDimsRef.current;

          // Apply patch to raw mask
          if (maskDataRef.current) {
            for (let ry = 0; ry < ph; ry++) {
              for (let rx = 0; rx < pw; rx++) {
                const idx = (py + ry) * imgW + (px + rx);
                if (idx < maskDataRef.current.length) {
                  maskDataRef.current[idx] = patch[ry * pw + rx];
                }
              }
            }
            // Clear brush overrides in the refined region
            if (brushOverrideRef.current) {
              for (let ry = 0; ry < ph; ry++) {
                for (let rx = 0; rx < pw; rx++) {
                  const idx = (py + ry) * imgW + (px + rx);
                  if (idx < brushOverrideRef.current.length) {
                    brushOverrideRef.current[idx] = 0;
                  }
                }
              }
            }
          }

          // Recompute with current edge params (read from refs — no stale closure)
          const raw = maskDataRef.current;
          if (raw) {
            const { width, height } = imgDimsRef.current;
            computedAlphaRef.current = buildCompositeAlpha(
              raw, width, height,
              smoothRef.current, featherRef.current, refineRef.current
            );
            renderCanvas();
          }
          aiRectRef.current = null;
          setIsAiRefining(false);
          break;
        }

        case "error":
          // If error during ROI, just clear refining state (don't break the result view)
          if (isAiRefiningRef.current) {
            setIsAiRefining(false);
            aiRectRef.current = null;
          } else {
            setStatus("error");
            setErrorMsg(msg.message ?? "Unknown error");
          }
          break;
      }
    };

    setStatus("loading");
    worker.postMessage({ type: "load" });

    return () => { worker.terminate(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Re-composite when edge params or bg changes ──────────────────────────
  useEffect(() => {
    if (status !== "done") return;
    if (!maskDataRef.current || !origRGBARef.current) return;
    const { width, height } = imgDimsRef.current;
    computedAlphaRef.current = buildCompositeAlpha(
      maskDataRef.current, width, height,
      smooth, feather, refine
    );
    renderCanvas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, bgType, customColor, smooth, feather, refine, renderCanvas]);

  // ─── File handler ─────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (!workerRef.current) return;

    if (prevOrigUrlRef.current) URL.revokeObjectURL(prevOrigUrlRef.current);
    const url = URL.createObjectURL(file);
    prevOrigUrlRef.current = url;
    setOrigUrl(url);
    maskDataRef.current      = null;
    origRGBARef.current      = null;
    computedAlphaRef.current = null;
    brushOverrideRef.current = null;
    maskHistoryRef.current   = [];
    setCanUndo(false);
    setEditMode("none");
    setZoom(1);
    setIsAiRefining(false);
    setStatus("processing");

    file.arrayBuffer().then((imageBuffer) => {
      workerRef.current!.postMessage(
        { type: "process", data: { imageBuffer, mimeType: file.type } },
        [imageBuffer]
      );
    });
  }, []);

  // ─── Drag & drop / paste ──────────────────────────────────────────────────
  const onDragOver  = (e: DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onDrop      = (e: DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };
  const onPaste = useCallback((e: ClipboardEvent<HTMLDivElement>) => {
    const img = Array.from(e.clipboardData.items).find((i) => i.type.startsWith("image/"));
    if (img) handleFile(img.getAsFile()!);
  }, [handleFile]);

  useEffect(() => {
    const handler = (e: globalThis.ClipboardEvent) => {
      const img = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith("image/"));
      if (img) handleFile(img.getAsFile()!);
    };
    window.addEventListener("paste", handler);
    return () => window.removeEventListener("paste", handler);
  }, [handleFile]);

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  // ─── Canvas pointer handlers ──────────────────────────────────────────────
  const onCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editMode === "none") {
      // Before/after slider
      setIsSliding(true);
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    if (!compositeCanvasRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toImgCoords(e, compositeCanvasRef.current);

    if (editMode === "erase" || editMode === "restore") {
      pushHistory();
      isDrawingRef.current = true;
      lastPosRef.current   = { x, y };
      applyBrush(x, y, editMode);
      renderCanvas();
    } else if (editMode === "ai") {
      if (isAiRefiningRef.current) return;
      isDrawingRef.current  = true;
      aiRectStartRef.current = { x, y };
      aiRectRef.current      = { x, y, w: 0, h: 0 };
      drawOverlay(x, y);
    }
  };

  const onCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (editMode === "none") {
      if (!isSliding || !innerContainerRef.current) return;
      const rect = innerContainerRef.current.getBoundingClientRect();
      const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      setSliderPos(xRatio * 100);
      return;
    }
    if (!compositeCanvasRef.current) return;
    const { x, y } = toImgCoords(e, compositeCanvasRef.current);

    if (editMode === "erase" || editMode === "restore") {
      drawOverlay(x, y);
      if (isDrawingRef.current && lastPosRef.current) {
        applyBrushLine(lastPosRef.current.x, lastPosRef.current.y, x, y, editMode);
        lastPosRef.current = { x, y };
        renderCanvas();
      }
    } else if (editMode === "ai") {
      if (isDrawingRef.current && aiRectStartRef.current) {
        const sx = aiRectStartRef.current.x;
        const sy = aiRectStartRef.current.y;
        aiRectRef.current = {
          x: Math.min(sx, x),
          y: Math.min(sy, y),
          w: Math.abs(x - sx),
          h: Math.abs(y - sy),
        };
      }
      drawOverlay(x, y);
    }
  };

  const onCanvasPointerUp = () => {
    if (editMode === "none") {
      setIsSliding(false);
      return;
    }
    isDrawingRef.current = false;
    lastPosRef.current   = null;

    if (editMode === "ai") {
      const r = aiRectRef.current;
      if (r && r.w > 5 && r.h > 5 && !isAiRefiningRef.current) {
        triggerAIROI(r.x, r.y, r.w, r.h);
      } else {
        aiRectRef.current = null;
        drawOverlay();
      }
    }
  };

  const onCanvasPointerLeave = () => {
    if (editMode !== "none") drawOverlay(); // clear cursor
  };

  // ─── Download / reset ─────────────────────────────────────────────────────
  const downloadPNG = () => {
    if (!compositeCanvasRef.current) return;
    const a = document.createElement("a");
    a.href = compositeCanvasRef.current.toDataURL("image/png");
    a.download = "background-removed.png";
    a.click();
  };

  const reset = () => {
    if (prevOrigUrlRef.current) URL.revokeObjectURL(prevOrigUrlRef.current);
    prevOrigUrlRef.current   = "";
    setOrigUrl("");
    maskDataRef.current      = null;
    origRGBARef.current      = null;
    computedAlphaRef.current = null;
    brushOverrideRef.current = null;
    maskHistoryRef.current   = [];
    setCanUndo(false);
    setEditMode("none");
    setZoom(1);
    setIsAiRefining(false);
    setStatus("ready");
    setSmooth(0);
    setFeather(0);
    setRefine(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── updateComputed helper exposed to edge-param sliders ──────────────────
  // (Just calling updateComputed is enough; the effect also handles it.
  //  Here we expose it as a stable callback for clarity.)

  // ── derived flags ──
  const isReady = status === "ready" || status === "done";
  const isDone  = status === "done";

  // ─── Brush toolbar helpers ────────────────────────────────────────────────
  const brushModes: { mode: EditMode; label: string; icon: ReactNode }[] = [
    { mode: "none",    label: dict.brush.none,    icon: <MousePointer2 size={14} /> },
    { mode: "erase",   label: dict.brush.erase,   icon: <Eraser size={14} /> },
    { mode: "restore", label: dict.brush.restore, icon: <Paintbrush2 size={14} /> },
    { mode: "ai",      label: dict.brush.ai,      icon: <Wand2 size={14} /> },
  ];

  // ─── JSX ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6" onPaste={onPaste}>
      {/* Privacy badge */}
      <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-2.5 text-sm text-green-700">
        <ShieldCheck size={16} className="shrink-0" />
        <span>{dict.privacyNote}</span>
      </div>

      {/* ── Loading model ── */}
      {(status === "idle" || status === "loading") && (
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-8 text-center space-y-4">
          <Loader2 size={36} className="mx-auto animate-spin text-indigo-500" />
          <p className="font-semibold text-gray-700">
            {loadPct < 5 ? dict.loadingModel : dict.downloadingModel.replace("{pct}", String(loadPct))}
          </p>
          {loadFile && (
            <p className="text-xs text-gray-400 truncate max-w-xs mx-auto">{loadFile}</p>
          )}
          <div className="mx-auto max-w-xs h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${loadPct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400">{loadPct}%</p>
        </div>
      )}

      {/* ── Upload Zone ── */}
      {status === "ready" && (
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
              onClick={(ev) => { ev.stopPropagation(); fileInputRef.current?.click(); }}
            >
              {dict.selectFile}
            </button>
            <p className="text-xs text-gray-400">{dict.pasteHint}</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={onInputChange} />
        </div>
      )}

      {/* ── Processing ── */}
      {status === "processing" && (
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-8 text-center space-y-3">
          {origUrl && (
            <img src={origUrl} alt="" className="mx-auto max-h-40 rounded-xl object-contain opacity-50 blur-sm" />
          )}
          <Loader2 size={28} className="mx-auto animate-spin text-indigo-500" />
          <p className="font-semibold text-indigo-700">{dict.processing}</p>
        </div>
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
      {isDone && (
        <>
          {/* ── Brush toolbar ── */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Mode buttons */}
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 mr-1">{dict.brush.label}</span>
                {brushModes.map(({ mode, label, icon }) => (
                  <button
                    key={mode}
                    onClick={() => setEditMode(mode)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
                      ${editMode === mode
                        ? mode === "erase"   ? "border-red-400   bg-red-50   text-red-700"
                        : mode === "restore" ? "border-green-400 bg-green-50 text-green-700"
                        : mode === "ai"      ? "border-indigo-400 bg-indigo-50 text-indigo-700"
                        :                     "border-gray-400  bg-white    text-gray-700"
                        : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"}`}
                  >
                    {icon}
                    {label}
                  </button>
                ))}
              </div>

              {/* Undo + Zoom */}
              <div className="flex items-center gap-2">
                <button
                  onClick={undo}
                  disabled={!canUndo}
                  title={dict.brush.undo}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Undo2 size={13} />
                  {dict.brush.undo}
                </button>
                <div className="flex items-center rounded-lg border border-gray-300 bg-white overflow-hidden">
                  <button
                    onClick={() => setZoom((z) => Math.max(0.5, parseFloat((z - 0.5).toFixed(1))))}
                    className="p-1.5 hover:bg-gray-100 transition-colors"
                    title={dict.brush.zoom}
                  >
                    <ZoomOut size={14} className="text-gray-600" />
                  </button>
                  <span className="px-2 text-xs tabular-nums text-gray-600 min-w-[3rem] text-center">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom((z) => Math.min(4, parseFloat((z + 0.5).toFixed(1))))}
                    className="p-1.5 hover:bg-gray-100 transition-colors"
                    title={dict.brush.zoom}
                  >
                    <ZoomIn size={14} className="text-gray-600" />
                  </button>
                </div>
              </div>
            </div>

            {/* Brush size (erase / restore) */}
            {(editMode === "erase" || editMode === "restore") && (
              <label className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 shrink-0">{dict.brush.size}</span>
                <input
                  type="range" min={4} max={120} value={brushSize}
                  onChange={(e) => setBrushSize(Number(e.target.value))}
                  className="flex-1 accent-indigo-600"
                />
                <span className="text-xs tabular-nums text-gray-500 w-8 text-right">{brushSize}</span>
              </label>
            )}

            {/* AI mode hint */}
            {editMode === "ai" && (
              <p className="text-xs text-indigo-600">{dict.brush.aiHint}</p>
            )}
          </div>

          {/* ── Canvas area ── */}
          <div className="space-y-2">
            {editMode === "none" && (
              <div className="flex items-center justify-between text-xs text-gray-400 px-1">
                <span>{dict.beforeLabel}</span>
                <span className="flex items-center gap-1">
                  <ChevronsLeftRight size={12} />
                  {dict.dragToCompare}
                </span>
                <span>{dict.afterLabel}</span>
              </div>
            )}

            {/* Scrollable zoom container */}
            <div
              className="overflow-auto rounded-2xl border border-gray-200 select-none"
              style={{
                maxHeight: "70vh",
                background: "repeating-conic-gradient(#e5e7eb 0% 25%, #fff 0% 50%) 50% / 20px 20px",
              }}
            >
              {/* Inner: relative so overlays can be positioned inside */}
              <div
                ref={innerContainerRef}
                className="relative"
                style={{
                  width: `${zoom * 100}%`,
                  minWidth: "100%",
                  cursor:
                    editMode === "none"    ? "ew-resize"
                    : editMode === "ai"    ? "crosshair"
                    : "none",
                }}
                onPointerDown={onCanvasPointerDown}
                onPointerMove={onCanvasPointerMove}
                onPointerUp={onCanvasPointerUp}
                onPointerLeave={onCanvasPointerLeave}
              >
                {/* Result canvas */}
                <canvas
                  ref={compositeCanvasRef}
                  className="block w-full h-auto"
                />

                {/* Before (original) — only in slider mode */}
                {editMode === "none" && (
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
                )}

                {/* Slider divider — only in slider mode */}
                {editMode === "none" && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(0,0,0,0.4)] pointer-events-none"
                    style={{ left: `${sliderPos}%`, transform: "translateX(-50%)" }}
                  >
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md">
                      <ChevronsLeftRight size={16} className="text-gray-600" />
                    </div>
                  </div>
                )}

                {/* Brush / AI selection overlay canvas */}
                {editMode !== "none" && (
                  <canvas
                    ref={brushCanvasRef}
                    className="absolute inset-0 w-full h-full pointer-events-none"
                  />
                )}

                {/* AI refining spinner overlay */}
                {isAiRefining && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 pointer-events-none rounded-2xl">
                    <Loader2 size={28} className="animate-spin text-white" />
                    <p className="text-sm font-semibold text-white">{dict.brush.aiRefining}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Controls row ── */}
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
                      <span className="h-3.5 w-3.5 rounded-sm border border-gray-300"
                        style={{ background: "repeating-conic-gradient(#ccc 0% 25%,#fff 0% 50%) 50%/6px 6px" }} />
                    ) : opt === "custom" ? (
                      <span className="h-3.5 w-3.5 rounded-sm border border-gray-300" style={{ background: customColor }} />
                    ) : (
                      <span className="h-3.5 w-3.5 rounded-sm border border-gray-300" style={{ background: opt }} />
                    )}
                    {dict.bgColor[opt]}
                  </button>
                ))}
              </div>
              {bgType === "custom" && (
                <div className="flex items-center gap-2">
                  <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)}
                    className="h-8 w-14 cursor-pointer rounded border border-gray-300" />
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
                  <input type="range" min={0} max={10} value={val}
                    onChange={(e) => set(Number(e.target.value))}
                    className="flex-1 accent-indigo-600" />
                  <span className="w-6 text-right text-xs tabular-nums text-gray-500">{val}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Action buttons ── */}
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

          {/* ── Drop another image ── */}
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
              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={onInputChange} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
