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

async function loadModel(): Promise<void> {
  if (model && processor) return;

  const activeDevice = await detectDevice();
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

// ─── Inference ────────────────────────────────────────────────────────────────

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

  // 4. Zero-copy transfer to main thread
  const maskBuf = finalMask.buffer as ArrayBuffer;
  const origBuf = rgba.buffer as ArrayBuffer;

  self.postMessage(
    { type: "result", maskBuffer: maskBuf, origBuffer: origBuf, width: resW, height: resH },
    [maskBuf, origBuf]
  );
}

// ─── Message dispatcher ──────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data as {
    type: "load" | "process";
    data?: {
      imageBuffer?: ArrayBuffer;
      mimeType?: string;
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
  }
};

export {};
