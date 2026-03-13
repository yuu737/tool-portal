"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import type { Dictionary } from "@/lib/getDictionary";
import {
  Timer,
  Clock,
  Hash,
  Play,
  Pause,
  RotateCcw,
  Flag,
  PictureInPicture,
  Minimize2,
  Plus,
  Minus,
  Target,
  Edit3,
  Percent,
  Settings,
  TrendingUp,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow(opts?: { width?: number; height?: number }): Promise<Window>;
      window: Window | null;
    };
  }
}

type Props = { dict: Dictionary["timerCounter"]; locale: string };
type Tab = "timer" | "stopwatch" | "counter" | "probability";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n: number) { return n.toString().padStart(2, "0"); }
function fmtSec(s: number) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function fmtMs(ms: number) {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs)}` : `${pad(m)}:${pad(s)}.${pad(cs)}`;
}
function fmtRate(r: number) {
  if (r === 0) return "0.00%";
  if (r < 0.01) return r.toFixed(4) + "%";
  return r.toFixed(2) + "%";
}

// ─── Binomial distribution ────────────────────────────────────────────────────
function logBinomCoeff(n: number, k: number): number {
  if (k === 0 || k === n) return 0;
  if (k > n - k) k = n - k;
  let r = 0;
  for (let i = 0; i < k; i++) r += Math.log(n - i) - Math.log(i + 1);
  return r;
}
function binomPdf(n: number, k: number, p: number): number {
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  if (k > n || k < 0) return 0;
  return Math.exp(logBinomCoeff(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p));
}
function calcDistribution(n: number, p: number, rows = 5) {
  const dist: { k: number; prob: number }[] = [];
  let cumSum = 0;
  for (let k = 0; k < rows; k++) {
    const prob = binomPdf(n, k, p);
    dist.push({ k, prob });
    cumSum += prob;
  }
  // "rows or more"
  dist.push({ k: rows, prob: Math.max(0, 1 - cumSum) });
  return dist;
}

// ─── Circular Ring SVG ────────────────────────────────────────────────────────
function Ring({ pct, color, size = 240, track = "#e2e8f0", sw = 10 }: {
  pct: number; color: string; size?: number; track?: string; sw?: number;
}) {
  const r = size / 2 - sw - 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, pct) / 100));
  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }} aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={sw + 2} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s" }} />
    </svg>
  );
}

// ─── Canvas PiP frame renderer (mobile Video PiP) ────────────────────────────
function drawCanvasFrame(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  display: string,
  pct: number,
  ringColor: string,
  tabLabel: string,
  isDone: boolean,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0c0f1a";
  ctx.fillRect(0, 0, w, h);

  // Ring dimensions – centered
  const ringR = Math.min(h * 0.34, w * 0.26);
  const cx = w / 2;
  const cy = h * 0.5;
  const sw = Math.max(2, ringR * 0.18);

  // Track ring
  ctx.beginPath();
  ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
  ctx.strokeStyle = "#1e2d45";
  ctx.lineWidth = sw;
  ctx.stroke();

  // Progress arc
  const p = Math.min(1, Math.max(0, pct / 100));
  if (p > 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = sw + 1;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // Label (small, above center)
  const labelSize = Math.max(7, h * 0.13);
  ctx.fillStyle = "#475569";
  ctx.font = `${labelSize}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(tabLabel.toUpperCase(), cx, cy - ringR * 0.45);

  // Time (large, center)
  const timeSize = Math.max(10, h * 0.27);
  ctx.fillStyle = isDone ? "#22c55e" : "#f1f5f9";
  ctx.font = `bold ${timeSize}px "Courier New", Courier, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(display, cx, cy + h * 0.06);

  // Done text
  if (isDone) {
    const doneSize = Math.max(7, h * 0.13);
    ctx.fillStyle = "#22c55e";
    ctx.font = `bold ${doneSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("DONE ✓", cx, cy + ringR + sw + doneSize + 2);
  }
}

// ─── PiP View ─────────────────────────────────────────────────────────────────
type PipProps = {
  time: string; count: number; goal: number; tabLabel: string; tab: Tab;
  isRunning: boolean; pct: number; ringColor: string;
  probDrops: number; probAttempts: number; observedPct: number;
  calcN: number; calcP: number; pAtLeastOne: number;
  pipShowTimer: boolean; pipShowStopwatch: boolean;
  pipShowCounter: boolean; pipShowProbability: boolean;
  compact?: boolean;
  dict: Dictionary["timerCounter"];
  onPlayPause: () => void; onCounterInc: () => void;
  onProbDropInc: () => void; onProbAttemptInc: () => void;
  onTabChange: (t: Tab) => void;
  onTimerReset: () => void; onSwReset: () => void;
  onCounterReset: () => void; onProbReset: () => void;
  onTimerAddTime: (s: number) => void;
  counterPipSource: "stopwatch" | "timer";
  onCounterPipSourceChange: (s: "stopwatch" | "timer") => void;
};

