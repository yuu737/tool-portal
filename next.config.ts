import type { NextConfig } from "next";

// headers() is incompatible with output:"export" at build time.
// Apply only in dev so `next dev` gets cross-origin isolation for SharedArrayBuffer.
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },

  // Turbopack (Next.js 16+ dev server): exclude Node.js-only packages from client bundles
  // @huggingface/transformers v3 has proper conditional exports (node vs web),
  // so fs/path/sharp stubs are no longer needed. Only onnxruntime-node needs aliasing.
  turbopack: {
    resolveAlias: {
      "onnxruntime-node": "./src/lib/empty-module.js",
    },
  },

  // Webpack: exclude Node.js-only packages from client bundles
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node$": false,
    };
    return config;
  },

  // Cross-origin isolation in dev — enables SharedArrayBuffer for multi-threaded WASM
  ...(isDev ? {
    async headers() {
      return [{
        source: "/(.*)",
        headers: [
          { key: "Cross-Origin-Opener-Policy",   value: "same-origin"    },
          { key: "Cross-Origin-Embedder-Policy",  value: "credentialless" },
        ],
      }];
    },
  } : {}),
};

export default nextConfig;
