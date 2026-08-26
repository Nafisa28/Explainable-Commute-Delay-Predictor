"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * CustomCursor — Decorative circular cursor that follows the mouse with minimal spring lag.
 *
 * Key design decisions:
 * - The native OS cursor remains visible (at default size) so click accuracy is never affected.
 *   The custom cursor is purely decorative overlay with pointer-events: none.
 * - Spring physics are tuned for very tight tracking (high stiffness, moderate damping, low mass)
 *   so the trailing effect is subtle, not sluggish.
 * - A persistent toggle (stored in localStorage) lets anyone disable it instantly via a small
 *   floating button in the bottom-right corner, or via the keyboard shortcut Ctrl+Shift+C.
 * - Disabled entirely on touch devices and if prefers-reduced-motion is active.
 */

const STORAGE_KEY = "custom-cursor-enabled";

export default function CustomCursor() {
  const [hovered, setHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [isTouch, setIsTouch] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  // Tight spring: high stiffness + moderate damping + very low mass = near-instant tracking
  // with only the faintest trailing softness
  const springConfig = { damping: 40, stiffness: 800, mass: 0.15 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  // Read persisted preference on mount
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPrefersReduced(reduced);
    if (reduced) return;

    const touch = window.matchMedia("(pointer: coarse)").matches;
    setIsTouch(touch);
    if (touch) return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) {
        setEnabled(stored === "true");
      }
    } catch {
      // localStorage unavailable — keep default (enabled)
    }

    setIsVisible(true);
  }, []);

  // Toggle handler — persists choice to localStorage
  const toggleCursor = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // silently ignore
      }
      return next;
    });
  }, []);

  // Keyboard shortcut: Ctrl+Shift+C
  useEffect(() => {
    if (prefersReduced || isTouch) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "C") {
        e.preventDefault();
        toggleCursor();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prefersReduced, isTouch, toggleCursor]);

  // Mouse tracking
  useEffect(() => {
    if (prefersReduced || isTouch || !enabled) return;

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const isClickable =
        target.closest("a") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("textarea") ||
        target.closest(".card") ||
        target.closest(".btn") ||
        target.closest("[role='button']") ||
        target.closest(".clickable-element");

      setHovered(!!isClickable);
    };

    window.addEventListener("mousemove", moveCursor);
    window.addEventListener("mouseover", handleMouseOver);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, [cursorX, cursorY, prefersReduced, isTouch, enabled]);

  // Don't render cursor or toggle on touch/reduced-motion
  if (prefersReduced || isTouch) return null;

  return (
    <>
      {/* Decorative cursor dot — pointer-events: none ensures it never intercepts clicks */}
      {isVisible && enabled && (
        <motion.div
          className="fixed top-0 left-0 rounded-full pointer-events-none"
          style={{
            width: 24,
            height: 24,
            backgroundColor: "var(--color-accent-route)",
            zIndex: 99999,
            mixBlendMode: "difference",
            x: cursorXSpring,
            y: cursorYSpring,
            translateX: "-50%",
            translateY: "-50%",
          }}
          animate={{
            width: hovered ? 48 : 24,
            height: hovered ? 48 : 24,
            opacity: hovered ? 0.35 : 1,
          }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}

      {/* Toggle button — bottom-right corner */}
      {isVisible && (
        <button
          type="button"
          onClick={toggleCursor}
          title={`${enabled ? "Disable" : "Enable"} custom cursor (Ctrl+Shift+C)`}
          aria-label={`${enabled ? "Disable" : "Enable"} custom cursor`}
          className="fixed bottom-4 right-4 z-[99999] flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-medium transition-all duration-200 select-none"
          style={{
            background: enabled
              ? "var(--color-accent-route-dim)"
              : "var(--color-bg-surface)",
            borderColor: enabled
              ? "var(--color-accent-route)"
              : "var(--color-border)",
            color: enabled
              ? "var(--color-accent-route)"
              : "var(--color-text-muted)",
          }}
        >
          <span
            className="inline-block w-2 h-2 rounded-full transition-colors"
            style={{
              background: enabled
                ? "var(--color-accent-route)"
                : "var(--color-text-muted)",
            }}
          />
          {enabled ? "Cursor On" : "Cursor Off"}
        </button>
      )}
    </>
  );
}