function PipView({
  time, count, goal, tabLabel, tab, isRunning, pct, ringColor,
  probDrops, probAttempts, observedPct, calcN, calcP, pAtLeastOne,
  pipShowTimer, pipShowStopwatch, pipShowCounter, pipShowProbability,
  compact, dict,
  onPlayPause, onCounterInc, onProbDropInc, onProbAttemptInc, onTabChange,
  onTimerReset, onSwReset, onCounterReset, onProbReset,
  onTimerAddTime, counterPipSource, onCounterPipSourceChange,
}: PipProps) {
  const r = 64;
  const circ = 2 * Math.PI * r;

  const cPct = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;
  const observedRate = probAttempts > 0 ? probDrops / probAttempts * 100 : 0;

  // 有効なタブのみを表示（設定で非表示にされたタブは除く）
  const enabledTabs: Tab[] = [
    ...(pipShowTimer ? ["timer" as Tab] : []),
    ...(pipShowStopwatch ? ["stopwatch" as Tab] : []),
    "counter" as Tab,
    "probability" as Tab,
  ];
  const effectiveTab: Tab = enabledTabs.includes(tab) ? tab : (enabledTabs[0] ?? tab);

  // 実測ドロップ率を円に直接反映（観測データがある場合は実測率、ない場合はP(≥1)）
  const hasObservations = probAttempts > 0;
  const probRingDisplay = hasObservations ? Math.min(100, observedRate) : pAtLeastOne;

  const displayPct = effectiveTab === "probability" ? probRingDisplay : pct;
  const offset = circ * (1 - Math.min(1, Math.max(0, displayPct) / 100));

  // 実測率がある場合は理論値との比較で色を決定
  const activeColor = effectiveTab === "probability"
    ? hasObservations
      ? (observedRate >= calcP * 1.5 ? "#22c55e" : observedRate >= calcP * 0.8 ? "#6366f1" : "#f59e0b")
      : (probRingDisplay >= 95 ? "#22c55e" : probRingDisplay >= 63 ? "#f59e0b" : "#6366f1")
    : ringColor;

  return (
    <div style={{
      background: "#0c0f1a", color: "#f1f5f9",
      fontFamily: "ui-monospace,'Courier New',monospace",
      minHeight: compact ? "auto" : "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 10, padding: "12px 12px 16px", boxSizing: "border-box",
      userSelect: "none",
    }}>
      {/* ミニタブバー */}
      <div style={{ display: "flex", gap: 4, width: "100%" }}>
        {([
          { id: "timer" as Tab, icon: "⏱" },
          { id: "stopwatch" as Tab, icon: "⏲" },
          { id: "counter" as Tab, icon: "#" },
          { id: "probability" as Tab, icon: "%" },
        ]).filter(({ id }) => enabledTabs.includes(id)).map(({ id, icon }) => (
          <button key={id} onClick={() => onTabChange(id)} style={{
            flex: 1, padding: "5px 2px", borderRadius: 8,
            background: effectiveTab === id ? "#2563eb" : "#1a2332",
            border: `1px solid ${effectiveTab === id ? "#3b82f6" : "#1e2d45"}`,
            color: effectiveTab === id ? "#fff" : "#475569",
            fontSize: 13, fontWeight: effectiveTab === id ? 700 : 400, cursor: "pointer",
          }}>{icon}</button>
        ))}
      </div>
      {/* Ring */}
      <div style={{ position: "relative", width: 148, height: 148, flexShrink: 0 }}>
        <svg width={148} height={148} style={{ transform: "rotate(-90deg)", display: "block" }}>
          <circle cx={74} cy={74} r={r} fill="none" stroke="#1e2d45" strokeWidth={8} />
          <circle cx={74} cy={74} r={r} fill="none" stroke={activeColor}
            strokeWidth={10} strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.4s ease" }} />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 2,
        }}>
          <span style={{ fontSize: 8, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" }}>
            {tabLabel}
          </span>
          {effectiveTab === "probability" ? (
            <>
              <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
                {hasObservations ? fmtRate(observedRate) : pAtLeastOne.toFixed(2) + "%"}
              </span>
              <span style={{ fontSize: 8, color: "#94a3b8" }}>
                {hasObservations ? "実測ドロップ率" : "P(≥1)"}
              </span>
            </>
          ) : (
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {time}
            </span>
          )}
        </div>
      </div>

      {/* Probability details - 3行: ドロップ数・試行回数・実測ドロップ率 */}
      {effectiveTab === "probability" && (
        <div style={{
          width: "100%", background: "#111827", borderRadius: 10,
          padding: "8px 12px", fontSize: 11, lineHeight: 1.7,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b" }}>{dict.probability.drops}</span>
            <span style={{ color: "#4ade80", fontWeight: 700 }}>{probDrops.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b" }}>{dict.probability.attempts}</span>
            <span style={{ color: "#94a3b8", fontWeight: 700 }}>{probAttempts.toLocaleString()}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b" }}>{dict.probability.observedRate}</span>
            <span style={{ color: "#fbbf24", fontWeight: 700 }}>{fmtRate(observedRate)}</span>
          </div>
        </div>
      )}

      {/* Non-probability main state */}
      {effectiveTab !== "probability" && (
        <div style={{ textAlign: "center", lineHeight: 1.3 }}>
          {effectiveTab === "counter" && (
            <>
              <div style={{ fontSize: 22, fontWeight: 700, color: goal > 0 && count >= goal ? "#22c55e" : "#cbd5e1" }}>
                {count.toLocaleString()}
              </div>
              {goal > 0 && (
                <div style={{ fontSize: 10, color: "#475569" }}>/ {goal.toLocaleString()} ({cPct}%)</div>
              )}
              <div style={{ fontSize: 9, color: "#334155" }}>COUNT</div>
            </>
          )}
        </div>
      )}

      {/* PiP secondary modules */}
      {effectiveTab !== "probability" && pipShowCounter && effectiveTab !== "counter" && (
        <div style={{
          width: "100%", background: "#111827", borderRadius: 10,
          padding: "6px 12px", fontSize: 11,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span style={{ color: "#64748b", fontSize: 9 }}>COUNT </span>
              <span style={{ color: "#cbd5e1", fontWeight: 700 }}>{count.toLocaleString()}</span>
              {goal > 0 && <span style={{ color: "#475569", fontSize: 9 }}> /{goal} ({cPct}%)</span>}
            </div>
            <button onClick={onCounterInc} style={{
              background: "#1e3a5f", border: "1px solid #2563eb", borderRadius: 8,
              color: "#93c5fd", fontWeight: 800, fontSize: 13, padding: "4px 10px", cursor: "pointer",
            }}>+1</button>
          </div>
        </div>
      )}

      {effectiveTab !== "probability" && pipShowProbability && (
        <div style={{
          width: "100%", background: "#111827", borderRadius: 10,
          padding: "6px 12px", fontSize: 11,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <div>
              <span style={{ color: "#64748b", fontSize: 9 }}>DROP </span>
              <span style={{ color: "#4ade80", fontWeight: 700 }}>{probDrops}</span>
              <span style={{ color: "#334155" }}> / </span>
              <span style={{ color: "#64748b", fontSize: 9 }}>TRY </span>
              <span style={{ color: "#94a3b8", fontWeight: 700 }}>{probAttempts}</span>
            </div>
            <span style={{ color: "#fbbf24", fontWeight: 700 }}>{fmtRate(observedRate)}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onProbDropInc} style={{
              flex: 1, background: "#14532d", border: "1px solid #22c55e", borderRadius: 8,
              color: "#4ade80", fontWeight: 800, fontSize: 11, padding: "4px 0", cursor: "pointer",
            }}>+Drop</button>
            <button onClick={onProbAttemptInc} style={{
              flex: 1, background: "#1e2d45", border: "1px solid #3b82f6", borderRadius: 8,
              color: "#93c5fd", fontWeight: 700, fontSize: 11, padding: "4px 0", cursor: "pointer",
            }}>+試行</button>
          </div>
        </div>
      )}

      {/* ── カウンター：リング元選択 ── */}
      {effectiveTab === "counter" && (
        <div style={{ display: "flex", gap: 4, width: "100%" }}>
          {([
            { id: "stopwatch" as const, label: "⏲ SW" },
            { id: "timer" as const, label: "⏱ Timer" },
          ]).map(({ id, label }) => (
            <button key={id} onClick={() => onCounterPipSourceChange(id)} style={{
              flex: 1, padding: "4px 2px", borderRadius: 8, fontSize: 11, cursor: "pointer",
              background: counterPipSource === id ? "#4f46e5" : "#1a2332",
              border: `1px solid ${counterPipSource === id ? "#818cf8" : "#1e2d45"}`,
              color: counterPipSource === id ? "#fff" : "#475569",
              fontWeight: counterPipSource === id ? 700 : 400,
            }}>{label}</button>
          ))}
        </div>
      )}

      {/* ── タイマー：時間追加ボタン ── */}
      {effectiveTab === "timer" && (
        <div style={{ display: "flex", gap: 4, width: "100%" }}>
          {([-60, 60, 300] as const).map((s) => (
            <button key={s} onClick={() => onTimerAddTime(s)} style={{
              flex: 1, padding: "4px 2px", borderRadius: 8, fontSize: 11, cursor: "pointer",
              background: "#1a2332", border: "1px solid #1e2d45", color: "#93c5fd",
            }}>{s < 0 ? `${s / 60}分` : `+${s / 60}分`}</button>
          ))}
        </div>
      )}

      {/* ── アクションボタン ── */}
      <div style={{ display: "flex", gap: 6, width: "100%", marginTop: 2 }}>
        {/* リセットボタン */}
        <button onClick={
          effectiveTab === "timer" ? onTimerReset :
          effectiveTab === "stopwatch" ? onSwReset :
          effectiveTab === "counter" ? onCounterReset : onProbReset
        } style={{
          width: 40, height: 40, borderRadius: "50%", cursor: "pointer",
          background: "#1a2332", border: "1px solid #334155",
          color: "#64748b", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center",
        }}>↺</button>

        {/* 再生/停止ボタン（確率以外） */}
        {effectiveTab !== "probability" && (
          <button onClick={onPlayPause} style={{
            flex: effectiveTab === "counter" ? 1 : 2, height: 40, borderRadius: 12,
            background: isRunning ? "#d97706" : "#2563eb",
            border: "none", cursor: "pointer", fontSize: 18, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}>{isRunning ? "⏸" : "▶"}</button>
        )}

        {/* カウンター +1 */}
        {effectiveTab === "counter" && (
          <button onClick={onCounterInc} style={{
            flex: 1, height: 40, borderRadius: 12,
            background: "#1e3a5f", border: "2px solid #2563eb",
            cursor: "pointer", fontSize: 15, fontWeight: 800, color: "#93c5fd",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>+1</button>
        )}

        {/* 確率：+Drop / +試行 */}
        {effectiveTab === "probability" && (
          <>
            <button onClick={onProbDropInc} style={{
              flex: 1, height: 40, borderRadius: 12,
              background: "#14532d", border: "2px solid #22c55e",
              color: "#4ade80", fontWeight: 800, fontSize: 12, cursor: "pointer",
            }}>+Drop</button>
            <button onClick={onProbAttemptInc} style={{
              flex: 1, height: 40, borderRadius: 12,
              background: "#1e2d45", border: "2px solid #3b82f6",
              color: "#93c5fd", fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}>+試行</button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 select-none">
      <span className="text-sm text-gray-700">{label}</span>
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-gray-200"}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
      </button>
    </label>
  );
}

// ─── Number Spinner ────────────────────────────────────────────────────────────
function Spinner({ value, onChange, min, max, step = 1, decimals = 0, label }: {
  value: number; onChange: (v: number) => void; min: number; max: number;
  step?: number; decimals?: number; label: string;
}) {
  const [raw, setRaw] = useState(value.toFixed(decimals));
  useEffect(() => { setRaw(value.toFixed(decimals)); }, [value, decimals]);
  const commit = (v: string) => {
    const n = parseFloat(v);
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)));
  };
  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <span className="text-xs text-gray-500 font-medium">{label}</span>
      <div className="flex items-center gap-0 rounded-xl border border-gray-200 overflow-hidden">
        <button onClick={() => onChange(Math.max(min, value - step))}
          className="flex h-9 w-9 items-center justify-center bg-gray-50 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
          <ChevronDown size={16} strokeWidth={2.5} />
        </button>
        <input type="number" min={min} max={max} step={step}
          value={raw} onChange={e => setRaw(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => e.key === "Enter" && commit(raw)}
          className="w-20 bg-white py-2 text-center text-lg font-extrabold tabular-nums text-gray-900 focus:outline-none border-x border-gray-200" />
        <button onClick={() => onChange(Math.min(max, value + step))}
          className="flex h-9 w-9 items-center justify-center bg-gray-50 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
          <ChevronUp size={16} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function TimerCounterTool({ dict }: Props) {
  const [tab, setTab] = useState<Tab>("timer");

  // ── Timer ──────────────────────────────────────────────────────────────────
  const [timerH, setTimerH] = useState(0);
  const [timerM, setTimerM] = useState(25);
  const [timerS, setTimerS] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [timerTotal, setTimerTotal] = useState(0);
  const [timerDone, setTimerDone] = useState(false);
  const [editMode, setEditMode] = useState(true);
  const timerEndRef = useRef(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Stopwatch ──────────────────────────────────────────────────────────────
  const [swRunning, setSwRunning] = useState(false);
  const [swElapsed, setSwElapsed] = useState(0);
  const [swLaps, setSwLaps] = useState<number[]>([]);
  const swStartWallRef = useRef(0); // Date.now() when stopwatch last started
  const swOffsetRef = useRef(0);
  const swRafRef = useRef<number | null>(null);

  // ── Counter ────────────────────────────────────────────────────────────────
  const [count, setCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("yuu-tc-count") ?? "0", 10) || 0;
  });
  const [goal, setGoal] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("yuu-tc-goal") ?? "0", 10) || 0;
  });
  const [goalInput, setGoalInput] = useState("");
  const [countAnim, setCountAnim] = useState<"up" | "down" | null>(null);

  // ── Probability (theoretical) ──────────────────────────────────────────────
  const [calcN, setCalcN] = useState<number>(() => {
    if (typeof window === "undefined") return 100;
    return parseInt(localStorage.getItem("yuu-tc-calc-n") ?? "100", 10) || 100;
  });
  const [calcPStr, setCalcPStr] = useState<string>(() => {
    if (typeof window === "undefined") return "1";
    return localStorage.getItem("yuu-tc-calc-p") ?? "1";
  });

  // ── Probability (observed tracking) ───────────────────────────────────────
  const [probDrops, setProbDrops] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("yuu-tc-prob-drops") ?? "0", 10) || 0;
  });
  const [probAttempts, setProbAttempts] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return parseInt(localStorage.getItem("yuu-tc-prob-attempts") ?? "0", 10) || 0;
  });
  const [probDropAnim, setProbDropAnim] = useState(false);

  // ── PiP module visibility (controls PiP content, not main UI tabs) ─────────
  const [pipShowCounter, setPipShowCounter] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("yuu-tc-pip-counter") !== "false";
  });
  const [pipShowProbability, setPipShowProbability] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("yuu-tc-pip-prob") !== "false";
  });
  const [pipShowTimer, setPipShowTimer] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("yuu-tc-pip-timer") !== "false";
  });
  const [pipShowStopwatch, setPipShowStopwatch] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("yuu-tc-pip-sw") !== "false";
  });
  const [counterPipSource, setCounterPipSource] = useState<"stopwatch" | "timer">(() => {
    if (typeof window === "undefined") return "stopwatch";
    return (localStorage.getItem("yuu-tc-counter-pip-source") as "stopwatch" | "timer") ?? "stopwatch";
  });
  const [showSettings, setShowSettings] = useState(false);

  // ── PiP ────────────────────────────────────────────────────────────────────
  const [pipSupported, setPipSupported] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [pipFallback, setPipFallback] = useState(false);
  const pipWinRef = useRef<Window | null>(null);
  const pipRootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const pipHandlersRef = useRef({
    playPause: () => {},
    counterInc: () => {},
    probDropInc: () => {},
    probAttemptInc: () => {},
    tabChange: (_t: Tab) => {},
    timerReset: () => {},
    swReset: () => {},
    counterReset: () => {},
    probReset: () => {},
    timerAddTime: (_s: number) => {},
    counterPipSourceChange: (_s: "stopwatch" | "timer") => {},
  });

  // ── Fallback overlay drag/resize ──────────────────────────────────────────
  const [pipPos, setPipPos] = useState<{ x: number; y: number } | null>(null);
  const [pipSize, setPipSize] = useState<{ w: number; h: number } | null>(null);
  const pipSizeRef = useRef<{ w: number; h: number }>({ w: 288, h: 300 });
  const overlayDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const overlayResizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  // ── Mobile Canvas Video PiP ───────────────────────────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  const [mobilePipOpen, setMobilePipOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mobilePipActiveRef = useRef(false);
  const canvasRafRef = useRef<number | null>(null);
  const canvasDataRef = useRef({
    display: "00:00",
    pct: 100,
    ringColor: "#6366f1",
    tabLabel: "Timer",
    timerDone: false,
  });

  // ── Background keep: Web Worker + Silent audio + Media Session ───────────
  const [bgKeepEnabled, setBgKeepEnabled] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const workerHandlerRef = useRef<() => void>(() => {});
  const timerWorkerRef = useRef<Worker | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const silentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // ─── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setPipSupported("documentPictureInPicture" in window);
    setGoalInput(goal > 0 ? goal.toString() : "");
    // Mobile detection
    const ua = navigator.userAgent || "";
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(ua) || window.innerWidth <= 768);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Video PiP leave event ────────────────────────────────────────────────
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLeave = () => {
      mobilePipActiveRef.current = false;
      if (canvasRafRef.current) cancelAnimationFrame(canvasRafRef.current);
      setMobilePipOpen(false);
    };
    video.addEventListener("leavepictureinpicture", onLeave);
    return () => video.removeEventListener("leavepictureinpicture", onLeave);
  }, []);

  // ─── Timer Web Worker: create on mount, destroy on unmount ───────────────────
  // Worker handles ticking so the main thread throttle doesn't affect accuracy
  useEffect(() => {
    if (typeof window === "undefined") return;
    const workerCode = `
      let tid = null;
      self.onmessage = function(e) {
        if (e.data === 'start') {
          if (tid !== null) clearInterval(tid);
          tid = setInterval(function() { self.postMessage('tick'); }, 200);
        } else if (e.data === 'stop') {
          if (tid !== null) { clearInterval(tid); tid = null; }
        }
      };
    `;
    const blob = new Blob([workerCode], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.onmessage = () => workerHandlerRef.current();
    timerWorkerRef.current = worker;
    URL.revokeObjectURL(url);
    return () => { worker.terminate(); timerWorkerRef.current = null; };
  }, []);

  // ─── Persist ───────────────────────────────────────────────────────────────
  useEffect(() => { localStorage.setItem("yuu-tc-count", count.toString()); }, [count]);
  useEffect(() => { localStorage.setItem("yuu-tc-goal", goal.toString()); }, [goal]);
  useEffect(() => { localStorage.setItem("yuu-tc-prob-drops", probDrops.toString()); }, [probDrops]);
  useEffect(() => { localStorage.setItem("yuu-tc-prob-attempts", probAttempts.toString()); }, [probAttempts]);
  useEffect(() => { localStorage.setItem("yuu-tc-calc-n", calcN.toString()); }, [calcN]);
  useEffect(() => { localStorage.setItem("yuu-tc-calc-p", calcPStr); }, [calcPStr]);
  useEffect(() => { localStorage.setItem("yuu-tc-pip-counter", pipShowCounter.toString()); }, [pipShowCounter]);
  useEffect(() => { localStorage.setItem("yuu-tc-pip-prob", pipShowProbability.toString()); }, [pipShowProbability]);
  useEffect(() => { localStorage.setItem("yuu-tc-pip-timer", pipShowTimer.toString()); }, [pipShowTimer]);
  useEffect(() => { localStorage.setItem("yuu-tc-pip-sw", pipShowStopwatch.toString()); }, [pipShowStopwatch]);
  useEffect(() => { localStorage.setItem("yuu-tc-counter-pip-source", counterPipSource); }, [counterPipSource]);

  // ─── Fallback overlay: position/size initialization ───────────────────────
  useEffect(() => {
    if (pipFallback) {
      const w = Math.max(200, Math.floor(window.innerWidth / 2));
      const h = Math.max(150, Math.floor(window.innerHeight / 4));
      const x = Math.max(0, window.innerWidth - w - 16);
      const y = Math.max(0, window.innerHeight - h - 16);
      pipSizeRef.current = { w, h };
      setPipSize({ w, h });
      setPipPos({ x, y });
    } else {
      setPipPos(null);
      setPipSize(null);
    }
  }, [pipFallback]);

  // ─── Fallback overlay: global drag/resize pointer handlers ───────────────
  useEffect(() => {
    const getXY = (e: MouseEvent | TouchEvent): { x: number; y: number } =>
      'touches' in e
        ? { x: (e as TouchEvent).touches[0].clientX, y: (e as TouchEvent).touches[0].clientY }
        : { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY };

    const onMove = (e: MouseEvent | TouchEvent) => {
      if (overlayDragRef.current) {
        const { x, y } = getXY(e);
        const d = overlayDragRef.current;
        const sz = pipSizeRef.current;
        const nx = Math.max(0, Math.min(window.innerWidth - sz.w, d.startPosX + x - d.startX));
        const ny = Math.max(0, Math.min(window.innerHeight - 44, d.startPosY + y - d.startY));
        if ('touches' in e) e.preventDefault();
        setPipPos({ x: nx, y: ny });
      }
      if (overlayResizeRef.current) {
        const { x, y } = getXY(e);
        const d = overlayResizeRef.current;
        const nw = Math.max(200, Math.min(window.innerWidth, d.startW + x - d.startX));
        const nh = Math.max(150, Math.min(window.innerHeight, d.startH + y - d.startY));
        if ('touches' in e) e.preventDefault();
        pipSizeRef.current = { w: nw, h: nh };
        setPipSize({ w: nw, h: nh });
      }
    };
    const onEnd = () => { overlayDragRef.current = null; overlayResizeRef.current = null; };

    window.addEventListener('mousemove', onMove as EventListener);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove as EventListener, { passive: false });
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove as EventListener);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove as EventListener);
      window.removeEventListener('touchend', onEnd);
    };
  }, []);

  // ─── Worker ticking: runs while timer OR stopwatch is active ────────────────
  // timerEndRef は timerStart/timerResume で設定済みのためここでは触らない
  useEffect(() => {
    const shouldRun = timerRunning || swRunning;
    if (!shouldRun) {
      timerWorkerRef.current?.postMessage("stop");
      if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
      return;
    }
    if (timerWorkerRef.current) {
      timerWorkerRef.current.postMessage("start");
    } else {
      // Worker 非対応環境: setInterval フォールバック
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = setInterval(() => workerHandlerRef.current(), 200);
    }
    return () => {
      timerWorkerRef.current?.postMessage("stop");
      if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning, swRunning]);

  // ─── Stopwatch RAF (wall-clock based – survives device sleep) ────────────────
  useEffect(() => {
    if (!swRunning) { if (swRafRef.current) cancelAnimationFrame(swRafRef.current); return; }
    swStartWallRef.current = Date.now();
    const loop = () => {
      setSwElapsed(swOffsetRef.current + Date.now() - swStartWallRef.current);
      swRafRef.current = requestAnimationFrame(loop);
    };
    swRafRef.current = requestAnimationFrame(loop);
    return () => { if (swRafRef.current) cancelAnimationFrame(swRafRef.current); };
  }, [swRunning]);

  // ─── Derived values ──────────────────────────────────────────────────────────
  const timerTotalSec = timerH * 3600 + timerM * 60 + timerS;
  const effectiveTotal = timerTotal > 0 ? timerTotal : timerTotalSec;
  const timerPct = timerRemaining !== null && effectiveTotal > 0
    ? Math.max(0, Math.min(100, (timerRemaining / effectiveTotal) * 100))
    : timerDone ? 0 : 100;
  const timerRingColor = timerDone ? "#22c55e" : timerPct < 20 ? "#ef4444" : timerPct < 50 ? "#f59e0b" : "#6366f1";
  const swPct = ((swElapsed / 1000) % 60) / 60 * 100;
  const counterPct = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;
  const counterRingColor = counterPct >= 100 ? "#22c55e" : counterPct > 70 ? "#f59e0b" : "#6366f1";

  // ─── Probability derived values ──────────────────────────────────────────────
  const calcP = parseFloat(calcPStr) || 0;
  const calcPDecimal = calcP / 100;
  const pAtLeastOne = calcPDecimal > 0 && calcPDecimal < 1
    ? (1 - Math.pow(1 - calcPDecimal, calcN)) * 100
    : calcPDecimal >= 1 ? 100 : 0;
  const distribution = calcPDecimal > 0 ? calcDistribution(calcN, calcPDecimal) : null;
  const expectedPerDrop = calcPDecimal > 0 ? Math.ceil(1 / calcPDecimal) : 0;
  const trialsFor95 = calcPDecimal > 0 && calcPDecimal < 1
    ? Math.ceil(Math.log(0.05) / Math.log(1 - calcPDecimal)) : calcPDecimal >= 1 ? 1 : 0;
  const trialsFor99 = calcPDecimal > 0 && calcPDecimal < 1
    ? Math.ceil(Math.log(0.01) / Math.log(1 - calcPDecimal)) : calcPDecimal >= 1 ? 1 : 0;
  const observedRate = probAttempts > 0 ? probDrops / probAttempts * 100 : 0;
  const probRingPct = pAtLeastOne;
  const probRingColor = probRingPct >= 95 ? "#22c55e" : probRingPct >= 63 ? "#f59e0b" : "#6366f1";

  const currentDisplay = tab === "stopwatch" ? fmtMs(swElapsed)
    : tab === "counter"
      ? (counterPipSource === "stopwatch" ? fmtMs(swElapsed) : timerRemaining !== null ? fmtSec(timerRemaining) : fmtSec(timerTotalSec))
      : timerRemaining !== null ? fmtSec(timerRemaining) : fmtSec(timerTotalSec);
  const counterPipPct = counterPipSource === "stopwatch" ? swPct : timerPct;
  const counterPipRingColor = counterPipSource === "stopwatch" ? "#6366f1" : timerRingColor;
  const currentPct = tab === "stopwatch" ? swPct : tab === "counter" ? counterPipPct
    : tab === "probability" ? probRingPct : timerPct;
  const currentRingColor = tab === "stopwatch" ? "#6366f1" : tab === "counter" ? counterPipRingColor
    : tab === "probability" ? probRingColor : timerRingColor;
  const currentTabLabel = tab === "timer" ? dict.tabs.timer : tab === "stopwatch" ? dict.tabs.stopwatch
    : tab === "counter" ? dict.tabs.counter : dict.tabs.probability;
  const isRunning = tab === "timer" ? timerRunning : tab === "stopwatch" ? swRunning
    : tab === "counter" ? (counterPipSource === "stopwatch" ? swRunning : timerRunning) : false;

  // ─── Timer handlers ───────────────────────────────────────────────────────────
  const timerStart = useCallback(() => {
    const total = timerH * 3600 + timerM * 60 + timerS;
    if (total <= 0 && timerRemaining === null) return;
    const remaining = timerRemaining ?? total;
    if (timerRemaining === null) { setTimerTotal(total); setTimerRemaining(total); setTimerDone(false); }
    timerEndRef.current = Date.now() + remaining * 1000;
    setEditMode(false); setTimerRunning(true);
  }, [timerH, timerM, timerS, timerRemaining]);
  const timerPause = useCallback(() => setTimerRunning(false), []);
  const timerReset = useCallback(() => {
    setTimerRunning(false); setTimerRemaining(null); setTimerDone(false); setTimerTotal(0);
    timerEndRef.current = 0; setEditMode(true);
  }, []);
  const timerResume = useCallback(() => {
    if (timerRemaining !== null && timerRemaining > 0) {
      timerEndRef.current = Date.now() + timerRemaining * 1000;
    }
    setTimerRunning(true);
  }, [timerRemaining]);

  // ─── Stopwatch handlers ───────────────────────────────────────────────────────
  const swStart = useCallback(() => setSwRunning(true), []);
  const swPause = useCallback(() => {
    swOffsetRef.current += Date.now() - swStartWallRef.current;
    setSwRunning(false);
  }, []);
  const swReset = useCallback(() => {
    setSwRunning(false); setSwElapsed(0); setSwLaps([]); swOffsetRef.current = 0;
  }, []);
  const swLap = useCallback(() => { setSwLaps((prev) => [swElapsed, ...prev]); }, [swElapsed]);

  // ─── Counter handlers ─────────────────────────────────────────────────────────
  const triggerCountAnim = (dir: "up" | "down") => {
    setCountAnim(dir);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    setTimeout(() => setCountAnim(null), 260);
  };
  const inc = useCallback((n: number) => { setCount((c) => c + n); triggerCountAnim("up"); }, []);
  const dec = useCallback((n: number) => { setCount((c) => Math.max(0, c - n)); triggerCountAnim("down"); }, []);
  const resetCounter = useCallback(() => setCount(0), []);
  const applyGoal = useCallback(() => {
    const n = parseInt(goalInput, 10);
    setGoal(!isNaN(n) && n > 0 ? n : 0);
  }, [goalInput]);

  // ─── Probability handlers ─────────────────────────────────────────────────────
  const incProbDrop = useCallback(() => {
    setProbDrops((d) => d + 1);
    setProbAttempts((a) => a + 1);
    setProbDropAnim(true);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(20);
    setTimeout(() => setProbDropAnim(false), 260);
  }, []);
  const incProbAttempt = useCallback(() => setProbAttempts((a) => a + 1), []);
  const resetProb = useCallback(() => { setProbDrops(0); setProbAttempts(0); }, []);

  // ─── Timer add time ────────────────────────────────────────────────────────────
  const timerAddTime = useCallback((s: number) => {
    if (editMode) {
      const total = Math.max(0, timerH * 3600 + timerM * 60 + timerS + s);
      setTimerH(Math.min(23, Math.floor(total / 3600)));
      setTimerM(Math.floor((total % 3600) / 60));
      setTimerS(total % 60);
    } else if (timerRemaining !== null) {
      const newRem = Math.max(0, timerRemaining + s);
      setTimerRemaining(newRem);
      if (timerRunning) timerEndRef.current = Date.now() + newRem * 1000;
      setTimerTotal((prev) => Math.max(prev, newRem));
    }
  }, [editMode, timerH, timerM, timerS, timerRemaining, timerRunning]);

  // ─── Worker tick handler (updated every render to avoid stale closure) ──────
  workerHandlerRef.current = () => {
    // ── タイマー ──
    if (timerRunning && timerEndRef.current > 0) {
      const rem = Math.ceil((timerEndRef.current - Date.now()) / 1000);
      if (rem <= 0) {
        timerWorkerRef.current?.postMessage("stop");
        timerEndRef.current = 0;
        setTimerRemaining(0); setTimerRunning(false); setTimerDone(true);
      } else {
        setTimerRemaining(rem);
      }
    }
    // ── ストップウォッチ（バックグラウンドでも Date.now() 差分で更新） ──
    if (swRunning) {
      setSwElapsed(swOffsetRef.current + Date.now() - swStartWallRef.current);
    }
  };

  // ─── Background keep: silent audio + Media Session ────────────────────────────
  const startBgKeep = useCallback(() => {
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const buf = ctx.createBuffer(1, ctx.sampleRate * 3, ctx.sampleRate);
      // Buffer is all-zeros (silent) – keeps the page "active" in the OS
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(ctx.destination);
      src.start();
      silentSourceRef.current = src;
    } catch { /* AudioContext not available */ }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ms = (navigator as any).mediaSession;
      if (ms) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ms.metadata = new (window as any).MediaMetadata({
          title: "タイマー / ストップウォッチ",
          artist: "稼働中",
          album: "Timer & Counter",
        });
        ms.setActionHandler("play", () => pipHandlersRef.current.playPause());
        ms.setActionHandler("pause", () => pipHandlersRef.current.playPause());
      }
    } catch { /* Media Session not available */ }
  }, []);

  const stopBgKeep = useCallback(() => {
    try { silentSourceRef.current?.stop(); } catch { /* noop */ }
    silentSourceRef.current = null;
    try { audioCtxRef.current?.close(); } catch { /* noop */ }
    audioCtxRef.current = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ms = (navigator as any).mediaSession;
      if (ms) {
        ms.metadata = null;
        ms.setActionHandler("play", null);
        ms.setActionHandler("pause", null);
      }
    } catch { /* noop */ }
  }, []);

  const toggleBgKeep = useCallback(() => {
    if (bgKeepEnabled) { stopBgKeep(); setBgKeepEnabled(false); }
    else { startBgKeep(); setBgKeepEnabled(true); }
  }, [bgKeepEnabled, startBgKeep, stopBgKeep]);

  // ─── Media Session metadata update (title/playback state) ────────────────────
  useEffect(() => {
    if (!bgKeepEnabled) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ms = (navigator as any).mediaSession;
      if (!ms) return;
      const isActive = timerRunning || swRunning;
      ms.playbackState = isActive ? "playing" : "paused";
      const timeStr = tab === "stopwatch" ? fmtMs(swElapsed)
        : timerRemaining !== null ? fmtSec(timerRemaining) : "待機中";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ms.metadata = new (window as any).MediaMetadata({
        title: tab === "stopwatch" ? "ストップウォッチ" : "タイマー",
        artist: timeStr,
        album: "Timer & Counter",
      });
    } catch { /* noop */ }
  }, [bgKeepEnabled, timerRunning, swRunning, tab, swElapsed, timerRemaining]);

  // ─── Visibility change: resync on wake from sleep ─────────────────────────────
  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      // iOS/Android でスリープ復帰後に AudioContext が suspended になるため resume する
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume().catch(() => {/* noop */});
      }
      // Stopwatch: Date.now() survived sleep, recalculate
      if (swRunning) {
        setSwElapsed(swOffsetRef.current + Date.now() - swStartWallRef.current);
      }
      // Timer: check timestamp and finalize or re-tick
      if (timerRunning && timerEndRef.current > 0) {
        const rem = Math.ceil((timerEndRef.current - Date.now()) / 1000);
        if (rem <= 0) {
          timerWorkerRef.current?.postMessage("stop");
          setTimerRemaining(0); setTimerRunning(false); setTimerDone(true);
        } else {
          setTimerRemaining(rem);
          timerWorkerRef.current?.postMessage("start");
        }
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [swRunning, timerRunning]);

  // ─── Sync canvas data ref (used by mobile PiP RAF loop) ─────────────────────
  canvasDataRef.current = {
    display: currentDisplay,
    pct: currentPct,
    ringColor: currentRingColor,
    tabLabel: currentTabLabel,
    timerDone,
  };

  // ─── PiP handlers ref ────────────────────────────────────────────────────────
  pipHandlersRef.current = {
    playPause: () => {
      if (tab === "timer") timerRunning ? timerPause() : timerRemaining !== null ? timerResume() : timerStart();
      else if (tab === "stopwatch") swRunning ? swPause() : swStart();
      else if (tab === "counter") {
        if (counterPipSource === "stopwatch") swRunning ? swPause() : swStart();
        else timerRunning ? timerPause() : timerRemaining !== null ? timerResume() : timerStart();
      }
    },
    counterInc: () => inc(1),
    probDropInc: () => incProbDrop(),
    probAttemptInc: () => incProbAttempt(),
    tabChange: (t: Tab) => setTab(t),
    timerReset: () => timerReset(),
    swReset: () => swReset(),
    counterReset: () => resetCounter(),
    probReset: () => resetProb(),
    timerAddTime: (s: number) => timerAddTime(s),
    counterPipSourceChange: (s: "stopwatch" | "timer") => setCounterPipSource(s),
  };

  // ─── PiP render ───────────────────────────────────────────────────────────────
  const renderPip = useCallback(() => {
    if (!pipRootRef.current) return;
    pipRootRef.current.render(
      <PipView
        time={currentDisplay} count={count} goal={goal}
        tabLabel={currentTabLabel} tab={tab} isRunning={isRunning}
        pct={currentPct} ringColor={currentRingColor}
        probDrops={probDrops} probAttempts={probAttempts} observedPct={observedRate}
        calcN={calcN} calcP={calcP} pAtLeastOne={pAtLeastOne}
        pipShowCounter={pipShowCounter} pipShowProbability={pipShowProbability}
        pipShowTimer={pipShowTimer} pipShowStopwatch={pipShowStopwatch}
        dict={dict}
        onPlayPause={() => pipHandlersRef.current.playPause()}
        onCounterInc={() => pipHandlersRef.current.counterInc()}
        onProbDropInc={() => pipHandlersRef.current.probDropInc()}
        onProbAttemptInc={() => pipHandlersRef.current.probAttemptInc()}
        onTabChange={(t) => pipHandlersRef.current.tabChange(t)}
        onTimerReset={() => pipHandlersRef.current.timerReset()}
        onSwReset={() => pipHandlersRef.current.swReset()}
        onCounterReset={() => pipHandlersRef.current.counterReset()}
        onProbReset={() => pipHandlersRef.current.probReset()}
        onTimerAddTime={(s) => pipHandlersRef.current.timerAddTime(s)}
        counterPipSource={counterPipSource}
        onCounterPipSourceChange={(s) => pipHandlersRef.current.counterPipSourceChange(s)}
      />
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDisplay, count, goal, currentTabLabel, tab, isRunning, currentPct, currentRingColor,
    probDrops, probAttempts, observedRate, calcN, calcP, pAtLeastOne,
    pipShowCounter, pipShowProbability, pipShowTimer, pipShowStopwatch, counterPipSource, dict]);

  useEffect(() => { if (pipOpen || pipFallback) renderPip(); }, [pipOpen, pipFallback, renderPip]);

  // ─── PiP open ─────────────────────────────────────────────────────────────────
  const openPip = useCallback(async () => {
    if (!("documentPictureInPicture" in window)) {
      pipRootRef.current = createRoot(document.createElement("div"));
      setPipFallback(true); return;
    }
    try {
      const pipWin = await window.documentPictureInPicture!.requestWindow({ width: 280, height: 420 });
      pipWinRef.current = pipWin;
      for (const sheet of document.styleSheets) {
        try {
          const rules = [...sheet.cssRules].map((r) => r.cssText).join("");
          const s = pipWin.document.createElement("style");
          s.textContent = rules; pipWin.document.head.appendChild(s);
        } catch {
          if (sheet.href) {
            const l = pipWin.document.createElement("link");
            l.rel = "stylesheet"; l.href = sheet.href; pipWin.document.head.appendChild(l);
          }
        }
      }
      const wrap = pipWin.document.createElement("div");
      pipWin.document.body.style.margin = "0";
      pipWin.document.body.appendChild(wrap);
      pipRootRef.current = createRoot(wrap);
      pipWin.addEventListener("pagehide", () => {
        pipWinRef.current = null; pipRootRef.current = null; setPipOpen(false);
      });
      setPipOpen(true);
    } catch {
      pipRootRef.current = createRoot(document.createElement("div"));
      setPipFallback(true);
    }
  }, []);

  const closePip = useCallback(() => {
    try { pipWinRef.current?.close(); } catch { /* noop */ }
    pipWinRef.current = null; pipRootRef.current = null; setPipOpen(false); setPipFallback(false);
  }, []);

  // ─── Mobile Canvas Video PiP ──────────────────────────────────────────────
  const openMobilePip = useCallback(async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;
    // Size: screen width/3 × screen height/8
    const sw = window.screen.width;
    const sh = window.screen.height;
    canvas.width = Math.floor(sw / 3);
    canvas.height = Math.floor(sh / 8);
    // Initial frame draw
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const d = canvasDataRef.current;
      drawCanvasFrame(ctx, canvas.width, canvas.height, d.display, d.pct, d.ringColor, d.tabLabel, d.timerDone);
    }
    try {
      const stream = canvas.captureStream(30);
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await video.requestPictureInPicture();
      setMobilePipOpen(true);
    } catch (e) {
      console.warn("Mobile Canvas PiP failed:", e);
    }
  }, []);

  const closeMobilePip = useCallback(async () => {
    mobilePipActiveRef.current = false;
    if (canvasRafRef.current) cancelAnimationFrame(canvasRafRef.current);
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
    } catch { /* noop */ }
    setMobilePipOpen(false);
  }, []);

  // ─── Canvas RAF loop (runs while mobilePipOpen) ───────────────────────────
  useEffect(() => {
    if (!mobilePipOpen) {
      mobilePipActiveRef.current = false;
      if (canvasRafRef.current) cancelAnimationFrame(canvasRafRef.current);
      return;
    }
    mobilePipActiveRef.current = true;
    const loop = () => {
      if (!mobilePipActiveRef.current) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const d = canvasDataRef.current;
          drawCanvasFrame(ctx, canvas.width, canvas.height, d.display, d.pct, d.ringColor, d.tabLabel, d.timerDone);
        }
      }
      canvasRafRef.current = requestAnimationFrame(loop);
    };
    canvasRafRef.current = requestAnimationFrame(loop);
    return () => {
      mobilePipActiveRef.current = false;
      if (canvasRafRef.current) cancelAnimationFrame(canvasRafRef.current);
    };
  }, [mobilePipOpen]);

  // ─── Probability distribution color ──────────────────────────────────────────
  const distBarColor = (prob: number) => {
    if (prob >= 0.3) return "bg-indigo-500";
    if (prob >= 0.15) return "bg-indigo-400";
    if (prob >= 0.05) return "bg-indigo-300";
    return "bg-indigo-200";
  };

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border border-gray-200 bg-gray-50 p-1">
        {([
          { id: "timer" as Tab, label: dict.tabs.timer, icon: <Timer size={14} strokeWidth={2} /> },
          { id: "stopwatch" as Tab, label: dict.tabs.stopwatch, icon: <Clock size={14} strokeWidth={2} /> },
          { id: "counter" as Tab, label: dict.tabs.counter, icon: <Hash size={14} strokeWidth={2} /> },
          { id: "probability" as Tab, label: dict.tabs.probability, icon: <Percent size={14} strokeWidth={2} /> },
        ]).map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all ${
              tab === t.id ? "bg-white shadow text-indigo-600 border border-gray-200" : "text-gray-500 hover:text-gray-700"}`}>
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.slice(0, 4)}</span>
          </button>
        ))}
      </div>

      {/* ══════════ TIMER ══════════ */}
      {tab === "timer" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-6 p-6">
            {editMode ? (
              <>
                <div className="flex items-end justify-center gap-2">
                  {([
                    { label: dict.timer.hours, val: timerH, set: setTimerH, max: 23 },
                    { label: dict.timer.minutes, val: timerM, set: setTimerM, max: 59 },
                    { label: dict.timer.seconds, val: timerS, set: setTimerS, max: 59 },
                  ] as const).map(({ label, val, set, max }, i) => (
                    <div key={label} className="flex items-end gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <button onClick={() => (set as (v: number) => void)(Math.min(max, val + 1))}
                          className="flex h-8 w-20 items-center justify-center rounded-t-xl bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">▲</button>
                        <div className="w-20 rounded-none border-y border-gray-200 bg-gray-50 py-2 text-center text-3xl font-extrabold tabular-nums text-gray-900 leading-none">
                          {pad(val)}
                        </div>
                        <button onClick={() => (set as (v: number) => void)(Math.max(0, val - 1))}
                          className="flex h-8 w-20 items-center justify-center rounded-b-xl bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">▼</button>
                        <span className="mt-1 text-xs text-gray-400">{label}</span>
                      </div>
                      {i < 2 && <span className="mb-10 text-2xl font-bold text-gray-300">:</span>}
                    </div>
                  ))}
                </div>
                <button onClick={timerStart} disabled={timerTotalSec === 0}
                  className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-base font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40 active:scale-95">
                  <Play size={18} fill="white" />{dict.timer.start}
                </button>
              </>
            ) : (
              <>
                <div className="relative">
                  <Ring pct={timerPct} color={timerRingColor} size={240} track="#f1f5f9" sw={12} />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <span className="text-5xl font-extrabold tabular-nums tracking-tight text-gray-900">
                      {timerRemaining !== null ? fmtSec(timerRemaining) : fmtSec(timerTotalSec)}
                    </span>
                    {timerDone && <span className="text-sm font-semibold text-green-600">{dict.timer.complete}</span>}
                    {!timerDone && <span className="text-xs text-gray-400">{Math.round(timerPct)}%</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button onClick={timerReset}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 active:scale-95">
                    <RotateCcw size={20} />
                  </button>
                  {!timerDone && (
                    <button onClick={timerRunning ? timerPause : timerResume}
                      className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-all active:scale-95 ${timerRunning ? "bg-amber-500 hover:bg-amber-600" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                      {timerRunning ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" />}
                    </button>
                  )}
                  <button onClick={() => { timerReset(); setEditMode(true); }}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 active:scale-95">
                    <Edit3 size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════ STOPWATCH ══════════ */}
      {tab === "stopwatch" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-6 p-6">
            <div className="relative">
              <Ring pct={swPct} color="#6366f1" size={240} track="#f1f5f9" sw={12} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span className="text-5xl font-extrabold tabular-nums tracking-tight text-gray-900">{fmtMs(swElapsed)}</span>
                <span className="text-xs text-gray-400">{swLaps.length > 0 && `${swLaps.length} laps`}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={swReset} disabled={swElapsed === 0 && !swRunning}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 active:scale-95">
                <RotateCcw size={20} />
              </button>
              <button onClick={swRunning ? swPause : swStart}
                className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-all active:scale-95 ${swRunning ? "bg-amber-500 hover:bg-amber-600" : "bg-indigo-600 hover:bg-indigo-700"}`}>
                {swRunning ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" />}
              </button>
              <button onClick={swLap} disabled={!swRunning}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 active:scale-95">
                <Flag size={18} />
              </button>
            </div>
            {swLaps.length > 0 && (
              <div className="w-full max-h-48 overflow-y-auto space-y-1.5">
                {swLaps.map((ms, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 text-sm">
                    <span className="text-gray-400">{dict.stopwatch.lapLabel} {swLaps.length - i}</span>
                    <span className="tabular-nums font-semibold text-gray-800">{fmtMs(ms)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════ COUNTER ══════════ */}
      {tab === "counter" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-6 p-6">
            <div className="relative">
              <Ring pct={goal > 0 ? counterPct : 0} color={counterRingColor} size={240}
                track={goal > 0 ? "#f1f5f9" : "#f8fafc"} sw={12} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <div className="text-6xl font-extrabold tabular-nums tracking-tight"
                  style={{
                    transform: countAnim === "up" ? "translateY(-8px) scale(1.08)" : countAnim === "down" ? "translateY(6px) scale(0.94)" : "none",
                    color: goal > 0 && count >= goal ? "#16a34a" : "#111827",
                    transition: "transform 0.22s cubic-bezier(0.34,1.56,0.64,1), color 0.3s",
                  }}>{count.toLocaleString()}</div>
                {goal > 0 && <span className="text-xs text-gray-400">/ {goal.toLocaleString()} &nbsp;{counterPct}%</span>}
                {goal > 0 && counterPct >= 100 && <span className="text-xs font-bold text-green-600">🎉 {dict.counter.goalReached}</span>}
              </div>
            </div>
            <div className="grid w-full grid-cols-5 gap-2">
              <button onClick={() => dec(10)}
                className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95">
                <span className="text-xs leading-none">−10</span>
              </button>
              <button onClick={() => dec(1)}
                className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 py-3 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95">
                <Minus size={20} strokeWidth={2.5} />
              </button>
              <button onClick={() => inc(1)}
                className="col-span-1 flex flex-col items-center justify-center rounded-2xl bg-indigo-600 py-4 text-white shadow-md hover:bg-indigo-700 transition-colors active:scale-95">
                <Plus size={24} strokeWidth={2.5} /><span className="mt-0.5 text-xs">+1</span>
              </button>
              <button onClick={() => inc(5)}
                className="flex flex-col items-center justify-center rounded-2xl bg-indigo-100 py-3 text-indigo-700 hover:bg-indigo-200 transition-colors active:scale-95">
                <span className="text-sm font-bold">+5</span>
              </button>
              <button onClick={() => inc(10)}
                className="flex flex-col items-center justify-center rounded-2xl bg-indigo-50 py-3 text-indigo-600 hover:bg-indigo-100 transition-colors active:scale-95">
                <span className="text-sm font-bold">+10</span>
              </button>
            </div>
            <div className="flex w-full gap-2">
              <button onClick={resetCounter} disabled={count === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors active:scale-95">
                <RotateCcw size={14} />{dict.counter.reset}
              </button>
            </div>
            <div className="flex w-full gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
                <Target size={14} className="shrink-0 text-gray-400" />
                <input type="number" min={1} placeholder={dict.counter.goalPlaceholder} value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && applyGoal()}
                  className="flex-1 bg-transparent py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none" />
              </div>
              <button onClick={applyGoal}
                className="rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-900 transition-colors active:scale-95">
                {dict.counter.setGoal}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">{dict.counter.storageNote}</p>
          </div>
        </div>
      )}

      {/* ══════════ PROBABILITY ══════════ */}
      {tab === "probability" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col gap-5 p-5">

            {/* ─ Theoretical Calculator ─ */}
            <div className="flex flex-col items-center gap-4">
              {/* Ring showing P(≥1) */}
              <div className="relative">
                <Ring pct={probRingPct} color={probRingColor} size={220} track="#f1f5f9" sw={12} />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                  <span className="text-5xl font-extrabold tabular-nums tracking-tight"
                    style={{
                      color: probRingPct >= 95 ? "#16a34a" : probRingPct >= 63 ? "#d97706" : "#4f46e5",
                      transition: "color 0.3s",
                    }}>
                    {pAtLeastOne.toFixed(2)}%
                  </span>
                  <span className="text-xs text-gray-400 font-medium">{dict.probability.pAtLeastOne}</span>
                </div>
              </div>

              {/* Spinners: 試行回数 + 排出率 */}
              <div className="flex items-end justify-center gap-4 flex-wrap">
                <Spinner value={calcN} onChange={setCalcN} min={1} max={10000} step={10}
                  label={dict.probability.calcTrials} />
                <Spinner value={calcP} onChange={(v) => setCalcPStr(v.toFixed(2))} min={0.01} max={100} step={0.1}
                  decimals={2} label={dict.probability.calcRate} />
              </div>

              {/* Quick presets for n */}
              <div className="flex gap-1.5 flex-wrap justify-center">
                {[10, 50, 100, 300, 500, 1000].map((n) => (
                  <button key={n} onClick={() => setCalcN(n)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${calcN === n ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {n}
                  </button>
                ))}
              </div>

              {/* Additional stats */}
              {calcPDecimal > 0 && (
                <div className="w-full grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-center">
                    <div className="text-xs text-gray-400 mb-0.5">{dict.probability.expectedPerDrop}</div>
                    <div className="text-lg font-extrabold text-indigo-700 tabular-nums">
                      {expectedPerDrop.toLocaleString()}<span className="text-xs font-normal text-gray-400 ml-0.5">{dict.probability.trialsSuffix}</span>
                    </div>
                  </div>
                  <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-center">
                    <div className="text-xs text-gray-400 mb-0.5">{dict.probability.trialsFor95}</div>
                    <div className="text-lg font-extrabold text-amber-600 tabular-nums">
                      {trialsFor95.toLocaleString()}<span className="text-xs font-normal text-gray-400 ml-0.5">{dict.probability.trialsSuffix}</span>
                    </div>
                  </div>
                  <div className="col-span-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-center">
                    <div className="text-xs text-gray-400 mb-0.5">{dict.probability.trialsFor99}</div>
                    <div className="text-lg font-extrabold text-red-500 tabular-nums">
                      {trialsFor99.toLocaleString()}<span className="text-xs font-normal text-gray-400 ml-0.5">{dict.probability.trialsSuffix}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─ Probability Distribution Table ─ */}
            {distribution && (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
                <p className="text-xs font-semibold text-indigo-700 mb-3">{dict.probability.distribution}</p>
                <div className="space-y-2">
                  <div className="flex text-xs text-indigo-400 font-medium px-1 mb-1">
                    <span className="w-20">{dict.probability.distributionDrops}</span>
                    <span className="flex-1 text-right">{dict.probability.distributionProb}</span>
                  </div>
                  {distribution.map(({ k, prob }) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="w-20 text-xs text-gray-600 font-medium shrink-0">
                        {k < distribution.length - 1 ? `${k}` : `${k}${dict.probability.atLeastN}`}
                      </span>
                      <div className="flex-1 h-5 bg-white rounded-full overflow-hidden border border-indigo-100">
                        <div className={`h-full rounded-full transition-all duration-500 ${distBarColor(prob)}`}
                          style={{ width: `${Math.min(100, prob * 100)}%` }} />
                      </div>
                      <span className="w-14 text-right text-xs font-bold text-indigo-700 tabular-nums shrink-0">
                        {(prob * 100).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─ Observed Tracking ─ */}
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">{dict.probability.tracking}</p>
                <span className="text-xs text-gray-400">{dict.probability.trackingDesc}</span>
              </div>

              {/* Observed rate display */}
              <div className="flex items-center justify-between rounded-xl bg-white border border-gray-200 px-4 py-3">
                <div className="space-y-0.5">
                  <div className="flex gap-3 text-sm">
                    <span className="text-gray-400 text-xs">{dict.probability.drops}</span>
                    <span className="font-extrabold text-green-600"
                      style={{ transform: probDropAnim ? "scale(1.2)" : "scale(1)", transition: "transform 0.22s", display: "inline-block" }}>
                      {probDrops.toLocaleString()}
                    </span>
                    <span className="text-gray-300">/</span>
                    <span className="text-gray-400 text-xs">{dict.probability.attempts}</span>
                    <span className="font-extrabold text-gray-700">{probAttempts.toLocaleString()}</span>
                  </div>
                  {probAttempts > 0 && (
                    <div className="text-xs text-gray-400">
                      {dict.probability.observedRate}: <span className="font-bold text-amber-600">{fmtRate(observedRate)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick action buttons */}
              <div className="flex gap-2">
                <button onClick={incProbDrop}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-green-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-green-700 transition-colors active:scale-95">
                  <TrendingUp size={16} />{dict.probability.addDrop}
                </button>
                <button onClick={incProbAttempt}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-3 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors active:scale-95">
                  <Plus size={16} />{dict.probability.addAttempt}
                </button>
              </div>

              <button onClick={resetProb} disabled={probDrops === 0 && probAttempts === 0}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2 text-xs text-gray-400 hover:bg-white transition-colors disabled:opacity-40 active:scale-95">
                <RotateCcw size={12} />{dict.probability.reset}
              </button>
              <p className="text-xs text-gray-400 text-center">{dict.probability.storageNote}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Background Keep Toggle ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-700">バックグラウンド継続</p>
          <p className="text-xs text-gray-400 truncate">
            {bgKeepEnabled
              ? "無音再生中 — スリープ中も計測を継続します"
              : "ONにするとスリープ・バックグラウンドでも動き続けます"}
          </p>
        </div>
        <button
          onClick={toggleBgKeep}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
            bgKeepEnabled
              ? "bg-green-600 text-white hover:bg-green-700"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          {bgKeepEnabled ? "🔔 ON" : "🔕 OFF"}
        </button>
      </div>

      {/* ── PiP Settings Panel (PC only) ── */}
      {!isMobile && (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <button onClick={() => setShowSettings((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          <span className="flex items-center gap-2">
            <Settings size={15} className="text-gray-400" />
            {dict.settings.heading}
          </span>
          <span className="text-gray-400 text-xs">{showSettings ? "▲" : "▼"}</span>
        </button>
        {showSettings && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-3">
            <p className="text-xs text-gray-400">{dict.settings.description}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-x-8 sm:gap-y-3">
              <Toggle checked={pipShowTimer} onChange={setPipShowTimer} label={dict.settings.timer} />
              <Toggle checked={pipShowStopwatch} onChange={setPipShowStopwatch} label={dict.settings.stopwatch} />
              <Toggle checked={pipShowCounter} onChange={setPipShowCounter} label={dict.settings.counter} />
              <Toggle checked={pipShowProbability} onChange={setPipShowProbability} label={dict.settings.probability} />
            </div>
          </div>
        )}
      </div>
      )}

      {/* ── PiP Bar ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-indigo-800">{dict.pip.title}</p>
          <p className="truncate text-xs text-indigo-500">
            {isMobile
              ? (typeof document !== "undefined" && "pictureInPictureEnabled" in document)
                ? dict.pip.description
                : dict.pip.unsupported
              : pipSupported ? dict.pip.description : dict.pip.unsupported}
          </p>
        </div>
        {isMobile ? (
          mobilePipOpen ? (
            <button onClick={closeMobilePip}
              className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors">
              <Minimize2 size={14} />{dict.pip.close}
            </button>
          ) : (
            <button onClick={openMobilePip}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
              <PictureInPicture size={14} />{dict.pip.open}
            </button>
          )
        ) : pipOpen || pipFallback ? (
          <button onClick={closePip}
            className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors">
            <Minimize2 size={14} />{dict.pip.close}
          </button>
        ) : (
          <button onClick={openPip}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors">
            <PictureInPicture size={14} />{dict.pip.open}
          </button>
        )}
      </div>

      {/* ── Fallback floating overlay (PC only, draggable + resizable) ── */}
      {!isMobile && pipFallback && pipPos && pipSize && (() => {
        const NATIVE_W = 288;
        const pipScale = pipSize.w / NATIVE_W;
        return (
        <div style={{
          position: "fixed",
          left: pipPos.x,
          top: pipPos.y,
          width: pipSize.w,
          height: pipSize.h,
          zIndex: 50,
          background: "#0c0f1a",
          borderRadius: 16,
          boxShadow: "0 25px 50px -12px rgba(0,0,0,0.6)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* ドラッグハンドル (ヘッダー) */}
          <div
            style={{ cursor: "grab", userSelect: "none", flexShrink: 0, touchAction: "none" }}
            className="flex items-center justify-between border-b border-white/10 px-4 py-2"
            onMouseDown={(e) => {
              e.preventDefault();
              overlayDragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pipPos.x, startPosY: pipPos.y };
            }}
            onTouchStart={(e) => {
              const t = e.touches[0];
              overlayDragRef.current = { startX: t.clientX, startY: t.clientY, startPosX: pipPos.x, startPosY: pipPos.y };
            }}
          >
            <span className="text-xs font-medium text-slate-400 select-none">
              ☰ {dict.pip.miniMode}
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); closePip(); }}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              className="text-lg leading-none text-slate-400 transition-colors hover:text-white"
            >×</button>
          </div>

          {/* スケールされたコンテンツ */}
          <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
            <div style={{
              width: NATIVE_W,
              transformOrigin: "top left",
              transform: `scale(${pipScale})`,
              position: "absolute",
              top: 0,
              left: 0,
            }}>
              <PipView
                time={currentDisplay} count={count} goal={goal}
                tabLabel={currentTabLabel} tab={tab} isRunning={isRunning}
                pct={currentPct} ringColor={currentRingColor}
                probDrops={probDrops} probAttempts={probAttempts} observedPct={observedRate}
                calcN={calcN} calcP={calcP} pAtLeastOne={pAtLeastOne}
                pipShowTimer={pipShowTimer} pipShowStopwatch={pipShowStopwatch}
                pipShowCounter={pipShowCounter} pipShowProbability={pipShowProbability}
                compact={true}
                dict={dict}
                onPlayPause={() => pipHandlersRef.current.playPause()}
                onCounterInc={() => pipHandlersRef.current.counterInc()}
                onProbDropInc={() => pipHandlersRef.current.probDropInc()}
                onProbAttemptInc={() => pipHandlersRef.current.probAttemptInc()}
                onTabChange={(t) => pipHandlersRef.current.tabChange(t)}
                onTimerReset={() => pipHandlersRef.current.timerReset()}
                onSwReset={() => pipHandlersRef.current.swReset()}
                onCounterReset={() => pipHandlersRef.current.counterReset()}
                onProbReset={() => pipHandlersRef.current.probReset()}
                onTimerAddTime={(s) => pipHandlersRef.current.timerAddTime(s)}
                counterPipSource={counterPipSource}
                onCounterPipSourceChange={(s) => pipHandlersRef.current.counterPipSourceChange(s)}
              />
            </div>
          </div>

          {/* リサイズハンドル (右下コーナー) */}
          <div
            style={{
              position: "absolute", bottom: 0, right: 0,
              width: 28, height: 28,
              cursor: "nwse-resize",
              touchAction: "none",
              display: "flex", alignItems: "flex-end", justifyContent: "flex-end",
              padding: "5px 5px",
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              overlayResizeRef.current = { startX: e.clientX, startY: e.clientY, startW: pipSize.w, startH: pipSize.h };
            }}
            onTouchStart={(e) => {
              e.stopPropagation();
              const t = e.touches[0];
              overlayResizeRef.current = { startX: t.clientX, startY: t.clientY, startW: pipSize.w, startH: pipSize.h };
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M11 1L1 11M11 6L6 11M11 11" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
        );
      })()}

      {/* Hidden canvas and video for mobile Canvas Video PiP */}
      <canvas ref={canvasRef} style={{ display: "none" }} aria-hidden />
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video ref={videoRef} style={{ display: "none" }} playsInline aria-hidden />
    </div>
  );
}
