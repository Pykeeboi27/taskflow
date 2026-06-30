"use client";

import { useCallback, useState } from "react";

export function useTheme() {
  const [isDark, setIsDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  const toggle = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("tf-theme", next ? "dark" : "light");
      return next;
    });
  }, []);

  return { isDark, toggle };
}
