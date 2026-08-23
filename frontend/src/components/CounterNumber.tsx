"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, animate } from "framer-motion";

/**
 * CounterNumber — Counts up from 0 to value when scrolled into view.
 *
 * Eased count up over 1.5 seconds. Instantly displays value under prefers-reduced-motion.
 */
export default function CounterNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -60px 0px" });
  const [prefersReduced, setPrefersReduced] = useState(false);
  const hasAnimated = useRef(false);

  useEffect(() => {
    setPrefersReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  useEffect(() => {
    if (!ref.current) return;

    if (prefersReduced) {
      ref.current.textContent = value.toString();
      return;
    }

    if (isInView && !hasAnimated.current) {
      hasAnimated.current = true;
      const node = ref.current;
      const controls = animate(0, value, {
        duration: 1.5,
        ease: [0.16, 1, 0.3, 1],
        onUpdate(latest) {
          node.textContent = Math.round(latest).toString();
        },
      });

      return () => controls.stop();
    }
  }, [isInView, value, prefersReduced]);

  return <span ref={ref} className="font-mono tabular-nums">0</span>;
}
