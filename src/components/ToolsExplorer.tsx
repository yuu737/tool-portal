"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Gamepad2,
  FileText,
  Code,
  CalendarClock,
  LayoutGrid,
  X,
  type LucideIcon,
} from "lucide-react";
import ToolCard, { type LocalizedTool } from "@/components/ToolCard";

/* ─── Lucide アイコンマップ ─── */
const categoryIcons: Record<string, LucideIcon> = {
  ALL: LayoutGrid,
  GAMING_STATS: Gamepad2,
  TEXT_PROCESS: FileText,
  DEV_SYSTEM: Code,
  LIFE_UTILITY: CalendarClock,
};

/* ─── types ─── */
type ToolsDict = {
  searchPlaceholder: string;
  noResults: string;
  allCategory: string;
  categories: Record<string, string>;
};

type Props = {
  tools: LocalizedTool[];
  dict: ToolsDict;
  cta: string;
  categories: readonly string[];
};

/* ─── component ─── */
export default function ToolsExplorer({ tools, dict, cta, categories }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  /* URL → state */
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [activeCategory, setActiveCategory] = useState<string>(
    searchParams.get("cat") ?? "ALL",
  );
  const [activeTag, setActiveTag] = useState<string | null>(
    searchParams.get("tag"),
  );

  /* URL sync */
  const syncURL = useCallback(
    (q: string, cat: string, tag: string | null) => {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (cat !== "ALL") params.set("cat", cat);
      if (tag) params.set("tag", tag);

      const qs = params.toString();
      router.replace(`?${qs}`, { scroll: false });
    },
    [router],
  );

  /* handlers */
  const handleQueryChange = useCallback(
    (q: string) => {
      setQuery(q);
      syncURL(q, activeCategory, activeTag);
    },
    [activeCategory, activeTag, syncURL],
  );

  const handleCategoryChange = useCallback(
    (cat: string) => {
      setActiveCategory(cat);
      syncURL(query, cat, activeTag);
    },
    [query, activeTag, syncURL],
  );

  const handleTagClick = useCallback(
    (tag: string) => {
      const next = activeTag === tag ? null : tag;
      setActiveTag(next);
      syncURL(query, activeCategory, next);
    },
    [query, activeCategory, activeTag, syncURL],
  );

  const clearTag = useCallback(() => {
    setActiveTag(null);
    syncURL(query, activeCategory, null);
  }, [query, activeCategory, syncURL]);

  /* popstate 対応 */
  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    const cat = searchParams.get("cat") ?? "ALL";
    const tag = searchParams.get("tag") ?? null;
    setQuery(q);
    setActiveCategory(cat);
    setActiveTag(tag);
  }, [searchParams]);

  /* filtering */
  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return tools.filter((t) => {
      if (activeCategory !== "ALL" && t.category !== activeCategory)
        return false;
      if (activeTag && !t.tags.includes(activeTag)) return false;
      if (!lower) return true;
      return (
        t.name.toLowerCase().includes(lower) ||
        t.description.toLowerCase().includes(lower) ||
        t.tags.some((tag) => tag.toLowerCase().includes(lower))
      );
    });
  }, [tools, query, activeCategory, activeTag]);

  /* category tabs: "ALL" + defined categories */
  const tabs = ["ALL", ...categories] as const;

  return (
    <div className="space-y-6">
      {/* ── 検索バー ── */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
          size={18}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder={dict.searchPlaceholder}
          className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-11 pr-10 text-sm shadow-sm transition-shadow focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => handleQueryChange("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── カテゴリタブ ── */}
      <div className="flex flex-wrap gap-2">
        {tabs.map((cat) => {
          const Icon = categoryIcons[cat] ?? LayoutGrid;
          const label =
            cat === "ALL"
              ? dict.allCategory
              : dict.categories[cat] ?? cat;
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryChange(cat)}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── アクティブタグ表示 ── */}
      {activeTag && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Tag:</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-700">
            #{activeTag}
            <button
              type="button"
              onClick={clearTag}
              className="ml-0.5 rounded-full p-0.5 hover:bg-blue-200"
            >
              <X size={14} />
            </button>
          </span>
        </div>
      )}

      {/* ── ツールカードグリッド ── */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filtered.map((tool) => (
            <motion.div
              key={tool.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <ToolCard
                tool={tool}
                cta={cta}
                showTags
                onTagClick={handleTagClick}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── 空の結果 ── */}
      {filtered.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 py-16 text-center"
        >
          <Search className="text-gray-300" size={48} />
          <p className="text-sm text-gray-500">
            {dict.noResults}
          </p>
        </motion.div>
      )}
    </div>
  );
}
