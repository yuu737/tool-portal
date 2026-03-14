/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers";

// ─── Runtime config ──────────────────────────────────────────────────────────
(env as any).allowLocalModels = false;
(env as any).useBrowserCache = true;

// Disable WASM proxy — not needed inside a dedicated Worker
(env as any).backends.onnx.wasm.proxy = false;

const MODEL_ID = "briaai/RMBG-1.4";

// ─── Device detection ────────────────────────────────────────────────────────

async function detectDevice(): Promise<"webgpu" | "wasm"> {
  if (typeof navigator !== "undefined" && (navigator as any).gpu) {
    try {
      const adapter = await (navigator as any).gpu.requestAdapter();
      if (adapter) return "webgpu";
    } catch {
      // fall through to wasm
    }
  }
  return "wasm";
}

// ─── Model singleton ─────────────────────────────────────────────────────────

let model: any = null;
let processor: any = null;
let activeDevice: "webgpu" | "wasm" = "wasm";

async function loadModel(): Promise<void> {
  if (model && processor) return;

  activeDevice = await detectDevice();
  self.postMessage({ type: "device", device: activeDevice });

  const fileProgress: Record<string, number> = {};
  let totalFiles = 0;

  const progressCb = (p: any) => {
    if (p.status === "initiate") {
      totalFiles++;
      fileProgress[p.file ?? totalFiles] = 0;
    } else if (p.status === "progress" && typeof p.progress === "number") {
      fileProgress[p.file ?? ""] = p.progress;
    } else if (p.status === "done") {
      fileProgress[p.file ?? ""] = 100;
    }

    const values = Object.values(fileProgress);
    const avg = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
    self.postMessage({
      type: "progress",
      progress: Math.min(Math.round(avg), 99),
      file: p.file ?? "",
    });
  };

  self.postMessage({ type: "progress", progress: 0, file: "" });

  processor = await AutoProcessor.from_pretrained(MODEL_ID, {
    progress_callback: progressCb,
  });

  model = await AutoModel.from_pretrained(MODEL_ID, {
    device: activeDevice,
    dtype: "fp32",
    config: { model_type: "custom" } as any,
    progress_callback: progressCb,
  });
}

// ─── ROI storage ─────────────────────────────────────────────────────────────

// Keep a copy of the resized RGBA so we can run partial re-inference without
// the main thread sending the full image buffer again.
let storedRGBA: Uint8ClampedArray | null = null;
let storedDims = { width: 0, height: 0 };

// ─── Image resizing ───────────────────────────────────────────────────────────

async function resizeInWorker(
  imageBuffer: ArrayBuffer,
  mimeType: string,
  maxDimension: number
): Promise<{ blob: Blob; width: number; height: number }> {
  const srcBlob = new Blob([imageBuffer], { type: mimeType });
  const bitmap = await createImageBitmap(srcBlob);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  if (scale === 1 && mimeType === "image/png") {
    bitmap.close();
    return { blob: srcBlob, width: w, height: h };
  }

  const canvas = new OffscreenCanvas(w, h);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const blob = await canvas.convertToBlob({ type: "image/png" });
  return { blob, width: w, height: h };
}

// ─── Inference helpers ────────────────────────────────────────────────────────

/** Run RMBG-1.4 on a Blob; returns raw Uint8Array mask at (outW × outH). */
async function runInference(
  inputBlob: Blob,
  outW: number,
  outH: number
): Promise<Uint8Array> {
  const url = URL.createObjectURL(inputBlob);
  let image: any;
  try {
    image = await RawImage.fromURL(url);
  } finally {
    URL.revokeObjectURL(url);
  }

  const { pixel_values } = await processor(image);

  let rawOutput: any;
  try {
    const out = await model({ pixel_values });
    rawOutput = out.output ?? out[Object.keys(out)[0]];
  } catch {
    const out = await model({ input: pixel_values });
    rawOutput = out.output ?? out[Object.keys(out)[0]];
  }

  // rawOutput shape: [1, 1, H, W]  (logits before sigmoid)
  const tensor: any = Array.isArray(rawOutput) ? rawOutput[0] : rawOutput;
  const logits: Float32Array = tensor.data as Float32Array;
  const dims: number[] = tensor.dims as number[];
  const maskH: number = dims[dims.length - 2] ?? 1024;
  const maskW: number = dims[dims.length - 1] ?? 1024;

  // Sigmoid → [0, 255]
  const maskU8 = new Uint8Array(maskH * maskW);
  for (let i = 0; i < logits.length && i < maskU8.length; i++) {
    maskU8[i] = Math.round((1 / (1 + Math.exp(-logits[i]))) * 255);
  }

  // Scale mask to target output dimensions
  const maskRaw: any = new RawImage(maskU8, maskW, maskH, 1);
  const resizedMask: any = await maskRaw.resize(outW, outH);
  const resizedMaskData: Uint8Array = resizedMask.data as Uint8Array;
  const maskChannels: number = resizedMask.channels as number;

  const finalMask = new Uint8Array(outW * outH);
  for (let i = 0; i < outW * outH; i++) {
    finalMask[i] = resizedMaskData[i * maskChannels];
  }
  return finalMask;
}

