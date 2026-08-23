"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";

// Context to share reveal state and assign stagger indices to child items
const StaggerContext = createContext<{
  registerItem: (id: string) => number;
  revealed: boolean;
} | null>(null);

/**
 * StaggerContainer — Wraps a group of ScrollReveal items.
 * Triggers a unified reveal when the container enters the viewport.
 */
export function StaggerContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const [revealed, setRevealed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const itemsRegistry = useRef<string[]>([]);

  const registerItem = (id: string) => {
    if (!itemsRegistry.current.includes(id)) {
      itemsRegistry.current.push(id);
    }
    return itemsRegistry.current.indexOf(id);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -60px 0px" }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <StaggerContext.Provider value={{ registerItem, revealed }}>
      <div ref={containerRef} className={className}>
        {children}
      </div>
    </StaggerContext.Provider>
  );
}

/**
 * ScrollReveal — Animate child items sequentially as they enter viewport.
 * Uses index stagger within a StaggerContainer, or reveals individually if standalone.
 */
export function ScrollReveal({
  children,
  className = "",
  delayOffset = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delayOffset?: number;
}) {
  const context = useContext(StaggerContext);
  const id = useRef(Math.random().toString(36).substring(2, 9));
  const [itemIndex, setItemIndex] = useState<number | null>(null);
  const [prefersReduced, setPrefersReduced] = useState(false);
  const [localRevealed, setLocalRevealed] = useState(false);
  const localRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrefersReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    
    if (context) {
      setItemIndex(context.registerItem(id.current));
    } else {
      // Standalone reveal if not wrapped in StaggerContainer
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setLocalRevealed(true);
            observer.disconnect();
          }
        },
        { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
      );
      if (localRef.current) {
        observer.observe(localRef.current);
      }
      return () => observer.disconnect();
    }
  }, [context]);

  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  const isRevealed = context ? context.revealed : localRevealed;
  const index = itemIndex ?? 0;
  const delay = index * 0.12 + delayOffset;

  return (
    <div
      ref={localRef}
      className={className}
      style={{
        opacity: isRevealed ? 1 : 0,
        transform: isRevealed ? "translateY(0)" : "translateY(20px)",
        transition: `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}s`,
        willChange: "transform, opacity",
      }}
    >
      {children}
    </div>
  );
}
