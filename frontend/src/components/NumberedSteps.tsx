"use client";

import { useState } from "react";
import { StaggerContainer, ScrollReveal } from "./ScrollReveal";
import TiltContainer from "./TiltContainer";

/**
 * NumberedSteps — "How it works" section with large muted step numbers,
 * hover-expanding cards that reveal additional detail text, wrapped in 3D tilts.
 */

const STEPS = [
  {
    number: "01",
    title: "Pick your route",
    summary: "Choose from popular Bengaluru commute corridors with multiple path variants.",
    detail:
      "Select origin and destination from our monitored corridors — Whitefield, Electronic City, Koramangala, and more. Each route has multiple path options.",
    emoji: "🛣️",
  },
  {
    number: "02",
    title: "We check live traffic & weather",
    summary: "Real-time signals feed into our XGBoost model for an up-to-the-minute prediction.",
    detail:
      "Our pipeline pulls live traffic density from Google Maps, current weather from OpenWeather, and checks for nearby events — all in under 2 seconds.",
    emoji: "📡",
  },
  {
    number: "03",
    title: "Get your prediction, explained",
    summary: "See your expected delay and understand exactly what's driving it.",
    detail:
      "SHAP values break down every prediction factor — rain, peak hour, events, road type — so you know why, not just how much. No black boxes.",
    emoji: "📊",
  },
];

export default function NumberedSteps() {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  return (
    <section className="py-14">
      <h2 className="font-display text-center text-2xl font-bold tracking-tight mb-12 text-ink">
        How it works
      </h2>

      <StaggerContainer className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {STEPS.map((step, i) => {
          const isExpanded = expandedIdx === i;
          return (
            <ScrollReveal key={step.number}>
              <TiltContainer className="h-full">
                <div
                  className="numbered-step-card h-full"
                  onMouseEnter={() => setExpandedIdx(i)}
                  onMouseLeave={() => setExpandedIdx(null)}
                >
                  {/* Large muted number */}
                  <span className="step-number" aria-hidden="true">
                    {step.number}
                  </span>

                  {/* Emoji icon */}
                  <div className="step-emoji">{step.emoji}</div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold mb-2 text-ink relative z-10">
                    {step.title}
                  </h3>

                  {/* Summary — always visible */}
                  <p className="text-sm text-text-secondary relative z-10">
                    {step.summary}
                  </p>

                  {/* Detail — expands on hover */}
                  <div
                    className="step-detail"
                    style={{
                      maxHeight: isExpanded ? "120px" : "0px",
                      opacity: isExpanded ? 1 : 0,
                      marginTop: isExpanded ? "0.75rem" : "0",
                      transition:
                        "max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease, margin-top 0.3s ease",
                    }}
                  >
                    <p className="text-xs text-text-muted leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                </div>
              </TiltContainer>
            </ScrollReveal>
          );
        })}
      </StaggerContainer>
    </section>
  );
}
