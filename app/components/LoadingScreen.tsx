"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const STATUS = [
  "Initialising systems...",
  "Loading products...",
  "Fetching updates...",
  "Almost ready...",
];

export default function LoadingScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    const duration = 1600;
    const start = Date.now();

    const rafId = { current: 0 };
    const tick = () => {
      const p = Math.min(100, Math.round(((Date.now() - start) / duration) * 100));
      setProgress(p);
      if (p < 100) rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);

    const statusTimer = setInterval(
      () => setStatusIdx((i) => (i + 1) % STATUS.length),
      420
    );

    const hideTimer = setTimeout(() => {
      clearInterval(statusTimer);
      setIsAnimatingOut(true);
      setTimeout(() => setIsVisible(false), 500);
    }, 1800);

    return () => {
      cancelAnimationFrame(rafId.current);
      clearInterval(statusTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!isVisible) return null;

  const circumference = 2 * Math.PI * 58;
  const dashOffset = circumference * (1 - progress / 100);

  return (
    <div
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-zinc-50 transition-opacity duration-500 ${
        isAnimatingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Dot grid texture */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, #d4d4d8 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          opacity: 0.55,
        }}
      />

      {/* Soft top glow */}
      <div className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-[480px] h-[220px] rounded-full bg-emerald-400/12 blur-[90px]" />

      {/* Card */}
      <div className="relative z-10 flex flex-col items-center gap-7 px-8 py-10 text-center">

        {/* Circular progress ring + logo */}
        <div className="relative flex items-center justify-center w-[140px] h-[140px]">
          <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 140 140">
            {/* Track */}
            <circle cx="70" cy="70" r="58" fill="none" stroke="#e4e4e7" strokeWidth="2.5" />
            {/* Progress */}
            <circle
              cx="70" cy="70" r="58"
              fill="none"
              stroke="url(#emerald-grad)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 0.06s linear" }}
            />
            <defs>
              <linearGradient id="emerald-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#22d3ee" />
              </linearGradient>
            </defs>
          </svg>

          {/* Logo */}
          <div className="relative z-10 w-[76px] h-[76px] flex items-center justify-center rounded-[22px] bg-zinc-900 shadow-lg overflow-hidden">
            <Image
              src="/logo.png"
              alt="Tech Ninja"
              width={80}
              height={80}
              unoptimized
              className="object-contain scale-90"
              priority
            />
          </div>
        </div>

        {/* Brand */}
        <div className="space-y-1">
          <h1 className="text-[28px] font-bold text-zinc-900 tracking-tight">Tech Ninja</h1>
          <p className="text-sm text-zinc-500 font-light">Welcome back to your tech command centre</p>
        </div>

        {/* Status row */}
        <div className="flex items-center justify-between gap-6 w-full max-w-[220px]">
          <span className="text-[11px] font-mono text-zinc-400 text-left truncate">
            {STATUS[statusIdx]}
          </span>
          <span className="text-[11px] font-mono font-semibold text-emerald-500 tabular-nums flex-shrink-0">
            {progress}%
          </span>
        </div>

        {/* Thin progress bar */}
        <div className="w-full max-w-[220px] h-[2px] rounded-full bg-zinc-200 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
            style={{ width: `${progress}%`, transition: "width 0.06s linear" }}
          />
        </div>

        {/* Tagline */}
        <p className="text-[10px] tracking-[0.28em] uppercase text-zinc-400 font-medium">
          Repair · Buy · Sell
        </p>
      </div>

      {/* Bottom edge progress strip */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-100">
        <div
          className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
          style={{ width: `${progress}%`, transition: "width 0.06s linear" }}
        />
      </div>
    </div>
  );
}
