"use client";

import * as React from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderContextType = {
  theme: Theme;
  resolvedTheme: "dark" | "light";
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const defaultContext: ThemeProviderContextType = {
  theme: "system",
  resolvedTheme: "light",
  setTheme: () => {},
  toggleTheme: () => {},
};

const ThemeContext = React.createContext<ThemeProviderContextType>(defaultContext);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "theme",
}: {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}) {
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);
  const [resolvedTheme, setResolvedTheme] = React.useState<"dark" | "light">("light");

  React.useEffect(() => {
    queueMicrotask(() => {
      try {
        const savedTheme = localStorage.getItem(storageKey) as Theme | null;
        if (savedTheme && (savedTheme === "dark" || savedTheme === "light" || savedTheme === "system")) {
          setThemeState(savedTheme);
        }
      } catch {
        // Ignore localStorage read failures
      }
    });
  }, [storageKey]);

  React.useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const updateResolvedTheme = () => {
      let isDark = false;
      if (theme === "system") {
        isDark = mediaQuery.matches;
      } else {
        isDark = theme === "dark";
      }

      setResolvedTheme(isDark ? "dark" : "light");

      if (isDark) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };

    updateResolvedTheme();

    const listener = () => {
      if (theme === "system") {
        updateResolvedTheme();
      }
    };

    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, [theme]);

  const setTheme = React.useCallback(
    (newTheme: Theme) => {
      try {
        localStorage.setItem(storageKey, newTheme);
      } catch {
        // Ignore localStorage write failures
      }
      setThemeState(newTheme);
    },
    [storageKey]
  );

  const toggleTheme = React.useCallback(() => {
    const isCurrentlyDark = typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : resolvedTheme === "dark";
    const nextTheme = isCurrentlyDark ? "light" : "dark";
    setTheme(nextTheme);
  }, [resolvedTheme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = React.useContext(ThemeContext);
  return context ?? defaultContext;
}
