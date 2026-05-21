"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const checkStandalone = () => {
      const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
      if (isStandalone) {
        setVisible(false);
        setDeferredPrompt(null);
      }
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);
    checkStandalone();

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    setDeferredPrompt(null);
  };

  return (
    <div className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 sm:left-auto sm:right-6 sm:translate-x-0 sm:max-w-xs">
      <div className="relative overflow-hidden rounded-xl border border-emerald-500/20 bg-black/60 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
        {/* emerald left accent bar */}
        <div className="absolute inset-y-0 left-0 w-[3px] bg-gradient-to-b from-emerald-400 to-emerald-600" />

        <div className="flex items-center gap-3 px-4 py-3 pl-5">
          {/* icon */}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400 text-lg border border-emerald-500/25">
            ⚡
          </div>

          {/* text */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white leading-tight">Install Tech Ninja</p>
            <p className="text-[11px] text-slate-400 leading-snug mt-0.5 truncate">
              Add to home screen for faster access.
            </p>
          </div>

          {/* action */}
          <button
            onClick={handleInstallClick}
            className="flex-shrink-0 rounded-md bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-[12px] font-semibold text-emerald-300 transition hover:bg-emerald-500/35 hover:text-emerald-200 active:scale-95"
          >
            Install
          </button>

          {/* dismiss */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-slate-600 hover:text-slate-300 transition-colors ml-1"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
