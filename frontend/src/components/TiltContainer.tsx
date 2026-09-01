"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * TiltContainer — Applies a bold 3D perspective rotation on hover.
 *
 * Rotates rotateX and rotateY by up to 9 degrees based on relative mouse position,
 * scales up to 1.05x, and elevates the card shadow. Springs back smoothly on leave.
 * Disabled completely if prefers-reduced-motion is active.
 */
export default function TiltContainer({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [prefersReduced, setPrefersReduced] = useState(false);

  // Normalized relative mouse coordinates (0 to 1)
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);

  // Map 0..1 mouse position to -9..9 degrees tilt
  const rawRotateX = useTransform(y, [0, 1], [9, -9]);
  const rawRotateY = useTransform(x, [0, 1], [-9, 9]);

  const rotateX = useSpring(rawRotateX, { damping: 25, stiffness: 220 });
  const rotateY = useSpring(rawRotateY, { damping: 25, stiffness: 220 });

  const scale = useSpring(1, { damping: 25, stiffness: 220 });
  const shadowProgress = useSpring(0, { damping: 25, stiffness: 220 });

  // Smoothly blend card shadows on tilt hover — MUST be above early return
  const boxShadow = useTransform(
    shadowProgress,
    [0, 1],
    [
      "0 1px 3px rgba(35, 33, 43, 0.04), 0 1px 2px rgba(35, 33, 43, 0.02)",
      "0 20px 25px -5px rgba(35, 33, 43, 0.08), 0 10px 10px -5px rgba(124, 131, 253, 0.12)",
    ]
  );

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    setPrefersReduced(reduced || isTouch);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReduced || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    x.set(mouseX / rect.width);
    y.set(mouseY / rect.height);
    scale.set(1.05);
    shadowProgress.set(1);
  };

  const handleMouseLeave = () => {
    x.set(0.5);
    y.set(0.5);
    scale.set(1);
    shadowProgress.set(0);
  };

  // Early return AFTER all hooks have been declared
  if (prefersReduced) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={className}
      style={{
        rotateX,
        rotateY,
        scale,
        boxShadow,
        // transformPerspective keeps the tilt without preserve-3d / translateZ,
        // which previously created a 3D stacking context that swallowed wheel scroll.
        transformPerspective: 1000,
        touchAction: "pan-y",
      }}
    >
      {children}
    </motion.div>
  );
}
