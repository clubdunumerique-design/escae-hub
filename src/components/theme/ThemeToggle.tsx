"use client";

import { useTheme } from "./ThemeProvider";
import { useEffect, useState } from "react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className={`h-9 w-9 rounded-lg border border-white/10 bg-white/5 ${className}`} />
    );
  }

  const isLight = theme === "light";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? "Passer en mode sombre" : "Passer en mode clair (Thème clair)"}
      aria-label={isLight ? "Passer en mode sombre" : "Passer en mode clair"}
      className={`group relative flex h-9 w-9 items-center justify-center rounded-lg border transition-all duration-200 ${
        isLight
          ? "border-emerald-600/30 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 shadow-sm"
          : "border-white/10 bg-white/5 text-amber-400 hover:bg-white/10 hover:border-amber-400/40"
      } ${className}`}
    >
      {isLight ? (
        /* Icône Lune pour repasser en mode sombre */
        <svg
          className="h-4.5 w-4.5 transition-transform duration-300 group-hover:-rotate-12 text-[#03A61C]"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      ) : (
        /* Icône Soleil pour passer en mode clair */
        <svg
          className="h-4.5 w-4.5 transition-transform duration-300 group-hover:rotate-45 text-amber-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      )}
    </button>
  );
}
