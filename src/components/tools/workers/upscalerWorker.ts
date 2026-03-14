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
(env as any).backends.onnx.wasm.proxy = false;

const MODEL_ID = "Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr";

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
    progress_callback: progressCb,
  });
}

// ─── Image resizing ──────────────────────────────────────────────────────────

async function resizeToMax(
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

// ─── Bilinear upscale via OffscreenCanvas ────────────────────────────────────

async function bilinearUpscale(
  srcBlob: Blob,
  targetW: number,
  targetH: number
): Promise<Uint8ClampedArray> {
  const bitmap = await createImageBitmap(srcBlob);
  const canvas = new OffscreenCanvas(targetW, targetH);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();
  return ctx.getImageData(0, 0, targetW, targetH).data;
}

// ─── Inference ───────────────────────────────────────────────────────────────

async function runUpscale(
  inputBlob: Blob,
): Promise<{ rgbData: Uint8Array; width: number; height: number }> {
  const url = URL.createObjectURL(inputBlob);
  let image: any;
  try {
    image = await RawImage.fromURL(url);
  } finally {
    URL.revokeObjectURL(url);
  }

  const inputs = await processor(image);
  const output = await model(inputs);

  // reconstruction tensor shape: [1, 3, H*4, W*4]
  const reconstruction = output.reconstruction;
  const tensor = reconstruction.squeeze();        // [3, H*4, W*4]
  const clamped = tensor.clamp_(0, 1).mul_(255).round_().to("uint8");
  const outImage: any = RawImage.fromTensor(clamped);

  const outW: number = outImage.width;
  const outH: number = outImage.height;
  const rgbData: Uint8Array = outImage.data as Uint8Array;

  return { rgbData, width: outW, height: outH };
}

// ─── Full processing pipeline ────────────────────────────────────────────────

async function processImage(
  imageBuffer: ArrayBuffer,
  mimeType: string,
  scale: 2 | 4,
  denoise: "none" | "low" | "high"
): Promise<void> {
  const MAX_INPUT = 512;

  // 1. Resize input to max 512px
  const { blob, width: inW, height: inH } = await resizeToMax(imageBuffer, mimeType, MAX_INPUT);

  // 2. Run 4x super-resolution
  const { rgbData: aiRgb, width: aiW, height: aiH } = await runUpscale(blob);

  // 3. Noise reduction via blending with bilinear upscale
  const strength = denoise === "none" ? 0.7 : denoise === "low" ? 0.9 : 1.0;
  let finalW = aiW;
  let finalH = aiH;

  let finalRgba: Uint8ClampedArray;

  if (strength < 1.0) {
    // Blend AI output with bilinear upscale
    const bilinear = await bilinearUpscale(blob, aiW, aiH);
    finalRgba = new Uint8ClampedArray(aiW * aiH * 4);
    const aiChannels = aiRgb.length / (aiW * aiH); // 3 for RGB
    for (let i = 0; i < aiW * aiH; i++) {
      const biR = bilinear[i * 4];
      const biG = bilinear[i * 4 + 1];
      const biB = bilinear[i * 4 + 2];
      const aiR = aiRgb[i * aiChannels];
      const aiG = aiRgb[i * aiChannels + 1];
      const aiB = aiRgb[i * aiChannels + 2];
      finalRgba[i * 4] = Math.round(biR * (1 - strength) + aiR * strength);
      finalRgba[i * 4 + 1] = Math.round(biG * (1 - strength) + aiG * strength);
      finalRgba[i * 4 + 2] = Math.round(biB * (1 - strength) + aiB * strength);
      finalRgba[i * 4 + 3] = 255;
    }
  } else {
    // 100% AI — just convert RGB to RGBA
    finalRgba = new Uint8ClampedArray(aiW * aiH * 4);
    const aiChannels = aiRgb.length / (aiW * aiH);
    for (let i = 0; i < aiW * aiH; i++) {
      finalRgba[i * 4] = aiRgb[i * aiChannels];
      finalRgba[i * 4 + 1] = aiRgb[i * aiChannels + 1];
      finalRgba[i * 4 + 2] = aiRgb[i * aiChannels + 2];
      finalRgba[i * 4 + 3] = 255;
    }
  }

  // 4. If 2x, resize 4x output down to 2x
  if (scale === 2) {
    finalW = inW * 2;
    finalH = inH * 2;
    const canvas = new OffscreenCanvas(finalW, finalH);
    const ctx = canvas.getContext("2d")!;
    const imgData = new ImageData(new Uint8ClampedArray(finalRgba.buffer as ArrayBuffer), aiW, aiH);
    const tmpCanvas = new OffscreenCanvas(aiW, aiH);
    tmpCanvas.getContext("2d")!.putImageData(imgData, 0, 0);
    ctx.drawImage(tmpCanvas, 0, 0, finalW, finalH);
    finalRgba = ctx.getImageData(0, 0, finalW, finalH).data;
  }

  // 5. Zero-copy transfer
  const buf = finalRgba.buffer as ArrayBuffer;
  self.postMessage(
    { type: "result", rgbaBuffer: buf, width: finalW, height: finalH },
    [buf]
  );
}

// ─── Message dispatcher ──────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data as {
    type: "load" | "process";
    data?: {
      imageBuffer?: ArrayBuffer;
      mimeType?: string;
      scale?: 2 | 4;
      denoise?: "none" | "low" | "high";
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
      await processImage(
        data!.imageBuffer!,
        data!.mimeType!,
        data!.scale ?? 4,
        data!.denoise ?? "high"
      );
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
  }
};

export {};
