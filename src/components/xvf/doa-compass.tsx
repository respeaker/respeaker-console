import { memo } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import type { XvfArrayType } from "@/hooks/use-xvf";

interface DoaCompassProps {
  angle: number;
  vadActive: boolean;
  mode?: XvfArrayType;
  className?: string;
}

const CX = 100;
const CY = 100;
const OUTER_R = 88;
const INNER_R = 60;
const INNER_R2 = 32;
const NEEDLE_R = 72;
const TICK_COUNT = 36;

function DoaCompassComponent({ angle, vadActive, mode = "circular", className }: DoaCompassProps) {
  const { t } = useTranslation();
  const displayAngle = mode === "linear" ? clampLinearAngle(angle) : normalizeCircularAngle(angle);
  const rad = angleToRad(displayAngle, mode);

  const nx = CX + NEEDLE_R * Math.cos(rad);
  const ny = CY + NEEDLE_R * Math.sin(rad);
  const tipLen = 6;
  const tipSpread = Math.PI / 7;
  const tx1 = nx - tipLen * Math.cos(rad - tipSpread);
  const ty1 = ny - tipLen * Math.sin(rad - tipSpread);
  const tx2 = nx - tipLen * Math.cos(rad + tipSpread);
  const ty2 = ny - tipLen * Math.sin(rad + tipSpread);

  const strokeColor = vadActive ? "stroke-green-500" : "stroke-muted-foreground/60";
  const fillColor = vadActive ? "fill-green-500" : "fill-muted-foreground/60";

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <svg
        viewBox={mode === "linear" ? "-20 0 240 125" : "-20 -5 240 210"}
        className={cn("w-48", mode === "linear" ? "h-32" : "h-48")}
        aria-label={`DOA: ${Math.round(displayAngle)}°`}
      >
        {mode === "linear" ? <LinearFace /> : <CircularFace />}

        <circle cx={CX} cy={CY} r="2" className={cn("transition-colors", fillColor)} />

        <line
          x1={CX}
          y1={CY}
          x2={nx}
          y2={ny}
          strokeWidth="1.5"
          strokeLinecap="round"
          className={cn("transition-colors", strokeColor)}
        />

        <polygon
          points={`${nx},${ny} ${tx1},${ty1} ${tx2},${ty2}`}
          className={cn("transition-colors", fillColor)}
        />

        <circle
          cx={CX + 28}
          cy={CY + (mode === "linear" ? -18 : 28)}
          r="3"
          className={cn(
            "transition-colors",
            vadActive ? "fill-green-500" : "fill-muted-foreground/30"
          )}
        />
        <text
          x={CX + 28}
          y={CY + (mode === "linear" ? -9 : 37)}
          textAnchor="middle"
          className="fill-muted-foreground/60 text-[5px] uppercase"
        >
          VAD
        </text>
      </svg>

      <div className="flex flex-col items-center gap-0.5">
        <span
          className={cn(
            "font-mono text-2xl tabular-nums transition-colors",
            vadActive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {Math.round(displayAngle)}°
        </span>
        <span className="text-muted-foreground/60 text-[10px] font-medium tracking-widest uppercase">
          {t("xvf.monitor.compass")}
        </span>
      </div>
    </div>
  );
}

function CircularFace() {
  return (
    <>
      <circle
        cx={CX}
        cy={CY}
        r={OUTER_R}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        className="text-border"
      />
      <circle
        cx={CX}
        cy={CY}
        r={INNER_R}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
        className="text-border/40"
        strokeDasharray="1.5 3"
      />
      <circle
        cx={CX}
        cy={CY}
        r={INNER_R2}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
        className="text-border/30"
        strokeDasharray="1 2.5"
      />

      {Array.from({ length: TICK_COUNT }).map((_, i) => {
        const deg = i * 10;
        const isMajor = deg % 90 === 0;
        const isMinor = deg % 30 === 0 && !isMajor;
        const tickRad = ((deg - 90) * Math.PI) / 180;
        const innerStart = isMajor ? OUTER_R - 8 : isMinor ? OUTER_R - 5 : OUTER_R - 3;
        const sw = isMajor ? 1.2 : isMinor ? 0.7 : 0.4;
        const opacity = isMajor ? "text-muted-foreground" : "text-muted-foreground/40";
        return (
          <line
            key={i}
            x1={CX + innerStart * Math.cos(tickRad)}
            y1={CY + innerStart * Math.sin(tickRad)}
            x2={CX + OUTER_R * Math.cos(tickRad)}
            y2={CY + OUTER_R * Math.sin(tickRad)}
            stroke="currentColor"
            strokeWidth={sw}
            className={opacity}
          />
        );
      })}

      <DegreeLabel x={CX} y={CY - OUTER_R - 5} anchor="middle" text="0°" />
      <DegreeLabel x={CX + OUTER_R + 6} y={CY + 3} anchor="start" text="90°" />
      <DegreeLabel x={CX} y={CY + OUTER_R + 11} anchor="middle" text="180°" />
      <DegreeLabel x={CX - OUTER_R - 6} y={CY + 3} anchor="end" text="270°" />
    </>
  );
}

function LinearFace() {
  return (
    <>
      <path
        d={semicirclePath(OUTER_R)}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        className="text-border"
      />
      <path
        d={semicirclePath(INNER_R)}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
        className="text-border/40"
        strokeDasharray="1.5 3"
      />
      <path
        d={semicirclePath(INNER_R2)}
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
        className="text-border/30"
        strokeDasharray="1 2.5"
      />
      <line
        x1={CX - OUTER_R}
        y1={CY}
        x2={CX + OUTER_R}
        y2={CY}
        stroke="currentColor"
        strokeWidth="0.75"
        className="text-border"
      />

      {Array.from({ length: 19 }).map((_, i) => {
        const deg = i * 10;
        const isMajor = deg % 45 === 0 || deg === 0 || deg === 180;
        const rad = angleToRad(deg, "linear");
        const innerStart = isMajor ? OUTER_R - 8 : OUTER_R - 4;
        return (
          <line
            key={deg}
            x1={CX + innerStart * Math.cos(rad)}
            y1={CY + innerStart * Math.sin(rad)}
            x2={CX + OUTER_R * Math.cos(rad)}
            y2={CY + OUTER_R * Math.sin(rad)}
            stroke="currentColor"
            strokeWidth={isMajor ? 1.1 : 0.45}
            className={isMajor ? "text-muted-foreground" : "text-muted-foreground/40"}
          />
        );
      })}

      {[0, 45, 90, 135, 180].map((deg) => {
        const rad = angleToRad(deg, "linear");
        return (
          <DegreeLabel
            key={deg}
            x={CX + (OUTER_R + 11) * Math.cos(rad)}
            y={CY + (OUTER_R + 11) * Math.sin(rad) + 3}
            anchor="middle"
            text={`${deg}°`}
          />
        );
      })}
    </>
  );
}

function DegreeLabel({
  x,
  y,
  anchor,
  text,
}: {
  x: number;
  y: number;
  anchor: "start" | "middle" | "end";
  text: string;
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} className="fill-muted-foreground text-[8px]">
      {text}
    </text>
  );
}

function normalizeCircularAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

function clampLinearAngle(angle: number): number {
  return Math.min(180, Math.max(0, angle));
}

function angleToRad(angle: number, mode: XvfArrayType): number {
  if (mode === "linear") {
    return ((180 - angle) * Math.PI) / 180;
  }
  return ((normalizeCircularAngle(angle) - 90) * Math.PI) / 180;
}

function semicirclePath(radius: number): string {
  return `M ${CX - radius} ${CY} A ${radius} ${radius} 0 0 1 ${CX + radius} ${CY}`;
}

export const DoaCompass = memo(DoaCompassComponent);
