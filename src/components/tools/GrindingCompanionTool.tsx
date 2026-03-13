"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import type { Dictionary } from "@/lib/getDictionary";
import {
  Target,
  Timer,
  Percent,
  PictureInPicture,
  Minimize2,
  Plus,
  Minus,
  Play,
  Pause,
  RotateCcw,
  Flag,
  TrendingUp,
  Dices,
} from "lucide-react";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(opts?: { width?: number; height?: number }): Promise<Window>;
      window: Window | null;
    };
  }
}

type Props = { dict: Dictionary["grindingCompanion"]; locale: string };
type Modules = { counter: boolean; dropCalc: boolean; pip: boolean };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n: number) { return n.toString().padStart(2, "0"); }
function fmtMs(ms: number) {
  const t = Math.floor(ms / 1000);
  const m = Math.floor(t / 60);
  const s = t % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return `${pad(m)}:${pad(s)}.${pad(cs)}`;
}
function fmtMsShort(ms: number) {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return h > 0 ? `${h}h${pad(m)}m${pad(s)}s` : `${pad(m)}:${pad(s)}`;
}

// ─── Luck calculation ─────────────────────────────────────────────────────────
function luckLevel(ratio: number): { label: string; color: string; bg: string } {
  if (ratio >= 2.0) return { label: "★★★", color: "#d97706", bg: "#fef3c7" };
  if (ratio >= 1.25) return { label: "★★☆", color: "#16a34a", bg: "#dcfce7" };
  if (ratio >= 0.8)  return { label: "★☆☆", color: "#2563eb", bg: "#dbeafe" };
  if (ratio >= 0.5)  return { label: "☆☆☆", color: "#dc2626", bg: "#fee2e2" };
  return { label: "💀", color: "#7c3aed", bg: "#ede9fe" };
}

// ─── PiP Mini View ────────────────────────────────────────────────────────────
type PipViewProps = {
  cycles: number;
  currentMs: number;
  avgMs: number;
  cycleRunning: boolean;
  observedRate: number;
  nominalRate: number;
  luckRatio: number | null;
  showCounter: boolean;
  showDrop: boolean;
  onNextCycle: () => void;
  onToggleTimer: () => void;
};

