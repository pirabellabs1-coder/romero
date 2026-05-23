"use client";
import { useEffect, useRef } from "react";

type Props = {
  action: () => Promise<void>;
};

export default function MarkReadOnView({ action }: Props) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    action().catch(() => {});
  }, [action]);
  return null;
}
