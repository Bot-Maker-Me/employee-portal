"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media query hook. Returns `false` until mounted so the server and
 * the first client render agree (no hydration mismatch).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** True when the visitor asked the OS for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** True on wide screens with a real pointer — where tilt / cursor FX are worth it. */
export function useFinePointer(): boolean {
  return useMediaQuery("(min-width: 1024px) and (pointer: fine)");
}