function GrindingPipView({
  cycles, currentMs, avgMs, cycleRunning, observedRate, nominalRate,
  luckRatio, showCounter, showDrop, onNextCycle, onToggleTimer,
}: PipViewProps) {
  const luck = luckRatio !== null ? luckLevel(luckRatio) : null;

  return (
    <div style={{
      background: "#0c0f1a", color: "#f1f5f9",
      fontFamily: "ui-monospace,'Courier New',monospace",
      height: "100vh", display: "flex", flexDirection: "column",
      alignItems: "stretch", padding: "12px 14px",
      gap: 8, boxSizing: "border-box", userSelect: "none",
    }}>
      <div style={{ fontSize: 10, color: "#64748b", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Grinding Companion
      </div>

      {showCounter && (
        <div style={{ background: "#111827", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#64748b" }}>周回</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: "#a78bfa" }}>{cycles.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Now: {fmtMs(currentMs)}</span>
            <span style={{ fontSize: 11, color: "#64748b" }}>Avg: {avgMs > 0 ? fmtMsShort(avgMs) : "—"}</span>
          </div>
        </div>
      )}

      {showDrop && nominalRate > 0 && (
        <div style={{ background: "#111827", borderRadius: 10, padding: "8px 12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: "#64748b" }}>観測確率</span>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#34d399" }}>
              {observedRate.toFixed(2)}%
            </span>
          </div>
          {luck && (
            <div style={{
              marginTop: 4, padding: "2px 8px", borderRadius: 6, display: "inline-block",
              background: luck.bg, color: luck.color, fontSize: 11, fontWeight: 700,
            }}>
              {luck.label} ×{luckRatio!.toFixed(2)}
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: "auto" }}>
        <button onClick={onToggleTimer} style={{
          flex: 1, background: cycleRunning ? "#d97706" : "#7c3aed",
          border: "none", borderRadius: 8, color: "#fff", fontSize: 18,
          padding: "8px 0", cursor: "pointer", fontWeight: 700,
        }}>
          {cycleRunning ? "⏸" : "▶"}
        </button>
        <button onClick={onNextCycle} style={{
          flex: 2, background: "#1e3a5f", border: "2px solid #7c3aed",
          borderRadius: 8, color: "#a78bfa", fontSize: 14,
          padding: "8px 0", cursor: "pointer", fontWeight: 800,
        }}>
          次周 +1
        </button>
      </div>
    </div>
  );
}

// ─── Module Toggle ─────────────────────────────────────────────────────────────
function ModuleToggle({
  icon, label, active, onToggle,
}: { icon: React.ReactNode; label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
        active
          ? "border-violet-200 bg-violet-100 text-violet-700"
          : "border-gray-200 bg-white text-gray-400 hover:border-gray-300"
      }`}
    >
      {icon}
      {label}
      <div className="relative flex h-4 w-7 items-center">
        <div className={`h-3.5 w-7 rounded-full transition-colors ${active ? "bg-violet-500" : "bg-gray-200"}`} />
        <div className={`absolute h-3 w-3 rounded-full bg-white shadow transition-transform ${active ? "translate-x-3.5" : "translate-x-0.5"}`} />
      </div>
    </button>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color = "text-gray-900" }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl bg-gray-50 px-3 py-2.5 text-center">
      <span className={`text-lg font-extrabold tabular-nums ${color}`}>{value}</span>
      <span className="mt-0.5 text-xs text-gray-500">{label}</span>
      {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function GrindingCompanionTool({ dict }: Props) {
  // ── Modules ────────────────────────────────────────────────────────────────
  const [modules, setModules] = useState<Modules>({ counter: true, dropCalc: true, pip: false });
  const toggleModule = (k: keyof Modules) => setModules((m) => ({ ...m, [k]: !m[k] }));

  // ── Module A: Cycle Counter & Timer ────────────────────────────────────────
  const [cycles, setCycles] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("yuu-gc-cycles") ?? "0", 10) || 0;
  });
  const [cycleGoal, setCycleGoal] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("yuu-gc-goal") ?? "0", 10) || 0;
  });
  const [goalInput, setGoalInput] = useState("");
  const [cycleRunning, setCycleRunning] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [lapTimes, setLapTimes] = useState<number[]>([]);
  const [countAnim, setCountAnim] = useState(false);
  const cycleStartRef = useRef(0);
  const cycleOffsetRef = useRef(0);
  const cycleRafRef = useRef<number | null>(null);

  // ── Module B: Drop Rate ────────────────────────────────────────────────────
  const [dropsInput, setDropsInput] = useState("0");
  const [attemptsInput, setAttemptsInput] = useState("0");
  const [nominalInput, setNominalInput] = useState("1");

  // ── PiP ────────────────────────────────────────────────────────────────────
  const [pipSupported, setPipSupported] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [pipFallback, setPipFallback] = useState(false);
  const pipWinRef = useRef<Window | null>(null);
  const pipRootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const pipHandlersRef = useRef({ nextCycle: () => {}, toggleTimer: () => {} });

  // ─── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setPipSupported("documentPictureInPicture" in window);
    const savedGoal = parseInt(localStorage.getItem("yuu-gc-goal") ?? "0", 10) || 0;
    setGoalInput(savedGoal > 0 ? savedGoal.toString() : "");
  }, []);

  // ─── Persist ───────────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem("yuu-gc-cycles", cycles.toString()); }, [cycles]);
  useEffect(() => { localStorage.setItem("yuu-gc-goal", cycleGoal.toString()); }, [cycleGoal]);

  // ─── Cycle timer RAF ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!cycleRunning) {
      if (cycleRafRef.current) cancelAnimationFrame(cycleRafRef.current);
      return;
    }
    cycleStartRef.current = performance.now();
    const loop = () => {
      setCurrentMs(cycleOffsetRef.current + performance.now() - cycleStartRef.current);
      cycleRafRef.current = requestAnimationFrame(loop);
    };
    cycleRafRef.current = requestAnimationFrame(loop);
    return () => { if (cycleRafRef.current) cancelAnimationFrame(cycleRafRef.current); };
  }, [cycleRunning]);

  // ─── Derived: Counter ──────────────────────────────────────────────────────
  const avgMs = lapTimes.length > 0
    ? lapTimes.reduce((a, b) => a + b, 0) / lapTimes.length : 0;
  const bestMs = lapTimes.length > 0 ? Math.min(...lapTimes) : 0;
  const goalPct = cycleGoal > 0 ? Math.min(100, Math.round((cycles / cycleGoal) * 100)) : 0;

  // ─── Derived: Drop Rate ────────────────────────────────────────────────────
  const dropsNum = parseInt(dropsInput, 10) || 0;
  const attemptsNum = parseInt(attemptsInput, 10) || 0;
  const nominalRateNum = parseFloat(nominalInput) || 0;
  const p = nominalRateNum / 100;
  const observedRate = attemptsNum > 0 ? (dropsNum / attemptsNum) * 100 : 0;
  const expectedDrops = +(attemptsNum * p).toFixed(2);
  const luckRatio = p > 0 && attemptsNum > 0 ? observedRate / nominalRateNum : null;
  const expectedPerDrop = p > 0 ? Math.round(1 / p) : null;
  const pAtLeastOne = p > 0 && attemptsNum > 0
    ? (1 - Math.pow(1 - p, attemptsNum)) * 100 : null;
  const luck = luckRatio !== null ? luckLevel(luckRatio) : null;

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const startCycleTimer = useCallback(() => setCycleRunning(true), []);

  const pauseCycleTimer = useCallback(() => {
    setCycleRunning(false);
    cycleOffsetRef.current += performance.now() - cycleStartRef.current;
  }, []);

  const finishCycle = useCallback(() => {
    const elapsed = cycleRunning
      ? cycleOffsetRef.current + performance.now() - cycleStartRef.current
      : cycleOffsetRef.current;
    if (elapsed > 500) setLapTimes((prev) => [...prev, elapsed]);
    setCycleRunning(false);
    setCurrentMs(0);
    cycleOffsetRef.current = 0;
    setCycles((c) => c + 1);
    setCountAnim(true);
    setTimeout(() => setCountAnim(false), 280);
    if (navigator.vibrate) navigator.vibrate(30);
  }, [cycleRunning]);

  const manualInc = useCallback((n: number) => {
    setCycles((c) => c + n);
    setCountAnim(true);
    setTimeout(() => setCountAnim(false), 280);
    if (navigator.vibrate) navigator.vibrate(30);
  }, []);

  const manualDec = useCallback((n: number) => {
    setCycles((c) => Math.max(0, c - n));
  }, []);

  const resetSession = useCallback(() => {
    setCycleRunning(false);
    setCurrentMs(0);
    setLapTimes([]);
    cycleOffsetRef.current = 0;
  }, []);

  const resetAll = useCallback(() => {
    setCycles(0);
    resetSession();
  }, [resetSession]);

  const applyGoal = useCallback(() => {
    const n = parseInt(goalInput, 10);
    setCycleGoal(!isNaN(n) && n > 0 ? n : 0);
  }, [goalInput]);

  // ─── PiP handlers ref ──────────────────────────────────────────────────────
  pipHandlersRef.current = {
    nextCycle: finishCycle,
    toggleTimer: () => {
      if (cycleRunning) pauseCycleTimer();
      else startCycleTimer();
    },
  };

  // ─── PiP render ────────────────────────────────────────────────────────────
  const renderPip = useCallback(() => {
    if (!pipRootRef.current) return;
    pipRootRef.current.render(
      <GrindingPipView
        cycles={cycles}
        currentMs={currentMs}
        avgMs={avgMs}
        cycleRunning={cycleRunning}
        observedRate={observedRate}
        nominalRate={nominalRateNum}
        luckRatio={luckRatio}
        showCounter={modules.counter}
        showDrop={modules.dropCalc}
        onNextCycle={() => pipHandlersRef.current.nextCycle()}
        onToggleTimer={() => pipHandlersRef.current.toggleTimer()}
      />
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cycles, currentMs, avgMs, cycleRunning, observedRate, nominalRateNum, luckRatio, modules]);

  useEffect(() => {
    if (pipOpen || pipFallback) renderPip();
  }, [pipOpen, pipFallback, renderPip]);

  // ─── PiP open/close ────────────────────────────────────────────────────────
  const openPip = useCallback(async () => {
    if (!("documentPictureInPicture" in window)) {
      pipRootRef.current = createRoot(document.createElement("div"));
      setPipFallback(true);
      return;
    }
    try {
      const pipWin = await window.documentPictureInPicture!.requestWindow({ width: 260, height: 320 });
      pipWinRef.current = pipWin;
      for (const sheet of document.styleSheets) {
        try {
          const rules = [...sheet.cssRules].map((r) => r.cssText).join("");
          const s = pipWin.document.createElement("style");
          s.textContent = rules;
          pipWin.document.head.appendChild(s);
        } catch { if (sheet.href) { const l = pipWin.document.createElement("link"); l.rel = "stylesheet"; l.href = sheet.href; pipWin.document.head.appendChild(l); } }
      }
      const wrap = pipWin.document.createElement("div");
      pipWin.document.body.style.margin = "0";
      pipWin.document.body.appendChild(wrap);
      pipRootRef.current = createRoot(wrap);
      pipWin.addEventListener("pagehide", () => { pipWinRef.current = null; pipRootRef.current = null; setPipOpen(false); });
      setPipOpen(true);
    } catch {
      pipRootRef.current = createRoot(document.createElement("div"));
      setPipFallback(true);
    }
  }, []);

  const closePip = useCallback(() => {
    try { pipWinRef.current?.close(); } catch { /* noop */ }
    pipWinRef.current = null; pipRootRef.current = null;
    setPipOpen(false); setPipFallback(false);
  }, []);

  // ─── Luck bar position ─────────────────────────────────────────────────────
  // 0 luck = 0%, 1 luck = 50%, 2+ luck = 100%
  const luckBarPct = luckRatio !== null ? Math.min(100, (luckRatio / 2) * 100) : 50;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Module Toggles */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3">
        <span className="mr-1 text-xs font-semibold text-gray-400">{dict.modules.heading}:</span>
        <ModuleToggle
          icon={<Timer size={13} />}
          label={dict.modules.counter}
          active={modules.counter}
          onToggle={() => toggleModule("counter")}
        />
        <ModuleToggle
          icon={<Dices size={13} />}
          label={dict.modules.dropCalc}
          active={modules.dropCalc}
          onToggle={() => toggleModule("dropCalc")}
        />
        <ModuleToggle
          icon={<PictureInPicture size={13} />}
          label={dict.modules.pip}
          active={modules.pip}
          onToggle={() => toggleModule("pip")}
        />
      </div>

      {/* No module selected */}
      {!modules.counter && !modules.dropCalc && (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 py-10 text-center text-sm text-gray-400">
          {dict.modules.emptyHint}
        </div>
      )}

      {/* ══════════ Module A: Cycle Counter & Timer ══════════ */}
      {modules.counter && (
        <div className="overflow-hidden rounded-2xl border border-violet-100 bg-white shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-violet-50 bg-violet-50/60 px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-violet-700">
              <Timer size={16} strokeWidth={2} />
              {dict.counter.title}
            </div>
            <button onClick={resetAll} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-gray-400 hover:bg-violet-100 hover:text-violet-700 transition-colors">
              <RotateCcw size={12} /> {dict.counter.resetSession}
            </button>
          </div>

          <div className="space-y-5 p-5">
            {/* Big cycle count */}
            <div className="flex flex-col items-center gap-1">
              <div
                className="text-8xl font-extrabold tabular-nums text-violet-700"
                style={{
                  transform: countAnim ? "scale(1.1) translateY(-6px)" : "none",
                  transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1)",
                }}
              >
                {cycles.toLocaleString()}
              </div>
              {cycleGoal > 0 && (
                <div className="text-sm text-gray-400">/ {cycleGoal.toLocaleString()} ({goalPct}%)</div>
              )}
              {cycleGoal > 0 && (
                <div className="mt-1 h-2 w-48 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${goalPct}%`, background: goalPct >= 100 ? "#16a34a" : "#7c3aed" }}
                  />
                </div>
              )}
              {cycleGoal > 0 && goalPct >= 100 && (
                <p className="text-xs font-bold text-green-600">🎉 {dict.counter.goalReached}</p>
              )}
            </div>

            {/* Cycle timer display */}
            <div className="flex items-center justify-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-center">
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold tabular-nums text-gray-800">{fmtMs(currentMs)}</span>
                <span className="text-xs text-gray-400">{dict.counter.currentTime}</span>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold tabular-nums text-gray-600">{avgMs > 0 ? fmtMsShort(avgMs) : "—"}</span>
                <span className="text-xs text-gray-400">{dict.counter.avgTime}</span>
              </div>
              <div className="h-8 w-px bg-gray-200" />
              <div className="flex flex-col items-center">
                <span className="text-xl font-bold tabular-nums text-gray-500">{bestMs > 0 ? fmtMsShort(bestMs) : "—"}</span>
                <span className="text-xs text-gray-400">{dict.counter.bestTime}</span>
              </div>
            </div>

            {/* Main action buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Timer toggle */}
              {!cycleRunning ? (
                <button
                  onClick={startCycleTimer}
                  className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 py-3 text-sm font-semibold text-violet-700 hover:bg-violet-100 transition-colors active:scale-95"
                >
                  <Play size={15} fill="currentColor" /> {dict.counter.startCycle}
                </button>
              ) : (
                <button
                  onClick={pauseCycleTimer}
                  className="flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors active:scale-95"
                >
                  <Pause size={15} fill="currentColor" /> {dict.counter.pauseCycle}
                </button>
              )}
              {/* Finish cycle (+1) */}
              <button
                onClick={finishCycle}
                className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white hover:bg-violet-700 transition-colors active:scale-95 shadow"
              >
                <Flag size={15} /> {dict.counter.finishCycle}
              </button>
            </div>

            {/* Manual +/- */}
            <div className="grid grid-cols-4 gap-2">
              <button onClick={() => manualDec(1)} className="flex items-center justify-center rounded-xl border border-gray-200 py-2.5 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95">
                <Minus size={18} strokeWidth={2.5} />
              </button>
              <button onClick={() => manualDec(5)} className="flex items-center justify-center rounded-xl border border-gray-200 py-2.5 text-xs font-bold text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95">−5</button>
              <button onClick={() => manualInc(5)} className="flex items-center justify-center rounded-xl bg-violet-100 py-2.5 text-xs font-bold text-violet-700 hover:bg-violet-200 transition-colors active:scale-95">+5</button>
              <button onClick={() => manualInc(1)} className="flex items-center justify-center rounded-xl bg-violet-500 py-2.5 text-white hover:bg-violet-600 transition-colors active:scale-95">
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Goal input */}
            <div className="flex gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
                <Target size={13} className="shrink-0 text-gray-400" />
                <input
                  type="number" min={1}
                  placeholder={dict.counter.goalPlaceholder}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyGoal()}
                  className="flex-1 bg-transparent py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                />
              </div>
              <button onClick={applyGoal} className="rounded-xl bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 transition-colors active:scale-95">
                {dict.counter.setGoal}
              </button>
            </div>

            {/* Lap history (last 5) */}
            {lapTimes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-gray-400">{dict.counter.lapHistory}</p>
                <div className="max-h-28 overflow-y-auto space-y-1">
                  {[...lapTimes].reverse().slice(0, 10).map((ms, i) => (
                    <div key={i} className="flex justify-between rounded-lg bg-gray-50 px-3 py-1.5 text-xs">
                      <span className="text-gray-400">#{lapTimes.length - i}</span>
                      <span className="tabular-nums font-medium text-gray-700">{fmtMs(ms)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ Module B: Drop Rate ══════════ */}
      {modules.dropCalc && (
        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-emerald-50 bg-emerald-50/60 px-5 py-3 text-sm font-semibold text-emerald-700">
            <Dices size={16} strokeWidth={2} />
            {dict.dropCalc.title}
          </div>

          <div className="space-y-5 p-5">
            {/* Inputs */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: dict.dropCalc.drops, val: dropsInput, set: setDropsInput, ph: dict.dropCalc.dropsPlaceholder },
                { label: dict.dropCalc.attempts, val: attemptsInput, set: setAttemptsInput, ph: dict.dropCalc.attemptsPlaceholder },
                { label: dict.dropCalc.nominalRate, val: nominalInput, set: setNominalInput, ph: dict.dropCalc.nominalPlaceholder },
              ].map(({ label, val, set, ph }) => (
                <div key={label}>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
                  <input
                    type="number" min={0} value={val} placeholder={ph}
                    onChange={(e) => set(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm tabular-nums text-gray-800 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  />
                </div>
              ))}
            </div>

            {/* Results */}
            {attemptsNum > 0 && (
              <div className="space-y-3">
                {/* Rate comparison */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <div className="text-2xl font-extrabold tabular-nums text-emerald-700">
                      {observedRate.toFixed(2)}%
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">{dict.dropCalc.observedRate}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <div className="text-2xl font-extrabold tabular-nums text-gray-600">
                      {nominalRateNum > 0 ? `${nominalRateNum}%` : "—"}
                    </div>
                    <div className="mt-0.5 text-xs text-gray-500">{dict.dropCalc.nominalRate}</div>
                  </div>
                </div>

                {/* Luck gauge */}
                {luckRatio !== null && nominalRateNum > 0 && (
                  <div className="rounded-xl border bg-gray-50 p-3" style={{ borderColor: luck!.color + "40" }}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">{dict.dropCalc.luckRatio}</span>
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: luck!.bg, color: luck!.color }}>
                        {luck!.label} ×{luckRatio.toFixed(2)}
                      </span>
                    </div>
                    {/* Gradient bar */}
                    <div className="relative h-3 overflow-hidden rounded-full" style={{
                      background: "linear-gradient(to right, #dc2626, #f59e0b 50%, #16a34a)"
                    }}>
                      <div
                        className="absolute top-0 h-3 w-1 -translate-x-0.5 rounded-full bg-white shadow"
                        style={{ left: `${luckBarPct}%`, transition: "left 0.3s" }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-gray-400">
                      <span>{dict.dropCalc.unlucky}</span>
                      <span>{dict.dropCalc.normal}</span>
                      <span>{dict.dropCalc.lucky}</span>
                    </div>
                  </div>
                )}

                {/* Extra stats */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-gray-50 p-2.5">
                    <div className="text-base font-bold tabular-nums text-gray-800">{expectedDrops}</div>
                    <div className="text-gray-500">{dict.dropCalc.expectedDrops}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-2.5">
                    <div className="text-base font-bold tabular-nums text-gray-800">
                      {expectedPerDrop !== null ? `${expectedPerDrop}` : "—"}
                    </div>
                    <div className="text-gray-500">{dict.dropCalc.expectedPerDrop}</div>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-2.5">
                    <div className="text-base font-bold tabular-nums text-gray-800">
                      {pAtLeastOne !== null ? `${pAtLeastOne.toFixed(1)}%` : "—"}
                    </div>
                    <div className="text-gray-500">{dict.dropCalc.pSuccess}</div>
                  </div>
                </div>

                {/* Dry streak note */}
                {dropsNum === 0 && attemptsNum > 0 && nominalRateNum > 0 && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
                    <span className="font-semibold">{dict.dropCalc.dryStreak}</span>{" "}
                    {dict.dropCalc.dryStreakNote
                      .replace("{n}", attemptsNum.toString())
                      .replace("{pct}", (pAtLeastOne ?? 0).toFixed(1))}
                  </div>
                )}
              </div>
            )}

            {attemptsNum === 0 && (
              <p className="text-center text-sm text-gray-400">{dict.dropCalc.hint}</p>
            )}
          </div>
        </div>
      )}

      {/* ══════════ Module C: PiP Control ══════════ */}
      {modules.pip && (
        <div className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-violet-800">{dict.pip.title}</p>
            <p className="truncate text-xs text-violet-500">
              {pipSupported ? dict.pip.description : dict.pip.unsupported}
            </p>
          </div>
          {pipOpen || pipFallback ? (
            <button onClick={closePip} className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 transition-colors">
              <Minimize2 size={14} /> {dict.pip.close}
            </button>
          ) : (
            <button onClick={openPip} className="flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-medium text-white hover:bg-violet-700 transition-colors">
              <PictureInPicture size={14} /> {dict.pip.open}
            </button>
          )}
        </div>
      )}

      {/* Floating fallback */}
      {pipFallback && (
        <div className="fixed bottom-4 right-4 z-50 w-64 overflow-hidden rounded-2xl shadow-2xl" style={{ background: "#0c0f1a" }}>
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <span className="text-xs font-medium text-slate-400">{dict.pip.miniMode}</span>
            <button onClick={closePip} className="text-lg leading-none text-slate-400 hover:text-white">×</button>
          </div>
          <GrindingPipView
            cycles={cycles} currentMs={currentMs} avgMs={avgMs}
            cycleRunning={cycleRunning} observedRate={observedRate}
            nominalRate={nominalRateNum} luckRatio={luckRatio}
            showCounter={modules.counter} showDrop={modules.dropCalc}
            onNextCycle={() => pipHandlersRef.current.nextCycle()}
            onToggleTimer={() => pipHandlersRef.current.toggleTimer()}
          />
        </div>
      )}
    </div>
  );
}
