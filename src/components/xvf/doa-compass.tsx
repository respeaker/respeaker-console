import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface DoaCompassProps {
  angle: number;
  vadActive: boolean;
  className?: string;
}

const CX = 100;
const CY = 100;
const OUTER_R = 88;
const INNER_R = 60;
const INNER_R2 = 32;
const NEEDLE_R = 72;
const TICK_COUNT = 36;

export function DoaCompass({ angle, vadActive, className }: DoaCompassProps) {
  const { t } = useTranslation();
  const normalized = ((angle % 360) + 360) % 360;
  const rad = ((normalized - 90) * Math.PI) / 180;

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
        viewBox="-20 -5 240 210"
        className="h-48 w-48"
        aria-label={`DOA: ${Math.round(normalized)}°`}
      >
        {/* Outer ring */}
        <circle
          cx={CX}
          cy={CY}
          r={OUTER_R}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.75"
          className="text-border"
        />

        {/* Inner concentric rings */}
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

        {/* Tick marks — 36 ticks every 10° */}
        {Array.from({ length: TICK_COUNT }).map((_, i) => {
          const deg = i * 10;
          const isMajor = deg % 90 === 0;
          const isMinor = deg % 30 === 0 && !isMajor;
          const tickRad = ((deg - 90) * Math.PI) / 180;
          const outerEnd = OUTER_R;
          const innerStart = isMajor ? OUTER_R - 8 : isMinor ? OUTER_R - 5 : OUTER_R - 3;
          const sw = isMajor ? 1.2 : isMinor ? 0.7 : 0.4;
          const opacity = isMajor ? "text-muted-foreground" : "text-muted-foreground/40";
          return (
            <line
              key={i}
              x1={CX + innerStart * Math.cos(tickRad)}
              y1={CY + innerStart * Math.sin(tickRad)}
              x2={CX + outerEnd * Math.cos(tickRad)}
              y2={CY + outerEnd * Math.sin(tickRad)}
              stroke="currentColor"
              strokeWidth={sw}
              className={opacity}
            />
          );
        })}

        {/* Cardinal degree labels */}
        <text
          x={CX}
          y={CY - OUTER_R - 5}
          textAnchor="middle"
          className="fill-muted-foreground text-[8px]"
        >
          0°
        </text>
        <text
          x={CX + OUTER_R + 6}
          y={CY + 3}
          textAnchor="start"
          className="fill-muted-foreground text-[8px]"
        >
          90°
        </text>
        <text
          x={CX}
          y={CY + OUTER_R + 11}
          textAnchor="middle"
          className="fill-muted-foreground text-[8px]"
        >
          180°
        </text>
        <text
          x={CX - OUTER_R - 6}
          y={CY + 3}
          textAnchor="end"
          className="fill-muted-foreground text-[8px]"
        >
          270°
        </text>

        {/* Center dot */}
        <circle cx={CX} cy={CY} r="2" className={cn("transition-colors", fillColor)} />

        {/* Needle line */}
        <line
          x1={CX}
          y1={CY}
          x2={nx}
          y2={ny}
          strokeWidth="1.5"
          strokeLinecap="round"
          className={cn("transition-colors", strokeColor)}
        />

        {/* Needle tip */}
        <polygon
          points={`${nx},${ny} ${tx1},${ty1} ${tx2},${ty2}`}
          className={cn("transition-colors", fillColor)}
        />

        {/* VAD indicator dot at bottom-right of compass face */}
        <circle
          cx={CX + 28}
          cy={CY + 28}
          r="3"
          className={cn(
            "transition-colors",
            vadActive ? "fill-green-500" : "fill-muted-foreground/30"
          )}
        />
        <text
          x={CX + 28}
          y={CY + 37}
          textAnchor="middle"
          className="fill-muted-foreground/60 text-[5px] uppercase"
        >
          VAD
        </text>
      </svg>

      {/* Angle readout */}
      <div className="flex flex-col items-center gap-0.5">
        <span
          className={cn(
            "font-mono text-2xl tabular-nums transition-colors",
            vadActive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {Math.round(normalized)}°
        </span>
        <span className="text-muted-foreground/60 text-[10px] font-medium tracking-widest uppercase">
          {t("xvf.monitor.compass")}
        </span>
      </div>
    </div>
  );
}
