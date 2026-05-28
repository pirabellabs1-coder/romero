"use client";
import { useState, useRef, useEffect } from "react";

type Props = {
  /** Image to position. URL only — never null when this widget is shown. */
  src: string;
  /** Current object-position. Accepts named ("center top") or "X% Y%". */
  value: string;
  /** Aspect ratio of the preview frame (matches the public display). */
  ratio?: string;
  /** Called on every move/click. The parent debounces to disk if needed. */
  onChange: (next: string) => void;
};

/**
 * Granular focal-point picker.
 *
 * The photographer clicks (or drags) anywhere on the image to set which
 * point should be kept visible when the image is cropped to its display
 * frame. The marker shows where the focal point is; the preview is the
 * same `object-position` + `object-fit: cover` combination the public
 * site uses, so what she sees here is exactly what visitors will see.
 *
 * Output is a "X% Y%" pair (with one decimal of precision), which the
 * server stores in cover_position and the public pages pass to img
 * style.objectPosition.
 */
export default function FocalPointPicker({ src, value, ratio = "4 / 3", onChange }: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(parsePosition(value));
  const draggingRef = useRef(false);

  // Sync local state with prop changes (e.g. after a different image is picked).
  useEffect(() => {
    setPos(parsePosition(value));
  }, [value]);

  function pickFromEvent(e: { clientX: number; clientY: number }) {
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const xClamped = Math.max(0, Math.min(100, x));
    const yClamped = Math.max(0, Math.min(100, y));
    const next = { x: round1(xClamped), y: round1(yClamped) };
    setPos(next);
    onChange(`${next.x}% ${next.y}%`);
  }

  return (
    <div className="focal-picker">
      <div
        ref={frameRef}
        className="focal-picker__frame"
        style={{ aspectRatio: ratio }}
        onMouseDown={(e) => {
          draggingRef.current = true;
          pickFromEvent(e);
        }}
        onMouseMove={(e) => {
          if (draggingRef.current) pickFromEvent(e);
        }}
        onMouseUp={() => { draggingRef.current = false; }}
        onMouseLeave={() => { draggingRef.current = false; }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          if (t) pickFromEvent({ clientX: t.clientX, clientY: t.clientY });
        }}
        onTouchMove={(e) => {
          const t = e.touches[0];
          if (t) {
            e.preventDefault();
            pickFromEvent({ clientX: t.clientX, clientY: t.clientY });
          }
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Sélection du cadrage"
          draggable={false}
          style={{
            width: "100%", height: "100%",
            objectFit: "cover",
            objectPosition: `${pos.x}% ${pos.y}%`,
            userSelect: "none",
            pointerEvents: "none",
          }}
        />
        <span
          className="focal-picker__marker"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
          aria-hidden
        />
      </div>
      <div className="focal-picker__readout">
        <span>{Math.round(pos.x)}% × {Math.round(pos.y)}%</span>
        <button type="button" className="focal-picker__reset" onClick={() => {
          setPos({ x: 50, y: 50 });
          onChange("50% 50%");
        }}>
          Recentrer
        </button>
      </div>
    </div>
  );
}

function parsePosition(v: string): { x: number; y: number } {
  // Named positions → percentages
  const named: Record<string, { x: number; y: number }> = {
    "left top":      { x: 0,   y: 0 },
    "center top":    { x: 50,  y: 0 },
    "right top":     { x: 100, y: 0 },
    "left center":   { x: 0,   y: 50 },
    "center center": { x: 50,  y: 50 },
    "right center":  { x: 100, y: 50 },
    "left bottom":   { x: 0,   y: 100 },
    "center bottom": { x: 50,  y: 100 },
    "right bottom":  { x: 100, y: 100 },
  };
  const s = (v || "").trim().toLowerCase();
  if (named[s]) return named[s];
  const m = s.match(/^(-?\d{1,3}(?:\.\d+)?)%\s+(-?\d{1,3}(?:\.\d+)?)%$/);
  if (m) {
    return { x: clamp(parseFloat(m[1])), y: clamp(parseFloat(m[2])) };
  }
  return { x: 50, y: 50 };
}

function clamp(n: number): number {
  if (Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
