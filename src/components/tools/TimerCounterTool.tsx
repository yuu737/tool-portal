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
type Tab = "timer" | "stopwatch" | "counter";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function fmtSec(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function fmtMs(ms: number) {
  const t = Math.floor(ms / 1000);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const cs = Math.floor((ms % 1000) / 10);
  return h > 0
    ? `${pad(h)}:${pad(m)}:${pad(s)}.${pad(cs)}`
    : `${pad(m)}:${pad(s)}.${pad(cs)}`;
}

// ─── Circular Ring SVG ────────────────────────────────────────────────────────
function Ring({
  pct,
  color,
  size = 240,
  track = "#e2e8f0",
  sw = 10,
}: {
  pct: number;
  color: string;
  size?: number;
  track?: string;
  sw?: number;
}) {
  const r = size / 2 - sw - 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, pct) / 100));
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: "rotate(-90deg)", display: "block" }}
      aria-hidden
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={track}
        strokeWidth={sw}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={sw + 2}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s" }}
      />
    </svg>
  );
}

// ─── PiP View (inline styles + interactive buttons) ───────────────────────────
type PipProps = {
  time: string;
  count: number;
  goal: number;
  tabLabel: string;
  isRunning: boolean;
  pct: number;
  ringColor: string;
  onPlayPause: () => void;
  onCounterInc: () => void;
};

