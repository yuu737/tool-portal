import Link from "next/link";
import {
  FileText,
  KeyRound,
  QrCode,
  Images,
  Braces,
  ArrowLeftRight,
  Binary,
  Timer,
  Target,
  ImageDown,
  Eraser,
  type LucideIcon,
} from "lucide-react";

const iconMap: Record<string, LucideIcon> = {
  FileText,
  KeyRound,
  QrCode,
  Images,
  Braces,
  ArrowLeftRight,
  Binary,
  Timer,
  Target,
  ImageDown,
  Eraser,
};

export type LocalizedTool = {
  id: string;
  href: string;
  icon: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
};

type Props = {
  tool: LocalizedTool;
  cta: string;
  freeLabel?: string;
  onTagClick?: (tag: string) => void;
  showTags?: boolean;
};

export default function ToolCard({ tool, cta, freeLabel, onTagClick, showTags = false }: Props) {
  const Icon = iconMap[tool.icon] ?? FileText;

  return (
    <div className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
      {/* 無料バッジ */}
      {freeLabel && (
        <span className="absolute right-4 top-4 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
          {freeLabel}
        </span>
      )}
      {/* アイコン */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
        <Icon size={24} strokeWidth={1.75} />
      </div>

      {/* タイトル */}
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{tool.name}</h3>

      {/* 説明 */}
      <p className="text-sm leading-relaxed text-gray-500">{tool.description}</p>

      {/* タグ */}
      {showTags && tool.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {tool.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onTagClick?.(tag);
              }}
              className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* CTA */}
      <div className="mt-auto pt-4">
        <Link
          href={tool.href}
          className="inline-flex items-center text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
        >
          {cta}
          <svg
            className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
