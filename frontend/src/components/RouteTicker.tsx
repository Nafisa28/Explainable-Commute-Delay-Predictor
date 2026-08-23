"use client";

import { useEffect, useRef, useState } from "react";

/**
 * RouteTicker — Infinite-loop horizontal marquee of monitored route names.
 *
 * Auto-scrolls left-to-right continuously. Pauses on hover.
 * Under prefers-reduced-motion: animation paused, shows static list.
 */

const ROUTES = [
  "Whitefield – MG Road",
  "Electronic City – Silk Board",
  "Koramangala – Indiranagar",
  "Hebbal – Yeshwanthpur",
  "Marathahalli – Bellandur",
  "Jayanagar – Majestic",
  "HSR Layout – Sarjapur Road",
  "KR Puram – Tin Factory",
];

export default function RouteTicker() {
  const [paused, setPaused] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrefersReduced(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // Build the content string: "Route 1   •   Route 2   •   ..."
  const separator = "\u00A0\u00A0\u00A0•\u00A0\u00A0\u00A0";
  const content = ROUTES.join(separator);

  return (
    <div
      className="ticker-strip"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Monitored routes"
      role="marquee"
    >
      <div
        ref={tickerRef}
        className="ticker-track"
        style={{
          animationPlayState: paused || prefersReduced ? "paused" : "running",
        }}
      >
        {/* Duplicate content for seamless loop */}
        <span className="ticker-content">{content}{separator}</span>
        <span className="ticker-content" aria-hidden="true">{content}{separator}</span>
      </div>
    </div>
  );
}
