"use client";
import { useState } from "react";

type Props = {
  name: string;
  defaultValue: number | string;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  label: string;
};

export default function LiveSlider({ name, defaultValue, min, max, step = 1, unit = "", label }: Props) {
  const [value, setValue] = useState(String(defaultValue));
  return (
    <div>
      <label className="admin-label" style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span style={{ color: "var(--gold)", fontWeight: 600 }}>{value}{unit}</span>
      </label>
      <input
        className="admin-input"
        type="range"
        name={name}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ padding: 0, height: 32 }}
      />
    </div>
  );
}
