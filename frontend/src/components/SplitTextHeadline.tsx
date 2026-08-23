"use client";

import { useEffect, useRef, useState } from "react";

/**
 * SplitTextHeadline — Word-by-word staggered reveal animation.
 *
 * Splits the headline into two lines:
 *   Line 1: "Know your commute delay" (normal color)
 *   Line 2: "before you leave." (accent color)
 *
 * Each word fades + slides up with a stagger delay.
 * Under prefers-reduced-motion: all words render immediately, no animation.
 */
export default function SplitTextHeadline() {
  const line1Words = ["Know", "your", "commute", "delay"];
  const line2Words = ["before", "you", "leave."];
  const allWords = [...line1Words, ...line2Words];
  const [revealed, setRevealed] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const containerRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPrefersReduced(reduced);

    // If reduced motion, show everything immediately
    if (reduced) {
      setRevealed(true);
      return;
    }

    // Small delay so the component is mounted before animation starts
    const timer = setTimeout(() => setRevealed(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const wordStyle = (index: number): React.CSSProperties => {
    if (prefersReduced) {
      return {
        display: "inline-block",
        opacity: 1,
        transform: "none",
      };
    }

    return {
      display: "inline-block",
      opacity: revealed ? 1 : 0,
      transform: revealed ? "translateY(0)" : "translateY(12px)",
      transition: `opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.07}s, transform 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${index * 0.07}s`,
    };
  };

  return (
    <h1
      ref={containerRef}
      className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-5 text-ink"
    >
      {/* Line 1 — normal ink color */}
      <span className="block">
        {line1Words.map((word, i) => (
          <span key={i} style={wordStyle(i)}>
            {word}
            {i < line1Words.length - 1 && "\u00A0"}
          </span>
        ))}
      </span>
      {/* Line 2 — accent-route color */}
      <span className="block text-accent-route">
        {line2Words.map((word, i) => {
          const globalIdx = line1Words.length + i;
          return (
            <span key={globalIdx} style={wordStyle(globalIdx)}>
              {word}
              {i < line2Words.length - 1 && "\u00A0"}
            </span>
          );
        })}
      </span>
    </h1>
  );
}
