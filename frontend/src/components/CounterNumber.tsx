"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, animate } from "framer-motion";

/**
 * CounterNumber — Counts up from 0 to value when scrolled into view.
 *
 * Eased count-up (~0.8s by default). Instantly displays value under prefers-reduced-motion.
 */
export default function CounterNumber({
  value,
  duration = 0.8,
  decimals = 0,
  prefix = "",
  suffix = "",
  className = "",
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -60px 0px" });
  const [prefersReduced, setPrefersReduced] = useState(false);
  const hasAnimated = useRef(false);

  const format = (n: number) => {
    const rounded = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toString();
    return `${prefix}${rounded}${suffix}`;
  };

  useEffect(() => {
    setPrefersReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!ref.current) return;

    if (prefersReduced) {
      ref.current.textContent = format(value);
      return;
    }

    if (isInView && !hasAnimated.current) {
      hasAnimated.current = true;
      const node = ref.current;
      const controls = animate(0, value, {
        duration,
        ease: [0.16, 1, 0.3, 1],
        onUpdate(latest) {
          node.textContent = format(latest);
        },
      });

      return () => controls.stop();
    }
  }, [isInView, value, prefersReduced, duration, decimals, prefix, suffix]);

  return (
    <span ref={ref} className={`font-mono tabular-nums ${className}`.trim()}>
      {format(0)}
    </span>
  );
}
