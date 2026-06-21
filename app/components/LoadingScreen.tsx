"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const STEPS = ["Connecting...", "Loading data...", "Ready!"];

export default function LoadingScreen() {
  const [visible, setVisible] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    // Trigger entrance animation after first paint
    const m = requestAnimationFrame(() => setMounted(true));

    const DURATION = 900;
    const start = Date.now();
    let raf = 0;

    const tick = () => {
      const p = Math.min(100, Math.round(((Date.now() - start) / DURATION) * 100));
      setProgress(p);
      if (p < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const stepTimer = setInterval(
      () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1)),
      300
    );

    const exitTimer = setTimeout(() => {
      clearInterval(stepTimer);
      setFadeOut(true);
      setTimeout(() => setVisible(false), 400);
    }, 980);

    return () => {
      cancelAnimationFrame(m);
      cancelAnimationFrame(raf);
      clearInterval(stepTimer);
      clearTimeout(exitTimer);
    };
  }, []);

  if (!visible) return null;

  const R = 54;
  const circ = 2 * Math.PI * R;
  const dash = circ * (1 - progress / 100);

  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center transition-all duration-400 ${
        fadeOut ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"
      }`}
      style={{ background: "linear-gradient(135deg, #f8fafc 0%, #f0fdf4 50%, #ecfeff 100%)" }}
    >
      {/* Dot grid */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          opacity: 0.4,
        }}
      />

      {/* Ambient glow blobs */}
      <div className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[300px] rounded-full blur-[120px]"
        style={{ background: "radial-gradient(ellipse, rgba(52,211,153,0.18) 0%, rgba(34,211,238,0.10) 60%, transparent 100%)" }} />

      {/* Main card */}
      <div
        className={`relative z-10 flex flex-col items-center gap-6 px-10 py-12 text-center transition-all duration-500 ${
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {/* Ring + logo */}
        <div className="relative flex items-center justify-center w-[132px] h-[132px]">
          {/* Outer glow ring */}
          <div
            className="absolute inset-0 rounded-full opacity-30 blur-md"
            style={{ background: `conic-gradient(from 0deg, #34d399 0%, #22d3ee ${progress}%, transparent ${progress}%)` }}
          />

          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 132 132">
            <defs>
              <linearGradient id="ld-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
            {/* Track */}
            <circle cx="66" cy="66" r={R} fill="none" stroke="#e2e8f0" strokeWidth="3" />
            {/* Progress arc */}
            <circle
              cx="66" cy="66" r={R}
              fill="none"
              stroke="url(#ld-grad)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={circ}
              strokeDashoffset={dash}
              style={{ transition: "stroke-dashoffset 0.05s linear" }}
            />
          </svg>

          {/* Logo box */}
          <div className="relative z-10 w-[72px] h-[72px] flex items-center justify-center rounded-[20px] bg-zinc-900 shadow-xl overflow-hidden ring-1 ring-white/10">
            <Image src="/logo.png" alt="TechNinja" width={76} height={76} unoptimized className="object-contain scale-90" priority />
          </div>
        </div>

        {/* Brand text */}
        <div
          className={`space-y-1.5 transition-all duration-500 delay-100 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          <h1 className="text-2xl font-bold text-zinc-900 tracking-tight">Tech Ninja</h1>
          <p className="text-sm text-zinc-500">Welcome back to your command centre</p>
        </div>

        {/* Progress bar + status */}
        <div
          className={`w-full max-w-[200px] transition-all duration-500 delay-200 ${
            mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Bar */}
          <div className="w-full h-1 rounded-full bg-zinc-200 overflow-hidden mb-2.5">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: "linear-gradient(90deg, #34d399, #22d3ee)",
                transition: "width 0.05s linear",
              }}
            />
          </div>

          {/* Status row */}
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono text-zinc-400">{STEPS[stepIdx]}</span>
            <span className="text-[11px] font-mono font-bold text-emerald-500 tabular-nums">{progress}%</span>
          </div>
        </div>

        {/* Tagline */}
        <p
          className={`text-[10px] tracking-[0.3em] uppercase text-zinc-400 font-medium transition-all duration-500 delay-300 ${
            mounted ? "opacity-100" : "opacity-0"
          }`}
        >
          Repair · Buy · Sell
        </p>
      </div>

      {/* Bottom edge strip */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-100">
        <div
          className="h-full"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #34d399, #22d3ee)",
            transition: "width 0.05s linear",
          }}
        />
      </div>
    </div>
  );
}
