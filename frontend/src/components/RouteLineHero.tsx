"use client";

/**
 * RouteLineHero — Animated City Grid street map illustration.
 *
 * Previews live location tracking and commute delay features.
 * Features:
 *   1. Faint road network background.
 *   2. Highlighted diagonal route drawn on page load.
 *   3. Teardrop pins dropping in with labels at waypoints.
 *   4. Traveling live-location dot tracing the path.
 * Respects prefers-reduced-motion via CSS.
 */
export default function RouteLineHero() {
  const pathData = "M 60 180 L 150 180 L 150 100 L 350 100 L 350 140 L 450 140 L 450 60 L 640 60";

  return (
    <div className="relative w-full max-w-3xl mx-auto my-6 select-none bg-bg-surface border border-border rounded-xl p-4 sm:p-6 shadow-sm" aria-hidden="true">
      <svg
        viewBox="0 0 700 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-auto"
        role="img"
        aria-label="City grid map showing travel route with delay factor pins"
      >
        {/* Glow filter for route line */}
        <defs>
          <filter id="route-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* 1. Abstract City Grid Roads (Background) */}
        <g stroke="var(--color-road-faint)" strokeWidth="1.5" strokeLinecap="round">
          {/* Horizontals */}
          <line x1="20" y1="60" x2="680" y2="60" />
          <line x1="20" y1="100" x2="520" y2="100" />
          <line x1="180" y1="140" x2="680" y2="140" />
          <line x1="20" y1="180" x2="680" y2="180" />
          <line x1="100" y1="220" x2="600" y2="220" />
          
          {/* Verticals */}
          <line x1="60" y1="20" x2="60" y2="240" />
          <line x1="150" y1="20" x2="150" y2="200" />
          <line x1="250" y1="80" x2="250" y2="240" />
          <line x1="350" y1="20" x2="350" y2="200" />
          <line x1="450" y1="80" x2="450" y2="240" />
          <line x1="550" y1="20" x2="550" y2="200" />
          <line x1="640" y1="20" x2="640" y2="240" />
        </g>

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

        {/* 3. Teardrop Pin Markers & Labels */}
        
        {/* Pin 1: Teal (Rain factor) */}
        <g className="pin-1">
          <path d="M 250 100 C 242 90, 242 82, 250 82 C 258 82, 258 90, 250 100 Z" fill="var(--color-factor-rain)" />
          <circle cx="250" cy="89" r="2.5" fill="#FFFFFF" />
        </g>
        <g className="label-1" style={{ transformOrigin: "250px 72px" }}>
          <rect x="200" y="52" width="100" height="20" rx="4" fill="var(--color-factor-rain-dim)" stroke="var(--color-factor-rain)" strokeWidth="0.75" />
          <text x="250" y="66" textAnchor="middle" fill="var(--color-factor-rain)" fontSize="10" fontWeight="600" fontFamily="var(--font-sans)">
            Rain +5 min
          </text>
        </g>

        {/* Pin 2: Amber (Peak hour factor) */}
        <g className="pin-2">
          <path d="M 400 140 C 392 130, 392 122, 400 122 C 408 122, 408 130, 400 140 Z" fill="var(--color-factor-peak)" />
          <circle cx="400" cy="129" r="2.5" fill="#FFFFFF" />
        </g>
        <g className="label-2" style={{ transformOrigin: "400px 112px" }}>
          <rect x="345" y="92" width="110" height="20" rx="4" fill="var(--color-factor-peak-dim)" stroke="var(--color-factor-peak)" strokeWidth="0.75" />
          <text x="400" y="106" textAnchor="middle" fill="var(--color-factor-peak)" fontSize="10" fontWeight="600" fontFamily="var(--font-sans)">
            Peak hour +8 min
          </text>
        </g>

        {/* Pin 3: Coral (Event nearby factor) */}
        <g className="pin-3">
          <path d="M 550 60 C 542 50, 542 42, 550 42 C 558 42, 558 50, 550 60 Z" fill="var(--color-factor-event)" />
          <circle cx="550" cy="49" r="2.5" fill="#FFFFFF" />
        </g>
        <g className="label-3" style={{ transformOrigin: "550px 32px" }}>
          <rect x="495" y="12" width="110" height="20" rx="4" fill="var(--color-factor-event-dim)" stroke="var(--color-factor-event)" strokeWidth="0.75" />
          <text x="550" y="26" textAnchor="middle" fill="var(--color-factor-event)" fontSize="10" fontWeight="600" fontFamily="var(--font-sans)">
            Event nearby +2 min
          </text>
        </g>

        {/* 4. Live location traveling dot (Traces route, then fades) */}
        <circle r="4.5" fill="var(--color-accent-route)" stroke="#FFFFFF" strokeWidth="1.5" className="traveling-dot">
          <animateMotion
            path={pathData}
            begin="2.0s"
            dur="2.2s"
            fill="freeze"
            calcMode="linear"
          />
        </circle>
      </svg>
    </div>
  );
}
