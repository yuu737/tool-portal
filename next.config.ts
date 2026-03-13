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
  turbopack: {
    resolveAlias: {
      // Packages that don't exist in the browser
      "onnxruntime-node": "./src/lib/empty-module.js",
      "sharp": "./src/lib/empty-module.js",
      // @xenova/transformers calls Object.keys(fs) at init time to detect
      // the runtime.  Turbopack resolves Node built-in `fs` to null in
      // browser bundles, causing Object.keys(null) to throw.
      // The env.js patch (postinstall) guards isEmpty() against null,
      // but we still alias these so the library detects "not Node.js".
      "fs": "./src/lib/empty-module.js",
      "node:fs": "./src/lib/empty-module.js",
      "fs/promises": "./src/lib/empty-module.js",
      "node:fs/promises": "./src/lib/empty-module.js",
    },
  },

  // Webpack: exclude Node.js-only packages from client bundles
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "onnxruntime-node$": false,
      "sharp$": false,
    };
    // Webpack 5 already stubs fs/path/url to {} for browser targets,
    // so no explicit alias needed here.
    return config;
  },

  // Cross-origin isolation in dev — enables SharedArrayBuffer → numThreads=4 for WASM
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
