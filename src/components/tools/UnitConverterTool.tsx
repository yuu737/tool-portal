"use client";

import { useState, useMemo } from "react";
import type { Dictionary } from "@/lib/getDictionary";

type Category = "length" | "weight" | "temperature" | "data";

type UnitDef = {
  id: string;
  label: string;
  toBase: (v: number) => number;
  fromBase: (v: number) => number;
};

// Base unit: meter / kilogram / Celsius / byte
const UNITS: Record<Category, UnitDef[]> = {
  length: [
    { id: "mm", label: "mm – Millimeter",  toBase: (v) => v * 0.001,    fromBase: (v) => v / 0.001 },
    { id: "cm", label: "cm – Centimeter",  toBase: (v) => v * 0.01,     fromBase: (v) => v / 0.01 },
    { id: "m",  label: "m – Meter",        toBase: (v) => v,            fromBase: (v) => v },
    { id: "km", label: "km – Kilometer",   toBase: (v) => v * 1000,     fromBase: (v) => v / 1000 },
    { id: "in", label: "in – Inch",        toBase: (v) => v * 0.0254,   fromBase: (v) => v / 0.0254 },
    { id: "ft", label: "ft – Foot",        toBase: (v) => v * 0.3048,   fromBase: (v) => v / 0.3048 },
    { id: "yd", label: "yd – Yard",        toBase: (v) => v * 0.9144,   fromBase: (v) => v / 0.9144 },
    { id: "mi", label: "mi – Mile",        toBase: (v) => v * 1609.344, fromBase: (v) => v / 1609.344 },
  ],
  weight: [
    { id: "mg", label: "mg – Milligram",   toBase: (v) => v * 0.000001,  fromBase: (v) => v / 0.000001 },
    { id: "g",  label: "g – Gram",         toBase: (v) => v * 0.001,     fromBase: (v) => v / 0.001 },
    { id: "kg", label: "kg – Kilogram",    toBase: (v) => v,             fromBase: (v) => v },
    { id: "t",  label: "t – Metric Ton",   toBase: (v) => v * 1000,      fromBase: (v) => v / 1000 },
    { id: "oz", label: "oz – Ounce",       toBase: (v) => v * 0.0283495, fromBase: (v) => v / 0.0283495 },
    { id: "lb", label: "lb – Pound",       toBase: (v) => v * 0.453592,  fromBase: (v) => v / 0.453592 },
  ],
  temperature: [
    { id: "C", label: "°C – Celsius",    toBase: (v) => v,               fromBase: (v) => v },
    { id: "F", label: "°F – Fahrenheit", toBase: (v) => (v - 32) * 5/9, fromBase: (v) => v * 9/5 + 32 },
    { id: "K", label: "K – Kelvin",      toBase: (v) => v - 273.15,      fromBase: (v) => v + 273.15 },
  ],
  data: [
    { id: "B",  label: "B – Byte",      toBase: (v) => v,                fromBase: (v) => v },
    { id: "KB", label: "KB – Kilobyte", toBase: (v) => v * 1024,         fromBase: (v) => v / 1024 },
    { id: "MB", label: "MB – Megabyte", toBase: (v) => v * 1024 ** 2,    fromBase: (v) => v / 1024 ** 2 },
    { id: "GB", label: "GB – Gigabyte", toBase: (v) => v * 1024 ** 3,    fromBase: (v) => v / 1024 ** 3 },
    { id: "TB", label: "TB – Terabyte", toBase: (v) => v * 1024 ** 4,    fromBase: (v) => v / 1024 ** 4 },
    { id: "PB", label: "PB – Petabyte", toBase: (v) => v * 1024 ** 5,    fromBase: (v) => v / 1024 ** 5 },
  ],
};

function formatResult(n: number): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) === 0) return "0";
  if (Math.abs(n) < 1e-9 || Math.abs(n) >= 1e15) return n.toExponential(6);
  const str = parseFloat(n.toPrecision(10)).toString();
  return str;
}

type Props = { dict: Dictionary["unitConverter"] };

const CATEGORY_ICONS: Record<Category, string> = {
  length: "📏",
  weight: "⚖️",
  temperature: "🌡️",
  data: "💾",
};

export default function UnitConverterTool({ dict }: Props) {
  const [category, setCategory] = useState<Category>("length");
  const [fromUnit, setFromUnit] = useState("m");
  const [toUnit, setToUnit] = useState("ft");
  const [inputVal, setInputVal] = useState("");

  const units = UNITS[category];

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    setFromUnit(UNITS[cat][0].id);
    setToUnit(UNITS[cat][1].id);
    setInputVal("");
  };

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
    setInputVal("");
  };

  const result = useMemo(() => {
    const num = parseFloat(inputVal);
    if (isNaN(num)) return "";
    const from = units.find((u) => u.id === fromUnit);
    const to = units.find((u) => u.id === toUnit);
    if (!from || !to) return "";
    const base = from.toBase(num);
    return formatResult(to.fromBase(base));
  }, [inputVal, fromUnit, toUnit, units]);

  const categories: { id: Category; label: string }[] = [
    { id: "length",      label: dict.categories.length },
    { id: "weight",      label: dict.categories.weight },
    { id: "temperature", label: dict.categories.temperature },
    { id: "data",        label: dict.categories.data },
  ];

  return (
    <div className="space-y-6">
      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
              category === cat.id
                ? "bg-blue-600 text-white shadow-sm"
                : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {CATEGORY_ICONS[cat.id]} {cat.label}
          </button>
        ))}
      </div>

      {/* Converter Card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr]">
          {/* From */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {dict.labels.from}
            </label>
            <input
              type="number"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={dict.placeholder}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <select
              value={fromUnit}
              onChange={(e) => setFromUnit(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div className="flex items-center justify-center pt-8">
            <button
              onClick={handleSwap}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-lg shadow-sm transition hover:bg-gray-50"
              title={dict.swap}
            >
              ⇄
            </button>
          </div>

          {/* To */}
          <div className="space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              {dict.labels.to}
            </label>
            <div className="flex w-full items-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 font-mono text-lg text-blue-800 min-h-[52px]">
              {result || <span className="text-gray-400">—</span>}
            </div>
            <select
              value={toUnit}
              onChange={(e) => setToUnit(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
