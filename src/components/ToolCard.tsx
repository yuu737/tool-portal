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
};

type LocalizedTool = {
  id: string;
  href: string;
  icon: string;
  name: string;
  description: string;
};

type Props = {
  tool: LocalizedTool;
  cta: string;
};

export default function ToolCard({ tool, cta }: Props) {
  const Icon = iconMap[tool.icon] ?? FileText;

  return (
    <Link
      href={tool.href}
      className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
    >
      {/* アイコン */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-100">
        <Icon size={24} strokeWidth={1.75} />
      </div>

      {/* タイトル */}
      <h3 className="mb-2 text-lg font-semibold text-gray-900">{tool.name}</h3>

      {/* 説明 */}
      <p className="text-sm leading-relaxed text-gray-500">{tool.description}</p>

      {/* CTA */}
      <div className="mt-auto pt-4">
        <span className="inline-flex items-center text-sm font-medium text-blue-600 transition-colors group-hover:text-blue-700">
          {cta}
          <svg
            className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
