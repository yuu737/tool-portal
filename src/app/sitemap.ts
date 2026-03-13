import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteConfig";

export const dynamic = "force-static";

const toolPaths = [
  "/tools/word-count",
  "/tools/password-generator",
  "/tools/qr-code",
  "/tools/images-to-pdf",
  "/tools/json-formatter",
  "/tools/unit-converter",
  "/tools/base64",
];

const staticPaths = ["", "/tools", "/about", "/privacy", "/contact"];

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ["ja", "en"] as const;
  const now = new Date();

  return locales.flatMap((locale) =>
    [...staticPaths, ...toolPaths].map((path) => ({
      url: `${SITE_URL}/${locale}${path}`,
      lastModified: now,
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
