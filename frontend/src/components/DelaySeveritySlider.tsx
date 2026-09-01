"use client";

import { useState } from "react";
import TiltContainer from "@/components/TiltContainer";

/**
 * DelaySeveritySlider — Interactive time-of-day delay demo.
 *
 * A horizontal range slider from 6 AM–10 PM with a mock delay lookup table
 * that mimics real Bengaluru commute patterns. As the user drags, a color-coded
 * badge and "+X min" text update in real time.
 */

// Mock delay data keyed by hour (6–22). Values in minutes.
// Pattern: low overnight/midday, high at 8-10 AM and 5:30-8 PM.
const DELAY_BY_HOUR: Record<number, number> = {
  6: 3,
  7: 8,
  8: 18,
  9: 22,
  10: 14,
  11: 6,
  12: 4,
  13: 3,
  14: 5,
  15: 6,
  16: 9,
  17: 16,
  18: 24,
  19: 20,
  20: 12,
  21: 5,
  22: 3,
};

type Severity = "low" | "moderate" | "high";

function getSeverity(delay: number): Severity {
  if (delay <= 7) return "low";
  if (delay <= 15) return "moderate";
  return "high";
}

const SEVERITY_CONFIG: Record<Severity, { label: string; bg: string; text: string; border: string }> = {
  low: {
    label: "Low delay",
    bg: "rgba(31, 168, 160, 0.12)",
    text: "var(--color-factor-rain)",
    border: "var(--color-factor-rain)",
  },
  moderate: {
    label: "Moderate delay",
    bg: "rgba(232, 163, 61, 0.12)",
    text: "var(--color-factor-peak)",
    border: "var(--color-factor-peak)",
  },
  high: {
    label: "High delay",
    bg: "rgba(224, 86, 58, 0.12)",
    text: "var(--color-factor-event)",
    border: "var(--color-factor-event)",
  },
};

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export default function DelaySeveritySlider() {
  const [hour, setHour] = useState(8); // Default to 8 AM — peak

  const delay = DELAY_BY_HOUR[hour] ?? 3;
  const severity = getSeverity(delay);
  const config = SEVERITY_CONFIG[severity];

  return (
    <section className="py-14">
      <h2 className="font-display text-center text-2xl font-bold tracking-tight mb-3 text-ink">
        See how delay risk changes through the day
      </h2>
      <p className="text-center text-sm text-text-secondary mb-10">
        Drag the slider to preview predicted delay for a sample route — this is illustrative demo data.
      </p>

      <TiltContainer className="delay-slider-card glow-metric">
        {/* Route label */}
        <div className="text-center mb-6">
          <span className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-accent-route">
              <circle cx="8" cy="8" r="3" fill="currentColor" opacity="0.3" />
              <circle cx="8" cy="8" r="1.5" fill="currentColor" />
            </svg>
            Whitefield → MG Road
          </span>
        </div>

        {/* Result display */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="text-4xl font-bold text-ink tabular-nums">
            +{delay} min
          </div>
          <span
            className="delay-severity-badge"
            style={{
              background: config.bg,
              color: config.text,
              borderColor: config.border,
            }}
          >
            {config.label}
          </span>
          <span className="text-sm text-text-muted">
            predicted delay at {formatHour(hour)}
          </span>
        </div>

        {/* Slider */}
        <div className="slider-wrapper">
          <input
            type="range"
            min={6}
            max={22}
            step={1}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="delay-slider"
            aria-label="Time of day"
            style={{
              // Dynamic accent color based on severity
              "--slider-accent": config.text,
            } as React.CSSProperties}
          />
          <div className="flex justify-between text-xs text-text-muted mt-2 px-0.5">
            <span>6 AM</span>
            <span>12 PM</span>
            <span>6 PM</span>
            <span>10 PM</span>
          </div>
        </div>

        {/* Mini bar chart visualization */}
        <div className="delay-bars" aria-hidden="true">
          {Object.entries(DELAY_BY_HOUR).map(([h, d]) => {
            const hNum = Number(h);
            const isActive = hNum === hour;
            const barSeverity = getSeverity(d);
            const barColor = SEVERITY_CONFIG[barSeverity].text;
            return (
              <div
                key={h}
                className="delay-bar"
                style={{
                  height: `${Math.max(4, (d / 24) * 48)}px`,
                  background: isActive ? barColor : "var(--color-border)",
                  opacity: isActive ? 1 : 0.5,
                  transition: "all 0.2s ease",
                }}
              />
            );
          })}
        </div>
      </TiltContainer>
    </section>
  );
}
