"use client";
import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  delay?: number;
  children: ReactNode;
  style?: React.CSSProperties;
};

export default function Rise({ delay = 0, children, style }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setTimeout(() => el.classList.add("in"), delay);
            io.disconnect();
          }
        });
      },
      { threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className="rise" style={style}>
      {children}
    </div>
  );
}