function PipView({
  time,
  count,
  goal,
  tabLabel,
  isRunning,
  pct,
  ringColor,
  onPlayPause,
  onCounterInc,
}: PipProps) {
  const r = 68;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(1, Math.max(0, pct) / 100));
  const cPct = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;

  return (
    <div
      style={{
        background: "#0c0f1a",
        color: "#f1f5f9",
        fontFamily: "ui-monospace,'Courier New',monospace",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "12px 16px 16px",
        boxSizing: "border-box",
        userSelect: "none",
      }}
    >
      {/* Ring + time */}
      <div style={{ position: "relative", width: 156, height: 156, flexShrink: 0 }}>
        <svg
          width={156}
          height={156}
          style={{ transform: "rotate(-90deg)", display: "block" }}
        >
          <circle cx={78} cy={78} r={r} fill="none" stroke="#1e2d45" strokeWidth={9} />
          <circle
            cx={78}
            cy={78}
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth={11}
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.4s ease" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <span
            style={{
              fontSize: 9,
              color: "#475569",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            {tabLabel}
          </span>
          <span
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1,
            }}
          >
            {time}
          </span>
        </div>
      </div>

      {/* Counter */}
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: goal > 0 && count >= goal ? "#22c55e" : "#cbd5e1",
        }}
      >
        {count.toLocaleString()}
        {goal > 0 && (
          <span style={{ fontSize: 11, color: "#475569", marginLeft: 4 }}>
            /{goal} ({cPct}%)
          </span>
        )}
      </div>

      {/* Goal bar */}
      {goal > 0 && (
        <div
          style={{
            width: "80%",
            height: 4,
            background: "#1e2d45",
            borderRadius: 999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${cPct}%`,
              height: "100%",
              background: cPct >= 100 ? "#22c55e" : "#3b82f6",
              borderRadius: 999,
              transition: "width 0.3s",
            }}
          />
        </div>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={onPlayPause}
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: isRunning ? "#d97706" : "#2563eb",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {isRunning ? "⏸" : "▶"}
        </button>
        <button
          onClick={onCounterInc}
          style={{
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "#1e3a5f",
            border: "2px solid #2563eb",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            fontWeight: 800,
            color: "#93c5fd",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          +1
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
  const [editMode, setEditMode] = useState(true); // show inputs vs ring
  const timerEndRef = useRef(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Stopwatch ──────────────────────────────────────────────────────────────
  const [swRunning, setSwRunning] = useState(false);
  const [swElapsed, setSwElapsed] = useState(0);
  const [swLaps, setSwLaps] = useState<number[]>([]);
  const swStartPerfRef = useRef(0);
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

  // ── PiP ────────────────────────────────────────────────────────────────────
  const [pipSupported, setPipSupported] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [pipFallback, setPipFallback] = useState(false);
  const pipWinRef = useRef<Window | null>(null);
  const pipRootRef = useRef<ReturnType<typeof createRoot> | null>(null);

  // Ref so PiP handlers always call latest logic without stale closures
  const pipHandlersRef = useRef({ playPause: () => {}, counterInc: () => {} });

  // ─── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setPipSupported("documentPictureInPicture" in window);
    setGoalInput(goal > 0 ? goal.toString() : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Persist counter ────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem("yuu-tc-count", count.toString());
  }, [count]);
  useEffect(() => {
    localStorage.setItem("yuu-tc-goal", goal.toString());
  }, [goal]);

  // ─── Timer interval ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!timerRunning) {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      return;
    }
    if (timerRemaining === null || timerRemaining <= 0) return;
    timerEndRef.current = Date.now() + timerRemaining * 1000;
    timerIntervalRef.current = setInterval(() => {
      const rem = Math.ceil((timerEndRef.current - Date.now()) / 1000);
      if (rem <= 0) {
        clearInterval(timerIntervalRef.current!);
        setTimerRemaining(0);
        setTimerRunning(false);
        setTimerDone(true);
      } else {
        setTimerRemaining(rem);
      }
    }, 200);
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerRunning]);

  // ─── Stopwatch RAF ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!swRunning) {
      if (swRafRef.current) cancelAnimationFrame(swRafRef.current);
      return;
    }
    swStartPerfRef.current = performance.now();
    const loop = () => {
      setSwElapsed(swOffsetRef.current + performance.now() - swStartPerfRef.current);
      swRafRef.current = requestAnimationFrame(loop);
    };
    swRafRef.current = requestAnimationFrame(loop);
    return () => {
      if (swRafRef.current) cancelAnimationFrame(swRafRef.current);
    };
  }, [swRunning]);

  // ─── Derived values ──────────────────────────────────────────────────────────
  const timerTotalSec = timerH * 3600 + timerM * 60 + timerS;
  const effectiveTotal = timerTotal > 0 ? timerTotal : timerTotalSec;
  const timerPct =
    timerRemaining !== null && effectiveTotal > 0
      ? Math.max(0, Math.min(100, (timerRemaining / effectiveTotal) * 100))
      : timerDone
      ? 0
      : 100;

  const timerRingColor =
    timerDone
      ? "#22c55e"
      : timerPct < 20
      ? "#ef4444"
      : timerPct < 50
      ? "#f59e0b"
      : "#6366f1";

  // Stopwatch ring sweeps every 60 s like a clock
  const swSec = (swElapsed / 1000) % 60;
  const swPct = (swSec / 60) * 100;

  const counterPct = goal > 0 ? Math.min(100, Math.round((count / goal) * 100)) : 0;
  const counterRingColor =
    counterPct >= 100 ? "#22c55e" : counterPct > 70 ? "#f59e0b" : "#6366f1";

  const currentDisplay =
    tab === "stopwatch"
      ? fmtMs(swElapsed)
      : timerRemaining !== null
      ? fmtSec(timerRemaining)
      : fmtSec(timerTotalSec);

  const currentPct =
    tab === "stopwatch" ? swPct : tab === "counter" ? counterPct : timerPct;
  const currentRingColor =
    tab === "stopwatch"
      ? "#6366f1"
      : tab === "counter"
      ? counterRingColor
      : timerRingColor;
  const currentTabLabel =
    tab === "timer"
      ? dict.tabs.timer
      : tab === "stopwatch"
      ? dict.tabs.stopwatch
      : dict.tabs.counter;
  const isRunning =
    tab === "timer" ? timerRunning : tab === "stopwatch" ? swRunning : false;

  // ─── Timer handlers ───────────────────────────────────────────────────────────
  const timerStart = useCallback(() => {
    const total = timerH * 3600 + timerM * 60 + timerS;
    if (total <= 0 && timerRemaining === null) return;
    if (timerRemaining === null) {
      setTimerTotal(total);
      setTimerRemaining(total);
      setTimerDone(false);
    }
    setEditMode(false);
    setTimerRunning(true);
  }, [timerH, timerM, timerS, timerRemaining]);

  const timerPause = useCallback(() => {
    setTimerRunning(false);
  }, []);

  const timerReset = useCallback(() => {
    setTimerRunning(false);
    setTimerRemaining(null);
    setTimerDone(false);
    setTimerTotal(0);
    setEditMode(true);
  }, []);

  const timerResume = useCallback(() => {
    setTimerRunning(true);
  }, []);

  // ─── Stopwatch handlers ───────────────────────────────────────────────────────
  const swStart = useCallback(() => setSwRunning(true), []);
  const swPause = useCallback(() => {
    setSwRunning(false);
    swOffsetRef.current += performance.now() - swStartPerfRef.current;
  }, []);
  const swReset = useCallback(() => {
    setSwRunning(false);
    setSwElapsed(0);
    setSwLaps([]);
    swOffsetRef.current = 0;
  }, []);
  const swLap = useCallback(() => {
    setSwLaps((prev) => [swElapsed, ...prev]);
  }, [swElapsed]);

  // ─── Counter handlers ─────────────────────────────────────────────────────────
  const triggerCountAnim = (dir: "up" | "down") => {
    setCountAnim(dir);
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    setTimeout(() => setCountAnim(null), 260);
  };
  const inc = useCallback((n: number) => {
    setCount((c) => c + n);
    triggerCountAnim("up");
  }, []);
  const dec = useCallback((n: number) => {
    setCount((c) => Math.max(0, c - n));
    triggerCountAnim("down");
  }, []);
  const resetCounter = useCallback(() => setCount(0), []);
  const applyGoal = useCallback(() => {
    const n = parseInt(goalInput, 10);
    setGoal(!isNaN(n) && n > 0 ? n : 0);
  }, [goalInput]);

  // ─── Update PiP handlers ref (runs every render, safe) ───────────────────────
  pipHandlersRef.current = {
    playPause: () => {
      if (tab === "timer") {
        timerRunning ? timerPause() : timerRemaining !== null ? timerResume() : timerStart();
      } else if (tab === "stopwatch") {
        swRunning ? swPause() : swStart();
      }
    },
    counterInc: () => inc(1),
  };

  // ─── PiP render helper ────────────────────────────────────────────────────────
  const renderPip = useCallback(() => {
    if (!pipRootRef.current) return;
    pipRootRef.current.render(
      <PipView
        time={currentDisplay}
        count={count}
        goal={goal}
        tabLabel={currentTabLabel}
        isRunning={isRunning}
        pct={currentPct}
        ringColor={currentRingColor}
        onPlayPause={() => pipHandlersRef.current.playPause()}
        onCounterInc={() => pipHandlersRef.current.counterInc()}
      />
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDisplay, count, goal, currentTabLabel, isRunning, currentPct, currentRingColor]);

  useEffect(() => {
    if (pipOpen || pipFallback) renderPip();
  }, [pipOpen, pipFallback, renderPip]);

  // ─── PiP open ─────────────────────────────────────────────────────────────────
  const openPip = useCallback(async () => {
    if (!("documentPictureInPicture" in window)) {
      // Fallback: create a floating overlay root in a detached div
      const container = document.createElement("div");
      pipRootRef.current = createRoot(container);
      setPipFallback(true);
      return;
    }
    try {
      const pipWin = await window.documentPictureInPicture!.requestWindow({
        width: 280,
        height: 360,
      });
      pipWinRef.current = pipWin;
      for (const sheet of document.styleSheets) {
        try {
          const rules = [...sheet.cssRules].map((r) => r.cssText).join("");
          const s = pipWin.document.createElement("style");
          s.textContent = rules;
          pipWin.document.head.appendChild(s);
        } catch {
          if (sheet.href) {
            const l = pipWin.document.createElement("link");
            l.rel = "stylesheet";
            l.href = sheet.href;
            pipWin.document.head.appendChild(l);
          }
        }
      }
      const wrap = pipWin.document.createElement("div");
      pipWin.document.body.style.margin = "0";
      pipWin.document.body.appendChild(wrap);
      pipRootRef.current = createRoot(wrap);
      pipWin.addEventListener("pagehide", () => {
        pipWinRef.current = null;
        pipRootRef.current = null;
        setPipOpen(false);
      });
      setPipOpen(true);
    } catch {
      const container = document.createElement("div");
      pipRootRef.current = createRoot(container);
      setPipFallback(true);
    }
  }, []);

  const closePip = useCallback(() => {
    try {
      pipWinRef.current?.close();
    } catch {
      /* noop */
    }
    pipWinRef.current = null;
    pipRootRef.current = null;
    setPipOpen(false);
    setPipFallback(false);
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 rounded-2xl border border-gray-200 bg-gray-50 p-1">
        {(["timer", "stopwatch", "counter"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-medium transition-all ${
              tab === t
                ? "bg-white shadow text-indigo-600 border border-gray-200"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "timer" && <Timer size={14} strokeWidth={2} />}
            {t === "stopwatch" && <Clock size={14} strokeWidth={2} />}
            {t === "counter" && <Hash size={14} strokeWidth={2} />}
            {t === "timer" ? dict.tabs.timer : t === "stopwatch" ? dict.tabs.stopwatch : dict.tabs.counter}
          </button>
        ))}
      </div>

      {/* ══════════ TIMER ══════════ */}
      {tab === "timer" && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-col items-center gap-6 p-6">
            {editMode ? (
              /* ── Set time mode ── */
              <>
                <div className="flex items-end justify-center gap-2">
                  {(
                    [
                      { label: dict.timer.hours, val: timerH, set: setTimerH, max: 23 },
                      { label: dict.timer.minutes, val: timerM, set: setTimerM, max: 59 },
                      { label: dict.timer.seconds, val: timerS, set: setTimerS, max: 59 },
                    ] as const
                  ).map(({ label, val, set, max }, i) => (
                    <div key={label} className="flex items-end gap-2">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => (set as (v: number) => void)(Math.min(max, val + 1))}
                          className="flex h-8 w-20 items-center justify-center rounded-t-xl bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          ▲
                        </button>
                        <div className="w-20 rounded-none border-y border-gray-200 bg-gray-50 py-2 text-center text-3xl font-extrabold tabular-nums text-gray-900 leading-none">
                          {pad(val)}
                        </div>
                        <button
                          onClick={() => (set as (v: number) => void)(Math.max(0, val - 1))}
                          className="flex h-8 w-20 items-center justify-center rounded-b-xl bg-gray-100 text-gray-500 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                        >
                          ▼
                        </button>
                        <span className="mt-1 text-xs text-gray-400">{label}</span>
                      </div>
                      {i < 2 && (
                        <span className="mb-10 text-2xl font-bold text-gray-300">:</span>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={timerStart}
                  disabled={timerTotalSec === 0}
                  className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-4 text-base font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-40 active:scale-95"
                >
                  <Play size={18} fill="white" />
                  {dict.timer.start}
                </button>
              </>
            ) : (
              /* ── Running / Paused mode ── */
              <>
                {/* Ring */}
                <div className="relative">
                  <Ring
                    pct={timerPct}
                    color={timerRingColor}
                    size={240}
                    track="#f1f5f9"
                    sw={12}
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                    <span className="text-5xl font-extrabold tabular-nums tracking-tight text-gray-900">
                      {timerRemaining !== null ? fmtSec(timerRemaining) : fmtSec(timerTotalSec)}
                    </span>
                    {timerDone && (
                      <span className="text-sm font-semibold text-green-600">
                        {dict.timer.complete}
                      </span>
                    )}
                    {!timerDone && (
                      <span className="text-xs text-gray-400">
                        {Math.round(timerPct)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                  {/* Reset */}
                  <button
                    onClick={timerReset}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 active:scale-95"
                  >
                    <RotateCcw size={20} />
                  </button>

                  {/* Play / Pause (big center) */}
                  {!timerDone && (
                    <button
                      onClick={timerRunning ? timerPause : timerResume}
                      className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-all active:scale-95 ${
                        timerRunning
                          ? "bg-amber-500 hover:bg-amber-600"
                          : "bg-indigo-600 hover:bg-indigo-700"
                      }`}
                    >
                      {timerRunning ? (
                        <Pause size={28} fill="white" />
                      ) : (
                        <Play size={28} fill="white" />
                      )}
                    </button>
                  )}

                  {/* Edit */}
                  <button
                    onClick={() => { timerReset(); setEditMode(true); }}
                    className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 active:scale-95"
                  >
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
            {/* Ring */}
            <div className="relative">
              <Ring pct={swPct} color="#6366f1" size={240} track="#f1f5f9" sw={12} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <span className="text-5xl font-extrabold tabular-nums tracking-tight text-gray-900">
                  {fmtMs(swElapsed)}
                </span>
                <span className="text-xs text-gray-400">
                  {swLaps.length > 0 && `${swLaps.length} laps`}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-4">
              <button
                onClick={swReset}
                disabled={swElapsed === 0 && !swRunning}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 disabled:opacity-40 active:scale-95"
              >
                <RotateCcw size={20} />
              </button>

              <button
                onClick={swRunning ? swPause : swStart}
                className={`flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-all active:scale-95 ${
                  swRunning ? "bg-amber-500 hover:bg-amber-600" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                {swRunning ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" />}
              </button>

              <button
                onClick={swLap}
                disabled={!swRunning}
                className="flex h-14 w-14 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 active:scale-95"
              >
                <Flag size={18} />
              </button>
            </div>

            {/* Lap list */}
            {swLaps.length > 0 && (
              <div className="w-full max-h-48 overflow-y-auto space-y-1.5">
                {swLaps.map((ms, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-2.5 text-sm"
                  >
                    <span className="text-gray-400">
                      {dict.stopwatch.lapLabel} {swLaps.length - i}
                    </span>
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
            {/* Ring + count */}
            <div className="relative">
              <Ring
                pct={goal > 0 ? counterPct : 0}
                color={counterRingColor}
                size={240}
                track={goal > 0 ? "#f1f5f9" : "#f8fafc"}
                sw={12}
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                <div
                  className="text-6xl font-extrabold tabular-nums tracking-tight"
                  style={{
                    transform:
                      countAnim === "up"
                        ? "translateY(-8px) scale(1.08)"
                        : countAnim === "down"
                        ? "translateY(6px) scale(0.94)"
                        : "none",
                    color: goal > 0 && count >= goal ? "#16a34a" : "#111827",
                    transition:
                      "transform 0.22s cubic-bezier(0.34,1.56,0.64,1), color 0.3s",
                  }}
                >
                  {count.toLocaleString()}
                </div>
                {goal > 0 && (
                  <span className="text-xs text-gray-400">
                    / {goal.toLocaleString()} &nbsp;{counterPct}%
                  </span>
                )}
                {goal > 0 && counterPct >= 100 && (
                  <span className="text-xs font-bold text-green-600">🎉 {dict.counter.goalReached}</span>
                )}
              </div>
            </div>

            {/* +/- buttons */}
            <div className="grid w-full grid-cols-5 gap-2">
              {/* −10 */}
              <button
                onClick={() => dec(10)}
                className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 py-3 text-sm font-bold text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95"
              >
                <span className="text-xs leading-none">−10</span>
              </button>
              {/* −1 */}
              <button
                onClick={() => dec(1)}
                className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 py-3 text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors active:scale-95"
              >
                <Minus size={20} strokeWidth={2.5} />
              </button>
              {/* +1 (big) */}
              <button
                onClick={() => inc(1)}
                className="col-span-1 flex flex-col items-center justify-center rounded-2xl bg-indigo-600 py-4 text-white shadow-md hover:bg-indigo-700 transition-colors active:scale-95"
              >
                <Plus size={24} strokeWidth={2.5} />
                <span className="mt-0.5 text-xs">+1</span>
              </button>
              {/* +5 */}
              <button
                onClick={() => inc(5)}
                className="flex flex-col items-center justify-center rounded-2xl bg-indigo-100 py-3 text-indigo-700 hover:bg-indigo-200 transition-colors active:scale-95"
              >
                <span className="text-sm font-bold">+5</span>
              </button>
              {/* +10 */}
              <button
                onClick={() => inc(10)}
                className="flex flex-col items-center justify-center rounded-2xl bg-indigo-50 py-3 text-indigo-600 hover:bg-indigo-100 transition-colors active:scale-95"
              >
                <span className="text-sm font-bold">+10</span>
              </button>
            </div>

            {/* Reset row */}
            <div className="flex w-full gap-2">
              <button
                onClick={resetCounter}
                disabled={count === 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm text-gray-500 hover:bg-gray-50 disabled:opacity-40 transition-colors active:scale-95"
              >
                <RotateCcw size={14} />
                {dict.counter.reset}
              </button>
            </div>

            {/* Goal input */}
            <div className="flex w-full gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
                <Target size={14} className="shrink-0 text-gray-400" />
                <input
                  type="number"
                  min={1}
                  placeholder={dict.counter.goalPlaceholder}
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && applyGoal()}
                  className="flex-1 bg-transparent py-2.5 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                />
              </div>
              <button
                onClick={applyGoal}
                className="rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-900 transition-colors active:scale-95"
              >
                {dict.counter.setGoal}
              </button>
            </div>
            <p className="text-xs text-gray-400 text-center">{dict.counter.storageNote}</p>
          </div>
        </div>
      )}

      {/* ── PiP Bar ── */}
      <div className="flex items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-indigo-800">{dict.pip.title}</p>
          <p className="truncate text-xs text-indigo-500">
            {pipSupported ? dict.pip.description : dict.pip.unsupported}
          </p>
        </div>
        {pipOpen || pipFallback ? (
          <button
            onClick={closePip}
            className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Minimize2 size={14} />
            {dict.pip.close}
          </button>
        ) : (
          <button
            onClick={openPip}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            <PictureInPicture size={14} />
            {dict.pip.open}
          </button>
        )}
      </div>

      {/* ── Fallback floating overlay ── */}
      {pipFallback && (
        <div
          className="fixed bottom-4 right-4 z-50 w-72 overflow-hidden rounded-2xl shadow-2xl"
          style={{ background: "#0c0f1a" }}
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
            <span className="text-xs font-medium text-slate-400">{dict.pip.miniMode}</span>
            <button
              onClick={closePip}
              className="text-lg leading-none text-slate-400 transition-colors hover:text-white"
            >
              ×
            </button>
          </div>
          <PipView
            time={currentDisplay}
            count={count}
            goal={goal}
            tabLabel={currentTabLabel}
            isRunning={isRunning}
            pct={currentPct}
            ringColor={currentRingColor}
            onPlayPause={() => pipHandlersRef.current.playPause()}
            onCounterInc={() => pipHandlersRef.current.counterInc()}
          />
        </div>
      )}
    </div>
  );
}
