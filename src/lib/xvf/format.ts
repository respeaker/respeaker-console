// Small set of value formatters used across the dashboard UI.

import type { ParameterInfo, XvfValue } from "./types";

export function formatNumber(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—";
  if (digits <= 0) return Math.round(n).toString();
  return Number(n.toFixed(digits)).toString();
}

export function formatValue(param: ParameterInfo, values: XvfValue[] | null): string {
  if (!values || values.length === 0) return "—";
  if (param.name === "VERSION" && values.every((v) => typeof v === "number")) {
    return values.map((v) => String(v)).join(".");
  }
  if (
    param.name === "LED_COLOR" ||
    param.name === "LED_DOA_COLOR" ||
    param.name === "LED_RING_COLOR"
  ) {
    return values
      .map((v) =>
        typeof v === "number"
          ? `#${Math.max(0, v).toString(16).padStart(6, "0").toUpperCase()}`
          : String(v)
      )
      .join(", ");
  }
  if (param.kind === "radians" && values.every((v) => typeof v === "number")) {
    return values.map((v) => `${radToDeg(v as number).toFixed(1)}°`).join(", ");
  }
  if (param.kind === "float" && values.every((v) => typeof v === "number")) {
    return values.map((v) => Number((v as number).toFixed(4)).toString()).join(", ");
  }
  return values
    .map((v) => (typeof v === "string" ? (v.length > 0 ? v : "—") : String(v)))
    .join(", ");
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function colorToHex(value: number): string {
  const n = Math.max(0, Math.min(0xffffff, Math.round(value)));
  return `#${n.toString(16).padStart(6, "0").toUpperCase()}`;
}

export function hexToNumber(hex: string): number {
  const trimmed = hex.trim().replace(/^#/, "").replace(/^0x/i, "");
  const n = parseInt(trimmed, 16);
  return Number.isFinite(n) ? n : 0;
}