// ─── Full image processing ────────────────────────────────────────────────────

async function processImage(imageBuffer: ArrayBuffer, mimeType: string): Promise<void> {
  const MAX_DIM = 1024;

  // 1. Resize in worker (OffscreenCanvas) → max 1024px
  const { blob, width: resW, height: resH } = await resizeInWorker(imageBuffer, mimeType, MAX_DIM);

  // 2. Run inference
  const finalMask = await runInference(blob, resW, resH);

  // 3. Extract RGBA from resized image via OffscreenCanvas
  const resBitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(resW, resH);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(resBitmap, 0, 0);
  resBitmap.close();
  const imgData = ctx.getImageData(0, 0, resW, resH);
  const rgba = new Uint8ClampedArray(imgData.data);

  // 4. Store RGBA for subsequent ROI re-inference (keep a copy before transfer)
  storedRGBA = new Uint8ClampedArray(rgba);
  storedDims = { width: resW, height: resH };

  // 5. Zero-copy transfer to main thread
  const maskBuf = finalMask.buffer as ArrayBuffer;
  const origBuf = rgba.buffer as ArrayBuffer;

  self.postMessage(
    { type: "result", maskBuffer: maskBuf, origBuffer: origBuf, width: resW, height: resH },
    [maskBuf, origBuf]
  );
}

// ─── ROI partial re-inference ─────────────────────────────────────────────────

const ROI_PADDING  = 64;
const ROI_MAX_DIM  = 512;

async function processROI(x: number, y: number, w: number, h: number): Promise<void> {
  if (!storedRGBA) {
    self.postMessage({ type: "error", message: "No stored image for ROI" });
    return;
  }

  const { width: imgW, height: imgH } = storedDims;

  // Expand ROI by padding (clamped to image bounds)
  const px = Math.max(0, x - ROI_PADDING);
  const py = Math.max(0, y - ROI_PADDING);
  const pw = Math.min(imgW - px, w + ROI_PADDING * 2);
  const ph = Math.min(imgH - py, h + ROI_PADDING * 2);

  if (pw <= 0 || ph <= 0) {
    self.postMessage({ type: "error", message: "Invalid ROI dimensions" });
    return;
  }

  // Draw full image to OffscreenCanvas, then crop-and-scale for inference
  const fullCanvas = new OffscreenCanvas(imgW, imgH);
  fullCanvas.getContext("2d")!.putImageData(
    new ImageData(storedRGBA as any, imgW, imgH),
    0, 0
  );

  const scale   = Math.min(1, ROI_MAX_DIM / Math.max(pw, ph));
  const inferW  = Math.max(1, Math.round(pw * scale));
  const inferH  = Math.max(1, Math.round(ph * scale));

  const inferCanvas = new OffscreenCanvas(inferW, inferH);
  inferCanvas.getContext("2d")!.drawImage(fullCanvas, px, py, pw, ph, 0, 0, inferW, inferH);

  const roiBlob  = await inferCanvas.convertToBlob({ type: "image/png" });
  const patchMask = await runInference(roiBlob, pw, ph);

  const patchBuf = patchMask.buffer as ArrayBuffer;
  self.postMessage(
    { type: "roi-result", maskPatch: patchBuf, x: px, y: py, w: pw, h: ph },
    [patchBuf]
  );
}

// ─── Message dispatcher ──────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data as {
    type: "load" | "process" | "roi";
    data?: {
      imageBuffer?: ArrayBuffer;
      mimeType?: string;
      x?: number;
      y?: number;
      w?: number;
      h?: number;
    };
  };

  if (type === "load") {
    try {
      await loadModel();
      self.postMessage({ type: "loaded" });
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
    return;
  }

  if (type === "process") {
    if (!model || !processor) {
      self.postMessage({ type: "error", message: "Model not loaded yet" });
      return;
    }
    try {
      self.postMessage({ type: "inferring" });
      await processImage(data!.imageBuffer!, data!.mimeType!);
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
    return;
  }

  if (type === "roi") {
    if (!model || !processor) {
      self.postMessage({ type: "error", message: "Model not loaded yet" });
      return;
    }
    try {
      self.postMessage({ type: "roi-inferring" });
      await processROI(data!.x!, data!.y!, data!.w!, data!.h!);
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
  }
};

export {};
