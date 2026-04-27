"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);

function getSystemTheme() {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ? "dark" : "light";
}

function applyTheme(theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export function ThemeProvider({ children, defaultTheme = "dark" }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") return defaultTheme;
    const stored = window.localStorage.getItem("acm_theme");
    return stored === "light" || stored === "dark" ? stored : getSystemTheme();
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem("acm_theme", theme);
  }, [theme]);

  const value = useMemo(() => {
    const set = (next) => setTheme(next);
    const toggle = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    return { theme, setTheme: set, toggle };
  }, [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

