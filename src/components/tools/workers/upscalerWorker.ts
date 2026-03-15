/// <reference lib="webworker" />

import * as ort from "onnxruntime-web";

// ─── Constants ────────────────────────────────────────────────────────────────

const TILE_SIZE = 128; // model input: 128×128
const SCALE = 4; // model output: 4× upscale
const OUT_TILE = TILE_SIZE * SCALE; // 512
const OVERLAP = 8; // tile overlap to avoid seam artifacts
const MODEL_PATH = new URL("/models/realesrgan/model.onnx", self.location.origin).href;
const MODEL_DATA_PATH = new URL("/models/realesrgan/model.data", self.location.origin).href;

// ─── ORT configuration ───────────────────────────────────────────────────────

ort.env.wasm.simd = true;
ort.env.wasm.numThreads = 4;
ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.24.3/dist/";

// ─── Singleton session ────────────────────────────────────────────────────────

let session: ort.InferenceSession | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (session) return session;

  // Try WebGPU first, fallback to WASM
  const providers: ort.InferenceSession.ExecutionProviderConfig[] = [];
  try {
    // @ts-expect-error navigator.gpu may not exist
    if (typeof navigator !== "undefined" && navigator.gpu) {
      // @ts-expect-error navigator.gpu may not exist
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) providers.push("webgpu");
    }
  } catch {
    // WebGPU not available
  }
  providers.push("wasm");

  self.postMessage({ type: "loading" });

  const [modelBuffer, dataBuffer] = await Promise.all([
    fetch(MODEL_PATH).then((r) => r.arrayBuffer()),
    fetch(MODEL_DATA_PATH).then((r) => r.arrayBuffer()),
  ]);

  session = await ort.InferenceSession.create(modelBuffer, {
    executionProviders: providers,
    externalData: [{ path: "model.data", data: new Uint8Array(dataBuffer) }],
  });

  self.postMessage({ type: "loaded" });
  return session;
}

// ─── Image processing helpers ─────────────────────────────────────────────────

/**
 * Convert RGBA ImageData to CHW float32 tensor [1, 3, H, W] in range [0, 1]
 */
function rgbaToFloat32CHW(
  data: Uint8ClampedArray,
  w: number,
  h: number
): Float32Array {
  const n = w * h;
  const float = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    const si = i * 4;
    float[i] = data[si] / 255; // R
    float[n + i] = data[si + 1] / 255; // G
    float[2 * n + i] = data[si + 2] / 255; // B
  }
  return float;
}

/**
 * Convert CHW float32 tensor [1, 3, H, W] in range [0, 1] to RGBA Uint8ClampedArray
 */
function float32CHWToRGBA(
  float: Float32Array,
  w: number,
  h: number
): Uint8ClampedArray {
  const n = w * h;
  const rgba = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const di = i * 4;
    rgba[di] = Math.max(0, Math.min(255, Math.round(float[i] * 255)));
    rgba[di + 1] = Math.max(0, Math.min(255, Math.round(float[n + i] * 255)));
    rgba[di + 2] = Math.max(0, Math.min(255, Math.round(float[2 * n + i] * 255)));
    rgba[di + 3] = 255;
  }
  return rgba;
}

// ─── Tile-based inference ─────────────────────────────────────────────────────

/**
 * Run Real-ESRGAN on a single 128×128 tile
 */
async function inferTile(
  sess: ort.InferenceSession,
  tileData: Float32Array
): Promise<Float32Array> {
  const inputTensor = new ort.Tensor("float32", tileData, [
    1,
    3,
    TILE_SIZE,
    TILE_SIZE,
  ]);
  const results = await sess.run({ image: inputTensor });
  const output = results["upscaled_image"];
  return output.data as Float32Array;
}

/**
 * Process an image with tile-based Real-ESRGAN inference.
 * - Resizes input to fit MAX_INPUT px on the longest side
 * - Pads to a multiple of TILE_SIZE
 * - Splits into overlapping 128×128 tiles
 * - Runs each tile through the model
 * - Blends overlapping regions linearly
 * - Crops to the correct output size
 * - Resizes according to the output mode (×1, ×2, ×4)
 */
