"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

const STORAGE_KEY = "introPlayed";

const LINES = [
  "INITIALIZING TRAFFIC SCAN...",
  "CONNECTING TO LIVE TRAFFIC DATA...",
  "8 CORRIDORS ONLINE",
  "SYSTEM READY",
];

const ROUTE_PATH =
  "M 80 280 C 200 280, 280 160, 400 140 C 520 120, 620 260, 760 220 C 900 180, 1000 80, 1120 90";

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export default function IntroSequence() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [typed, setTyped] = useState(["", "", "", ""]);
  const [pulse, setPulse] = useState(false);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // sessionStorage unavailable
    }
    setActive(false);
    document.documentElement.style.overflow = "";
    document.body.style.overflow = "";
    window.dispatchEvent(new Event("commute-intro-end"));
  }, []);

  useLayoutEffect(() => {
    if (pathname !== "/") return;

    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      // continue and attempt to play
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // ignore
      }
      return;
    }

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    window.dispatchEvent(new Event("commute-intro-start"));
    setActive(true);
  }, [pathname]);

  useEffect(() => {
    if (!active) return;

    const skipTimer = window.setTimeout(() => setShowSkip(true), 1000);
    const doneTimer = window.setTimeout(() => dismiss(), 3800);

    return () => {
      window.clearTimeout(skipTimer);
      window.clearTimeout(doneTimer);
    };
  }, [active, dismiss]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    (async () => {
      const startDelays = [420, 180, 160, 140];
      const typeSpeed = 20;

      for (let i = 0; i < LINES.length; i++) {
        await wait(startDelays[i]);
        if (cancelled) return;
        const line = LINES[i];
        for (let c = 1; c <= line.length; c++) {
          await wait(typeSpeed);
          if (cancelled) return;
          setTyped((prev) => {
            const next = [...prev];
            next[i] = line.slice(0, c);
            return next;
          });
        }
      }

      await wait(180);
      if (!cancelled) setPulse(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [active]);

  return (
    <AnimatePresence onExitComplete={() => setShowSkip(false)}>
      {active && (
        <motion.div
          key="intro-overlay"
          className="intro-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-label="CommuteDelay startup sequence"
          aria-modal="true"
        >
          <div className="intro-overlay-bg" />

          {pulse && (
            <div className="intro-radar" aria-hidden="true">
              <span className="intro-radar-ring" />
            </div>
          )}

          <div className="intro-content">
            <svg
              viewBox="0 0 1200 400"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="intro-route-svg"
              aria-hidden="true"
            >
              <defs>
                <filter id="intro-route-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <path
                d={ROUTE_PATH}
                stroke="var(--color-accent-route)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                filter="url(#intro-route-glow)"
                className="intro-route-line"
              />
              <circle cx="80" cy="280" r="6" fill="var(--color-accent-route)" />
              <circle cx="1120" cy="90" r="6" fill="var(--color-accent-route)" />
            </svg>

            <div className="intro-status">
              {LINES.map((line, i) => (
                <p key={line} className="intro-status-line">
                  <span>{typed[i]}</span>
                  {typed[i].length > 0 && typed[i].length < line.length && (
                    <span className="intro-caret" aria-hidden="true">
                      |
                    </span>
                  )}
                </p>
              ))}
            </div>
          </div>

          {showSkip && (
            <button type="button" className="intro-skip" onClick={dismiss}>
              Skip
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
