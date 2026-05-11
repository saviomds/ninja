"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export default function LoadingScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    // Show loading screen for minimum 1.5 seconds
    const timer = setTimeout(() => {
      setIsAnimatingOut(true);
      // Wait for fade-out animation to complete
      setTimeout(() => setIsVisible(false), 500);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[999] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center transition-opacity duration-500 ${
        isAnimatingOut ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
    >
      {/* Background animation elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl animate-pulse" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-8">
        {/* Logo with glow effect */}
        <div className="relative flex items-center justify-center">
          <div className="absolute inset-0 bg-indigo-600/50 blur-2xl rounded-full animate-pulse" />
          <div className="relative">
            <Image
              src="/logo.png"
              alt="Tech Ninja"
              width={120}
              height={120}
              unoptimized
              className="object-contain"
              priority
            />
          </div>
        </div>

        {/* Welcome text in Ubuntu style */}
        <div className="text-center space-y-3 max-w-sm">
          <h1 className="text-5xl font-bold text-white tracking-tight" style={{ fontFamily: "'Ubuntu', sans-serif" }}>
            Tech Ninja
          </h1>
          <p className="text-lg text-gray-300 font-light" style={{ fontFamily: "'Ubuntu', sans-serif" }}>
            Welcome back to your tech command centre
          </p>

          {/* Loading indicator */}
          <div className="pt-4 flex items-center justify-center gap-2">
            <div className="flex gap-1">
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
              <div className="w-2 h-2 bg-violet-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
              <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }} />
            </div>
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="text-xs text-gray-500 mt-8" style={{ fontFamily: "'Ubuntu', sans-serif" }}>
          Repair • Buy • Sell
        </p>
      </div>
    </div>
  );
}
