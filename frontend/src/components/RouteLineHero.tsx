"use client";

import { useState, useEffect } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import TiltContainer from "@/components/TiltContainer";

/**
 * RouteLineHero — Animated, curved city street map illustration.
 *
 * Previews live location tracking and commute delay features.
 */
export default function RouteLineHero() {
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);
  const [prefersReduced, setPrefersReduced] = useState(false);

  const { scrollY } = useScroll();
  const gridY = useTransform(scrollY, [0, 600], [0, 45]);

  useEffect(() => {
    setPrefersReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // The main route path data (smooth curved route)
  const pathData = "M 60 180 C 120 180, 170 120, 220 110 C 270 100, 350 180, 410 160 C 470 140, 500 80, 560 80 C 590 80, 610 60, 640 60";

  // Segment curves for hover highlights
  const segments = [
    {
      id: 1,
      // Highlight around Pin 1 (starts at start of route and goes up to Pin 2)
      d: "M 60 180 C 120 180, 170 120, 220 110 C 270 100, 350 180, 410 160",
      colorVar: "var(--color-factor-rain)",
    },
    {
      id: 2,
      // Highlight around Pin 2 (covers Pin 1 to Pin 3)
      d: "M 220 110 C 270 100, 350 180, 410 160 C 470 140, 500 80, 560 80",
      colorVar: "var(--color-factor-peak)",
    },
    {
      id: 3,
      // Highlight around Pin 3 (covers Pin 2 to end of route)
      d: "M 410 160 C 470 140, 500 80, 560 80 C 590 80, 610 60, 640 60",
      colorVar: "var(--color-factor-event)",
    },
  ];

  // List of pins and their configurations
  const pins = [
    {
      id: 1,
      tx: 220,
      ty: 110,
      colorVar: "var(--color-factor-rain)",
      colorDimVar: "var(--color-factor-rain-dim)",
      label: "Rain +5 min",
      width: 85,
    },
    {
      id: 2,
      tx: 410,
      ty: 160,
      colorVar: "var(--color-factor-peak)",
      colorDimVar: "var(--color-factor-peak-dim)",
      label: "Peak hour +8 min",
      width: 110,
    },
    {
      id: 3,
      tx: 560,
      ty: 80,
      colorVar: "var(--color-factor-event)",
      colorDimVar: "var(--color-factor-event-dim)",
      label: "Event nearby +2 min",
      width: 120,
    },
  ];

  return (
    <TiltContainer className="relative w-full max-w-3xl mx-auto my-6 select-none">
      <div className="w-full bg-bg-surface border border-border rounded-xl p-4 sm:p-6 shadow-sm" aria-hidden="true">
        <svg
          viewBox="0 0 700 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-auto"
          role="img"
          aria-label="City grid map showing travel route with delay factor pins"
        >
        <defs>
          {/* Glow filter for route line */}
          <filter id="route-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          
          {/* Custom glow filters for interactive segments */}
          {pins.map((pin) => (
            <filter id={`glow-pin-${pin.id}`} key={pin.id} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feComponentTransfer in="blur" result="glow">
                <feFuncA type="linear" slope="0.6" />
              </feComponentTransfer>
              <feMerge>
                <feMergeNode in="glow" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          ))}
        </defs>

        {/* 1. Abstract City Grid Roads (Background) - Gently Curved with Parallax */}
        <motion.g
          stroke="var(--color-road-faint)"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
          style={{ y: prefersReduced ? 0 : gridY }}
        >
          {/* Curved road network */}
          <path d="M 20 180 C 60 180, 120 180, 170 120 C 180 115, 200 90, 240 70 C 280 50, 320 50, 380 50" />
          <path d="M 360 220 C 380 180, 410 160, 420 130 C 430 100, 450 40, 440 20" />
          <path d="M 510 220 C 530 170, 560 80, 570 60 C 580 40, 590 30, 600 20" />
          <path d="M 20 60 C 120 60, 200 40, 300 40 C 400 40, 500 70, 680 70" />
          <path d="M 20 220 C 150 220, 250 200, 450 200 C 550 200, 620 180, 680 180" />
          <path d="M 100 20 C 110 80, 90 140, 110 220" />
          <path d="M 220 110 C 240 100, 260 70, 300 40" />
        </motion.g>

        {/* 2. Primary Route Highlight — Animated stroke-draw */}
        <path
          d={pathData}
          stroke="var(--color-accent-route)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          filter="url(#route-glow)"
          className="map-route-line"
        />

        {/* Start & End node bases */}
        <circle cx="60" cy="180" r="5.5" fill="var(--color-accent-route)" />
        <circle cx="640" cy="60" r="5.5" fill="var(--color-accent-route)" />

        {/* 3. Hover Route Highlights */}
        {segments.map((seg) => {
          const isActive = hoveredPin === seg.id;
          return (
            <path
              key={seg.id}
              d={seg.d}
              stroke={seg.colorVar}
              strokeWidth="5.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              filter={`url(#glow-pin-${seg.id})`}
              className={`route-highlight-segment ${isActive ? "opacity-100" : "opacity-0"}`}
              style={{
                transition: "opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), stroke-width 0.3s ease",
                pointerEvents: "none",
              }}
            />
          );
        })}

        {/* 4. Live location traveling dot (Traces route) */}
        <circle
          r="3"
          fill="var(--color-accent-route)"
          stroke="#FFFFFF"
          strokeWidth="1.5"
          className="traveling-dot"
        />

        {/* 5. Teardrop Pin Markers & Labels */}
        {pins.map((pin) => {
          const isHovered = hoveredPin === pin.id;
          return (
            <g key={pin.id} className={`pin-${pin.id}`}>
              {/* Inner group handling scaling transitions on hover */}
              <g
                onMouseEnter={() => setHoveredPin(pin.id)}
                onMouseLeave={() => setHoveredPin(null)}
                style={{
                  cursor: "pointer",
                  transformOrigin: `${pin.tx}px ${pin.ty}px`,
                  transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  transform: isHovered ? "scale(1.12)" : "scale(1)",
                }}
              >
                {/* Teardrop Pin marker shape */}
                <path
                  d={`M ${pin.tx} ${pin.ty} C ${pin.tx - 8} ${pin.ty - 10}, ${pin.tx - 8} ${pin.ty - 18}, ${pin.tx} ${pin.ty - 18} C ${pin.tx + 8} ${pin.ty - 18}, ${pin.tx + 8} ${pin.ty - 10}, ${pin.tx} ${pin.ty} Z`}
                  fill={pin.colorVar}
                />
                {/* Tiny inner white circle */}
                <circle cx={pin.tx} cy={pin.ty - 11} r="2.5" fill="#FFFFFF" />
              </g>

              {/* Label Group */}
              <g className={`label-${pin.id}`}>
                <g
                  onMouseEnter={() => setHoveredPin(pin.id)}
                  onMouseLeave={() => setHoveredPin(null)}
                  style={{
                    cursor: "pointer",
                    transformOrigin: `${pin.tx}px ${pin.ty - 28}px`,
                    transition: "transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transform: isHovered ? "scale(1.06)" : "scale(1)",
                  }}
                >
                  {/* Background Box */}
                  <rect
                    x={pin.tx - pin.width / 2}
                    y={pin.ty - 48}
                    width={pin.width}
                    height="20"
                    rx="4"
                    fill={pin.colorDimVar}
                    stroke={pin.colorVar}
                    strokeWidth="0.75"
                  />
                  {/* Label Text */}
                  <text
                    x={pin.tx}
                    y={pin.ty - 34}
                    textAnchor="middle"
                    fill={pin.colorVar}
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="var(--font-sans)"
                  >
                    {pin.label}
                  </text>
                </g>
              </g>
            </g>
          );
        })}
      </svg>
      </div>
    </TiltContainer>
  );
}
