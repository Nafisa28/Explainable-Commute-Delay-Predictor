"use client";

/**
 * ScanSweep — Soft pastel HUD scan-line overlay used while data is fetching.
 * Hidden entirely when prefers-reduced-motion is on (CSS).
 */
export default function ScanSweep({ active = true }: { active?: boolean }) {
  if (!active) return null;
  return <div className="scan-sweep" aria-hidden="true" />;
}
