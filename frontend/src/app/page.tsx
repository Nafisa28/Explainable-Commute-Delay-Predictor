"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import RouteLineHero from "@/components/RouteLineHero";
import SplitTextHeadline from "@/components/SplitTextHeadline";
import RouteTicker from "@/components/RouteTicker";
import MagneticButton from "@/components/MagneticButton";
import DelaySeveritySlider from "@/components/DelaySeveritySlider";
import NumberedSteps from "@/components/NumberedSteps";
import TiltContainer from "@/components/TiltContainer";
import CounterNumber from "@/components/CounterNumber";

export default function HomePage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const glowX = useMotionValue(0);
  const glowY = useMotionValue(0);
  
  // Spotlight opacity springs smoothly
  const glowOpacity = useSpring(0, { stiffness: 300, damping: 30 });
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    setPrefersReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  const handleHeroMouseMove = (e: React.MouseEvent) => {
    if (prefersReduced || !heroRef.current) return;
    const rect = heroRef.current.getBoundingClientRect();
    glowX.set(e.clientX - rect.left);
    glowY.set(e.clientY - rect.top);
    glowOpacity.set(1);
  };

  const handleHeroMouseLeave = () => {
    glowOpacity.set(0);
  };

  // Radial spotlight background transform following cursor coordinates
  const glowBg = useTransform(
    [glowX, glowY],
    ([x, y]) => `radial-gradient(500px circle at ${x}px ${y}px, rgba(47, 95, 232, 0.15), transparent 80%)`
  );

  return (
    <div className="page-container">
      {/* Hero Section — Cursor Spotlight Glow */}
      <section
        ref={heroRef}
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
        className="py-16 md:py-24 text-center relative overflow-hidden rounded-2xl"
      >
        {!prefersReduced && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-0"
            style={{
              background: glowBg,
              opacity: glowOpacity,
            }}
          />
        )}

        <div className="relative z-10">
          {/* Pill badge */}
          <div className="badge-pill mb-8 inline-flex">
            <span className="h-2 w-2 rounded-full bg-factor-rain animate-pulse" />
            <span>Live data collection running</span>
          </div>

          {/* Headline — Fraunces, word-by-word reveal */}
          <SplitTextHeadline />

          {/* Subheading — Inter */}
          <p className="mx-auto max-w-2xl text-lg text-text-secondary leading-relaxed mb-10">
            Predict travel delays on Bengaluru routes using real-time traffic and
            weather data — and understand{" "}
            <em className="not-italic text-ink font-medium">why</em> each
            prediction was made, powered by explainable AI.
          </p>

          {/* Animated street grid map SVG */}
          <RouteLineHero />

          {/* CTA buttons — Magnetic hover */}
          <div className="flex items-center justify-center gap-3 mt-10">
            <MagneticButton href="/predict" className="btn btn-primary text-base px-7 py-3">
              Try a Prediction →
            </MagneticButton>
            <MagneticButton href="/history" className="btn btn-secondary text-base px-7 py-3">
              View History
            </MagneticButton>
          </div>
        </div>
      </section>

      {/* Live route ticker strip */}
      <RouteTicker />

      <div className="divider" />

      {/* Interactive Time Slider Delay severity demo section */}
      <DelaySeveritySlider />

      <div className="divider" />

      {/* Numbered "How it works" section — ScrollReveal & Staggered */}
      <NumberedSteps />

      <div className="divider" />

      {/* Animated Stats strip section */}
      <section className="py-14 text-center">
        <h2 className="font-display text-2xl font-bold tracking-tight mb-12 text-ink">
          Predicting commute delays at scale
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TiltContainer>
            <div className="card text-center p-8 h-full flex flex-col justify-center">
              <div className="text-4xl sm:text-5xl font-mono font-extrabold text-accent-route mb-2">
                <CounterNumber value={8} />
              </div>
              <div className="text-sm font-semibold text-text-secondary">
                routes monitored
              </div>
            </div>
          </TiltContainer>

          <TiltContainer>
            <div className="card text-center p-8 h-full flex flex-col justify-center">
              <div className="text-4xl sm:text-5xl font-mono font-extrabold text-accent-route mb-2">
                every <CounterNumber value={30} /> min
              </div>
              <div className="text-sm font-semibold text-text-secondary">
                updated real-time data
              </div>
            </div>
          </TiltContainer>

          <TiltContainer>
            <div className="card text-center p-8 h-full flex flex-col justify-center">
              <div className="text-4xl sm:text-5xl font-mono font-extrabold text-accent-route mb-2">
                <CounterNumber value={100} />%
              </div>
              <div className="text-sm font-semibold text-text-secondary">
                explainable predictions
              </div>
            </div>
          </TiltContainer>
        </div>
      </section>
    </div>
  );
}
