"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

/**
 * SmoothScroll — Sitewide Lenis wrapper.
 *
 * Provides a fluid, slightly eased scroll experience.
 * Completely disables itself when prefers-reduced-motion is active,
 * falling back to native instant scroll.
 */
export default function SmoothScroll({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    // Respect reduced-motion: skip smooth scrolling entirely
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 1.5,
    });
    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
