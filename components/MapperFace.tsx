"use client";

import { useEffect, useRef, useState } from "react";

export type MapperMood = "idle" | "thinking" | "streaming" | "done";

const LABELS: Record<MapperMood, string> = {
  idle: "Mapper",
  thinking: "Mapper thinking",
  streaming: "Mapper writing",
  done: "Mapper analysis complete",
};

export function MapperFace({
  mood,
  size = "md",
  className = "",
}: {
  mood: MapperMood;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const [pupils, setPupils] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduce) return;
    const onMove = (event: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const dx = (event.clientX - (rect.left + rect.width / 2)) / Math.max(rect.width, 1);
      const dy = (event.clientY - (rect.top + rect.height / 2)) / Math.max(rect.height, 1);
      setPupils({
        x: Math.max(-1.6, Math.min(1.6, dx * 1.8)),
        y: Math.max(-1.2, Math.min(1.2, dy * 1.4)),
      });
    };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, [reduce]);

  useEffect(() => {
    if (reduce || mood !== "idle") {
      setBlink(false);
      return;
    }
    let timeout = 0;
    const loop = () => {
      timeout = window.setTimeout(() => {
        setBlink(true);
        timeout = window.setTimeout(() => {
          setBlink(false);
          loop();
        }, 140);
      }, 2800 + Math.random() * 1800);
    };
    loop();
    return () => window.clearTimeout(timeout);
  }, [mood, reduce]);

  const squint = mood === "done" || blink;
  const scan = (mood === "thinking" || mood === "streaming") && !reduce;

  return (
    <span
      ref={rootRef}
      className={`mapper-face mapper-${size} is-${mood} ${scan ? "is-scanning" : ""} ${className}`.trim()}
      role="img"
      aria-label={LABELS[mood]}
    >
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="7" y="7" width="34" height="34" rx="13" fill="var(--paper)" stroke="var(--line)" />
        <circle cx="24" cy="24" r="11" fill="var(--wash)" stroke="var(--blue)" strokeWidth="1.4" />
        <path d="M24 15.5 27 24l-3 8.5L21 24Z" fill="var(--blue)" />
        {squint ? (
          <path
            d="M18.5 22.5c1.2 1.2 2.4 1.2 3.6 0M25.9 22.5c1.2 1.2 2.4 1.2 3.6 0"
            fill="none"
            stroke="var(--ink)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        ) : (
          <g
            className={scan ? "mapper-pupils" : undefined}
            style={scan ? undefined : { transform: `translate(${pupils.x}px, ${pupils.y}px)` }}
          >
            <circle cx="20.5" cy="22.5" r="2" fill="var(--ink)" />
            <circle cx="27.5" cy="22.5" r="2" fill="var(--ink)" />
            <circle cx="21.1" cy="21.9" r=".6" fill="#fff" />
            <circle cx="28.1" cy="21.9" r=".6" fill="#fff" />
          </g>
        )}
      </svg>
    </span>
  );
}
