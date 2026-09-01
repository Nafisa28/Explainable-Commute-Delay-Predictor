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
      autoResize: true,
    });
    lenisRef.current = lenis;

    const introMightPlay =
      window.location.pathname === "/" &&
      sessionStorage.getItem("introPlayed") !== "1" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (introMightPlay) {
      lenis.stop();
    }

    let running = true;
    function raf(time: number) {
      if (!running) return;
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);

    const resize = () => {
      lenis.resize();
    };

    // Recalculate scroll height after dynamic content (API-populated pages) grows.
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(document.body);

    window.addEventListener("resize", resize);
    window.addEventListener("load", resize);

    const onIntroStart = () => {
      lenis.stop();
    };
    const onIntroEnd = () => {
      lenis.start();
      resize();
    };
    window.addEventListener("commute-intro-start", onIntroStart);
    window.addEventListener("commute-intro-end", onIntroEnd);

    return () => {
      running = false;
      resizeObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("load", resize);
      window.removeEventListener("commute-intro-start", onIntroStart);
      window.removeEventListener("commute-intro-end", onIntroEnd);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
