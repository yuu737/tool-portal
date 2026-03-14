import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";
import fs from "fs";
import path from "path";

export const dynamic = "force-static";

const toolPaths = [
  "/tools/word-count",
  "/tools/password-generator",
  "/tools/qr-code",
  "/tools/images-to-pdf",
  "/tools/json-formatter",
  "/tools/unit-converter",
  "/tools/base64",
  "/tools/timer-counter",
  "/tools/grinding-companion",
  "/tools/image-optimizer",
  "/tools/background-remover",
  "/tools/image-upscaler",
];

const staticPaths = ["", "/tools", "/about", "/privacy", "/contact"];

function getLastModified(urlPath: string): Date {
  const segment = urlPath === "" ? "" : urlPath;
  const filePath = path.join(
    process.cwd(),
    "src/app/[lang]",
    segment,
    "page.tsx"
  );
  try {
    return fs.statSync(filePath).mtime;
  } catch {
    return new Date();
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ["ja", "en"] as const;

  return locales.flatMap((locale) =>
    [...staticPaths, ...toolPaths].map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: getLastModified(path),
      changeFrequency: "weekly" as const,
      priority:
        path === ""
          ? 1.0
          : toolPaths.includes(path)
          ? 0.8
          : 0.6,
    }))
  );
}
