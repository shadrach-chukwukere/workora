"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

type Theme = "light";

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: "light";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

/**
 * Theme provider locked to light mode.
 * Dark mode is intentionally removed. No DOM classList manipulation for
 * dark/light toggling, no localStorage reads for theme preference — this keeps
 * the page eligible for back/forward cache restoration.
 */
export function ThemeProvider({
  children,
}: { children: ReactNode; defaultTheme?: Theme }) {
  return (
    <ThemeContext.Provider
      value={{
        theme: "light",
        resolvedTheme: "light",
        setTheme: () => {},
        toggleTheme: () => {},
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
