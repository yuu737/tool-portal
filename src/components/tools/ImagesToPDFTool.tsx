"use client";

import { useState, useCallback, useRef } from "react";
import type { Dictionary } from "@/lib/getDictionary";

type FileItem = { id: string; file: File; url: string };
type Props = { dict: Dictionary["imagesToPdf"] };

export default function ImagesToPDFTool({ dict }: Props) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [generating, setGenerating] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: File[]) => {
    const imageFiles = incoming.filter((f) => f.type.startsWith("image/"));
    const items: FileItem[] = imageFiles.map((f) => ({
      id: crypto.randomUUID(),
      file: f,
      url: URL.createObjectURL(f),
    }));
    setFiles((prev) => [...prev, ...items]);
  }, []);

  const handleDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (draggingId) {
      setDraggingId(null);
      return;
    }
    addFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOverItem = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) return;
    setFiles((prev) => {
      const from = prev.findIndex((f) => f.id === draggingId);
      const to = prev.findIndex((f) => f.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const removeFile = (id: string) => {
    setFiles((prev) => {
      const f = prev.find((x) => x.id === id);
      if (f) URL.revokeObjectURL(f.url);
      return prev.filter((x) => x.id !== id);
    });
  };

  const handleClear = () => {
    files.forEach((f) => URL.revokeObjectURL(f.url));
    setFiles([]);
  };

  const handleGenerate = async () => {
    if (files.length === 0) return;
    setGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ unit: "mm", compress: true });
      let isFirst = true;

      for (const item of files) {
        const img = new Image();
        img.src = item.url;
        await new Promise<void>((res) => {
          img.onload = () => res();
        });

        const pageW = 210;
        const pageH = 297;
        const margin = 10;
        const maxW = pageW - margin * 2;
        const maxH = pageH - margin * 2;
        const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
        const w = img.naturalWidth * scale;
        const h = img.naturalHeight * scale;
        const x = (pageW - w) / 2;
        const y = (pageH - h) / 2;

        if (!isFirst) pdf.addPage();
        isFirst = false;

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext("2d")!.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        pdf.addImage(dataUrl, "JPEG", x, y, w, h);
      }

      pdf.save("toolbox-images.pdf");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Safety Banner */}
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <span className="text-lg">🔒</span>
        <p className="text-sm text-green-700">{dict.info.safety}</p>
      </div>

      {/* Drop Zone */}
      <div
        role="button"
        tabIndex={0}
        onDragOver={(e) => {
          e.preventDefault();
          if (!draggingId) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDropZone}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
        }`}
      >
        <div className="mb-3 text-4xl">🖼️</div>
        <p className="font-semibold text-gray-700">{dict.dropZone.heading}</p>
        <p className="mt-1 text-sm text-gray-400">{dict.dropZone.sub}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addFiles(Array.from(e.target.files ?? []))}
        />
      </div>

      {/* Thumbnail Grid */}
      {files.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">{dict.info.dragHint}</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {files.map((f, i) => (
              <div
                key={f.id}
                draggable
                onDragStart={() => setDraggingId(f.id)}
                onDragOver={(e) => handleDragOverItem(e, f.id)}
                onDragEnd={() => setDraggingId(null)}
                className={`group relative cursor-grab overflow-hidden rounded-xl border bg-white shadow-sm transition active:cursor-grabbing ${
                  draggingId === f.id
                    ? "border-blue-400 opacity-50"
                    : "border-gray-200"
                }`}
              >
                <div className="absolute left-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow">
                  {i + 1}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(f.id);
                  }}
                  className="absolute right-2 top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                  title={dict.buttons.remove}
                >
                  ×
                </button>
                <img
                  src={f.url}
                  alt={f.file.name}
                  className="h-28 w-full object-cover"
                />
                <p className="truncate px-2 py-1 text-xs text-gray-500">{f.file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50"
        >
          + {dict.buttons.addMore}
        </button>
        {files.length > 0 && (
          <button
            onClick={handleClear}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition hover:bg-red-100"
          >
            {dict.buttons.clear}
          </button>
        )}
        <button
          onClick={handleGenerate}
          disabled={files.length === 0 || generating}
          className="ml-auto rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {generating ? dict.buttons.generating : dict.buttons.generate}
        </button>
      </div>
    </div>
  );
}