async function processImage(
  imageBuffer: ArrayBuffer,
  mimeType: string,
  mode: 1 | 2 | 4,
  maxInput: number
): Promise<void> {
  const sess = await getSession();

  // 1. Decode image
  const srcBlob = new Blob([imageBuffer], { type: mimeType });
  const bitmap = await createImageBitmap(srcBlob);
  const origW = bitmap.width;
  const origH = bitmap.height;

  // 2. Resize to fit maxInput
  const scale = Math.min(1, maxInput / Math.max(origW, origH));
  const inW = Math.round(origW * scale);
  const inH = Math.round(origH * scale);

  // 3. Pad to multiple of TILE_SIZE
  const padW = Math.ceil(inW / TILE_SIZE) * TILE_SIZE;
  const padH = Math.ceil(inH / TILE_SIZE) * TILE_SIZE;

  const inCanvas = new OffscreenCanvas(padW, padH);
  const inCtx = inCanvas.getContext("2d")!;
  // Fill with edge pixels by drawing at original position (edges will wrap naturally)
  inCtx.drawImage(bitmap, 0, 0, inW, inH);
  bitmap.close();

  const inputData = inCtx.getImageData(0, 0, padW, padH);

  // 4. Calculate tile grid
  const tilesX = Math.ceil(padW / (TILE_SIZE - OVERLAP));
  const tilesY = Math.ceil(padH / (TILE_SIZE - OVERLAP));
  const totalTiles = tilesX * tilesY;

  // 5. Allocate output buffer (padded size × SCALE)
  const outW = padW * SCALE;
  const outH = padH * SCALE;
  const outRGBA = new Uint8ClampedArray(outW * outH * 4);
  // Weight buffer for overlap blending
  const weightBuf = new Float32Array(outW * outH);

  self.postMessage({ type: "inferring", total: totalTiles, done: 0 });

  // 6. Process tiles
  let tilesDone = 0;
  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const sx = Math.min(tx * (TILE_SIZE - OVERLAP), padW - TILE_SIZE);
      const sy = Math.min(ty * (TILE_SIZE - OVERLAP), padH - TILE_SIZE);

      // Extract tile pixels → CHW float32
      const tileRGBA = new Uint8ClampedArray(TILE_SIZE * TILE_SIZE * 4);
      for (let row = 0; row < TILE_SIZE; row++) {
        const srcOff = ((sy + row) * padW + sx) * 4;
        const dstOff = row * TILE_SIZE * 4;
        tileRGBA.set(
          inputData.data.subarray(srcOff, srcOff + TILE_SIZE * 4),
          dstOff
        );
      }
      const tileCHW = rgbaToFloat32CHW(tileRGBA, TILE_SIZE, TILE_SIZE);

      // Run inference
      const outCHW = await inferTile(sess, tileCHW);
      const outTileRGBA = float32CHWToRGBA(outCHW, OUT_TILE, OUT_TILE);

      // Place tile in output buffer with overlap blending
      const ox = sx * SCALE;
      const oy = sy * SCALE;
      for (let row = 0; row < OUT_TILE; row++) {
        for (let col = 0; col < OUT_TILE; col++) {
          const outX = ox + col;
          const outY = oy + row;
          if (outX >= outW || outY >= outH) continue;

          // Linear feather weight in overlap zones
          const featherX =
            col < OVERLAP * SCALE
              ? col / (OVERLAP * SCALE)
              : col >= OUT_TILE - OVERLAP * SCALE
                ? (OUT_TILE - 1 - col) / (OVERLAP * SCALE)
                : 1;
          const featherY =
            row < OVERLAP * SCALE
              ? row / (OVERLAP * SCALE)
              : row >= OUT_TILE - OVERLAP * SCALE
                ? (OUT_TILE - 1 - row) / (OVERLAP * SCALE)
                : 1;
          const w = featherX * featherY;

          const oi = (outY * outW + outX) * 4;
          const ti = (row * OUT_TILE + col) * 4;
          const wi = outY * outW + outX;

          const prevW = weightBuf[wi];
          const newW = prevW + w;
          if (newW > 0) {
            outRGBA[oi] = (outRGBA[oi] * prevW + outTileRGBA[ti] * w) / newW;
            outRGBA[oi + 1] =
              (outRGBA[oi + 1] * prevW + outTileRGBA[ti + 1] * w) / newW;
            outRGBA[oi + 2] =
              (outRGBA[oi + 2] * prevW + outTileRGBA[ti + 2] * w) / newW;
            outRGBA[oi + 3] = 255;
          }
          weightBuf[wi] = newW;
        }
      }

      tilesDone++;
      self.postMessage({ type: "inferring", total: totalTiles, done: tilesDone });
    }
  }

  // 7. Crop to actual upscaled size (remove padding)
  const cropW = inW * SCALE;
  const cropH = inH * SCALE;

  // 8. Determine final output size based on mode (relative to ORIGINAL dimensions)
  const finalW = origW * mode;
  const finalH = origH * mode;

  // 9. Draw cropped result, then scale to final size
  const cropCanvas = new OffscreenCanvas(cropW, cropH);
  const cropCtx = cropCanvas.getContext("2d")!;
  const fullImg = new ImageData(outRGBA, outW, outH);
  cropCtx.putImageData(fullImg, 0, 0);

  const finalCanvas = new OffscreenCanvas(finalW, finalH);
  const finalCtx = finalCanvas.getContext("2d")!;
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = "high";
  finalCtx.drawImage(cropCanvas, 0, 0, cropW, cropH, 0, 0, finalW, finalH);

  // 10. Encode to PNG
  const outBlob = await finalCanvas.convertToBlob({ type: "image/png" });
  const pngBuffer = await outBlob.arrayBuffer();

  self.postMessage(
    { type: "result", pngBuffer, width: finalW, height: finalH },
    [pngBuffer]
  );
}

// ─── Message dispatcher ──────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent) => {
  const { type, data } = e.data as {
    type: "load" | "process";
    data?: {
      imageBuffer: ArrayBuffer;
      mimeType: string;
      mode: 1 | 2 | 4;
      maxInput: number;
    };
  };

  if (type === "load") {
    try {
      await getSession();
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
    return;
  }

  if (type === "process" && data) {
    try {
      await processImage(
        data.imageBuffer,
        data.mimeType,
        data.mode,
        data.maxInput
      );
    } catch (err) {
      self.postMessage({ type: "error", message: String(err) });
    }
  }
};

export {};
