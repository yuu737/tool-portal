/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */

import { AutoModel, AutoProcessor, RawImage, env } from "@xenova/transformers";

// ─── Transformers.js configuration ───────────────────────────────────────────
(env as any).allowLocalModels = false;
(env as any).useBrowserCache = true;
// Run single-threaded to avoid nested-worker failures in browsers
(env as any).backends.onnx.wasm.numThreads = 1;
(env as any).backends.onnx.wasm.proxy = false;

const MODEL_ID = "briaai/RMBG-1.4";

let model: any = null;
let processor: any = null;

// ─── Model loading ────────────────────────────────────────────────────────────

async function loadModel(): Promise<void> {
  const fileProgress: Record<string, number> = {};
  let totalFiles = 0;

  const progressCb = (p: any) => {
    if (p.status === "initiate") {
      totalFiles++;
      fileProgress[p.file ?? totalFiles] = 0;
    } else if (p.status === "progress" && typeof p.progress === "number") {
      fileProgress[p.file ?? ""] = p.progress;
      const avg =
        Object.values(fileProgress).reduce((a, b) => a + b, 0) /
        Math.max(Object.keys(fileProgress).length, 1);
      self.postMessage({ type: "progress", progress: Math.min(Math.round(avg), 99), file: p.file ?? "" });
    } else if (p.status === "done") {
      fileProgress[p.file ?? ""] = 100;
      const avg =
        Object.values(fileProgress).reduce((a, b) => a + b, 0) /
        Math.max(Object.keys(fileProgress).length, 1);
      self.postMessage({ type: "progress", progress: Math.min(Math.round(avg), 99), file: p.file ?? "" });
    }
  };

  self.postMessage({ type: "progress", progress: 0, file: "" });

  processor = await AutoProcessor.from_pretrained(MODEL_ID, {
    progress_callback: progressCb,
  });

  model = await AutoModel.from_pretrained(MODEL_ID, {
    config: { model_type: "custom" },
    progress_callback: progressCb,
  });
}

// ─── Image processing ─────────────────────────────────────────────────────────

async function processImage(imageBuffer: ArrayBuffer, mimeType: string): Promise<void> {
  const blob = new Blob([imageBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);

  let image: any;
  try {
    image = await RawImage.fromURL(url);
  } finally {
    URL.revokeObjectURL(url);
  }

  const origW: number = image.width;
  const origH: number = image.height;

  // Preprocess — AutoProcessor handles resize+normalise for RMBG-1.4
  const { pixel_values } = await processor(image);

  // Inference — try both possible input key names (briaai model uses "pixel_values" or "input")
  let rawOutput: any;
  try {
    const out = await model({ pixel_values });
    rawOutput = out.output ?? out[Object.keys(out)[0]];
  } catch {
    const out = await model({ input: pixel_values });
    rawOutput = out.output ?? out[Object.keys(out)[0]];
  }

  // rawOutput shape: [1 (or more), 1, H, W]  (logits before sigmoid)
  const tensor: any = Array.isArray(rawOutput) ? rawOutput[0] : rawOutput;
  const logits: Float32Array = tensor.data as Float32Array;

  const dims: number[] = tensor.dims as number[];
  const maskH: number = dims[dims.length - 2] ?? 1024;
  const maskW: number = dims[dims.length - 1] ?? 1024;

  // Sigmoid → [0, 255] alpha values at model resolution
  const maskU8 = new Uint8Array(maskH * maskW);
  for (let i = 0; i < logits.length && i < maskU8.length; i++) {
    maskU8[i] = Math.round((1 / (1 + Math.exp(-logits[i]))) * 255);
  }

  // Scale mask back to original resolution via RawImage resize
  const maskRaw: any = new RawImage(maskU8, maskW, maskH, 1);
  const resizedMask: any = await maskRaw.resize(origW, origH);
  const resizedMaskData: Uint8Array = resizedMask.data as Uint8Array;
  const maskChannels: number = resizedMask.channels as number;

  // Build final single-channel mask (one byte per pixel)
  const finalMask = new Uint8Array(origW * origH);
  for (let i = 0; i < origW * origH; i++) {
    finalMask[i] = resizedMaskData[i * maskChannels];
  }

  // Extract RGBA from the original-resolution image
  const src: Uint8Array = image.data as Uint8Array;
  const srcChannels: number = image.channels as number;
  const rgba = new Uint8ClampedArray(origW * origH * 4);
  for (let i = 0; i < origW * origH; i++) {
    if (srcChannels === 4) {
      rgba[i * 4]     = src[i * 4];
      rgba[i * 4 + 1] = src[i * 4 + 1];
      rgba[i * 4 + 2] = src[i * 4 + 2];
      rgba[i * 4 + 3] = src[i * 4 + 3];
    } else if (srcChannels === 3) {
      rgba[i * 4]     = src[i * 3];
      rgba[i * 4 + 1] = src[i * 3 + 1];
      rgba[i * 4 + 2] = src[i * 3 + 2];
      rgba[i * 4 + 3] = 255;
    } else {
      rgba[i * 4]     = src[i];
      rgba[i * 4 + 1] = src[i];
      rgba[i * 4 + 2] = src[i];
      rgba[i * 4 + 3] = 255;
    }
  }

  // Zero-copy transfer via Transferable —
  // Component receives mask + orig RGBA separately so it can re-composite with
  // different edge-adjustment parameters without re-running inference.
  const maskBuf = finalMask.buffer as ArrayBuffer;
  const origBuf = rgba.buffer as ArrayBuffer;

  self.postMessage(
    { type: "result", maskBuffer: maskBuf, origBuffer: origBuf, width: origW, height: origH },
    [maskBuf, origBuf]
  );
}

// ─── Message dispatcher ───────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data as {
    type: "load" | "process";
    data?: { imageBuffer: ArrayBuffer; mimeType: string };
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
      await processImage(data!.imageBuffer, data!.mimeType);
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
  }
};

export {};
