"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useState } from "react";

interface ThemeCtx {
  dark: boolean;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useLayoutEffect(() => {
    const stored = localStorage.getItem("tn-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = stored ? stored === "dark" : prefersDark;
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("tn-theme", next ? "dark" : "light");
      return next;
    });
  };

  return <Ctx.Provider value={{ dark, toggle }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
