"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * CustomCursor — Circular cursor that follows the mouse with spring physics lag.
 *
 * Custom cursor diameter: 24px (normal), 48px (hovering clickable element).
 * Color: var(--color-accent-route) with mix-blend-mode: difference.
 * Disabled completely on touch devices and if prefers-reduced-motion is active.
 */
export default function CustomCursor() {
  const [hovered, setHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);

  // Spring physics configuration for cursor movement lag
  const springConfig = { damping: 30, stiffness: 280, mass: 0.5 };
  const cursorXSpring = useSpring(cursorX, springConfig);
  const cursorYSpring = useSpring(cursorY, springConfig);

  useEffect(() => {
    // Disable entirely under reduced motion
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPrefersReduced(reduced);
    if (reduced) return;

    // Disable entirely on touch devices
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (isTouch) return;

    setIsVisible(true);

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const isClickable =
        target.closest("a") ||
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("textarea") ||
        target.closest(".card") ||
        target.closest(".btn") ||
        target.closest("[role='button']") ||
        target.closest(".clickable-element");

      setHovered(!!isClickable);
    };

    window.addEventListener("mousemove", moveCursor);
    window.addEventListener("mouseover", handleMouseOver);

    // Hide default cursor globally
    document.body.style.cursor = "none";
    const style = document.createElement("style");
    style.id = "custom-cursor-override-styles";
    style.innerHTML = `
      * {
        cursor: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      window.removeEventListener("mousemove", moveCursor);
      window.removeEventListener("mouseover", handleMouseOver);
      document.body.style.cursor = "auto";
      const styleNode = document.getElementById("custom-cursor-override-styles");
      if (styleNode) styleNode.remove();
    };
  }, [cursorX, cursorY]);

  if (prefersReduced || !isVisible) return null;

  return (
    <motion.div
      className="fixed top-0 left-0 rounded-full pointer-events-none"
      style={{
        width: 24,
        height: 24,
        backgroundColor: "var(--color-accent-route)",
        zIndex: 99999,
        mixBlendMode: "difference",
        x: cursorXSpring,
        y: cursorYSpring,
        translateX: "-50%",
        translateY: "-50%",
      }}
      animate={{
        width: hovered ? 48 : 24,
        height: hovered ? 48 : 24,
        opacity: hovered ? 0.35 : 1,
      }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
    />
  );
}
