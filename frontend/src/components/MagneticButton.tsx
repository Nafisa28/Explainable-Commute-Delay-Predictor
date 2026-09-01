"use client";

import { useRef, useState, useEffect } from "react";
import Link from "next/link";

/**
 * MagneticButton — A button or link that pulls noticeably toward the cursor.
 *
 * Pulls up to 25px when cursor is within ~120px of button center.
 * Scales to 1.08x on hover. Disabled completely under prefers-reduced-motion.
 */
interface MagneticButtonProps {
  href?: string;
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLElement>;
  children: React.ReactNode;
}

export default function MagneticButton({
  href,
  className = "",
  disabled = false,
  type = "button",
  onClick,
  children,
}: MagneticButtonProps) {
  const ref = useRef<any>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setPrefersReduced(reduced);

    if (reduced || disabled) {
      setIsHovered(false);
      setOffset({ x: 0, y: 0 });
      return;
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const triggerRadius = 120; // 80px detection radius around button boundaries

      if (distance < triggerRadius) {
        setIsHovered(true);
        // Pull strength increases closer to center
        const power = (triggerRadius - distance) / triggerRadius;
        const maxPull = 25; // Bold displacement 20-25px
        
        const angle = Math.atan2(dy, dx);
        setOffset({
          x: Math.cos(angle) * maxPull * Math.pow(power, 1.2),
          y: Math.sin(angle) * maxPull * Math.pow(power, 1.2),
        });
      } else {
        setIsHovered(false);
        setOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
    };
  }, [disabled, prefersReduced]);

  const style: React.CSSProperties = {
    transform: prefersReduced
      ? "none"
      : `translate(${offset.x}px, ${offset.y}px) scale(${isHovered ? 1.08 : 1})`,
    transition: prefersReduced
      ? "none"
      : isHovered
      ? "transform 0.15s ease-out"
      : "transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)",
    willChange: "transform",
  };

  if (href) {
    return (
      <Link
        ref={ref}
        href={href}
        onClick={onClick}
        className={className}
        style={style}
      >
        {children}
      </Link>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
      style={style}
    >
      {children}
    </button>
  );
}
