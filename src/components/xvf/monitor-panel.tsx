import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Activity, Pause, Play } from "lucide-react";
import type { UseXvfResult } from "@/hooks/use-xvf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber } from "@/lib/xvf/format";
import { DoaCompass } from "@/components/xvf/doa-compass";

type Props = { xvf: UseXvfResult };

const RATES = [
  { label: "5 Hz", value: "200" },
  { label: "10 Hz", value: "100" },
  { label: "20 Hz", value: "50" },
  { label: "30 Hz", value: "33" },
];

type Sample = {
  t: number;
  doaAngle: number;
  vad: number;
  rt60: number;
  energy: number[]; // per-beam speech energy (up to 4 beams)
};

const MAX_SAMPLES = 240;

export function MonitorPanel({ xvf }: Props) {
  const { t } = useTranslation();
  const { current, readMany } = xvf;
  const [running, setRunning] = useState(true);
  const [intervalMs, setIntervalMs] = useState(100);
  const [latest, setLatest] = useState<Sample | null>(null);
  const [converged, setConverged] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const samplesRef = useRef<Sample[]>([]);

  useEffect(() => {
    if (!current || !running) return;
    let alive = true;
    let timer: number | undefined;
    const tick = async () => {
      const out = await readMany([
        "DOA_VALUE",
        "AEC_RT60",
        "AEC_SPENERGY_VALUES",
        "AEC_AECCONVERGED",
      ]);
      if (!alive) return;
      const doaValues = out.DOA_VALUE?.values ?? [];
      const rt60Values = out.AEC_RT60?.values ?? [];
      const energyValues = out.AEC_SPENERGY_VALUES?.values ?? [];
      const conv = out.AEC_AECCONVERGED?.values?.[0];

      const sample: Sample = {
        t: Date.now(),
        doaAngle: Number(doaValues[0] ?? 0),
        vad: Number(doaValues[1] ?? 0),
        rt60: Number(rt60Values[0] ?? 0),
        energy: energyValues.map((v) => Number(v)),
      };
      samplesRef.current = [...samplesRef.current.slice(-(MAX_SAMPLES - 1)), sample];
      setLatest(sample);
      setConverged(typeof conv === "number" ? conv : null);
      drawChart();
      if (alive) timer = window.setTimeout(() => void tick(), intervalMs);
    };
    void tick();
    return () => {
      alive = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [current, running, intervalMs, readMany]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Grid
    ctx.strokeStyle = "rgba(148, 163, 184, 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    const rows = 4;
    for (let i = 0; i <= rows; i++) {
      const y = (rect.height / rows) * i;
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
    }
    ctx.stroke();

    const samples = samplesRef.current;
    if (samples.length < 2) return;

    const drawSeries = (pick: (s: Sample) => number, color: string, min: number, max: number) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.75;
      samples.forEach((s, i) => {
        const x = (i / (samples.length - 1)) * rect.width;
        const v = Math.min(max, Math.max(min, pick(s)));
        const norm = (v - min) / (max - min || 1);
        const y = rect.height - norm * rect.height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    // Max energy over beams, normalized for display.
    drawSeries((s) => Math.max(0, ...(s.energy.length ? s.energy : [0])), "#0ea5e9", 0, 1);
    // VAD as a step at top.
    drawSeries((s) => s.vad, "#22c55e", 0, 1);
  };

  const hasEnergy = latest && latest.energy.length > 0;
  const peakEnergy = hasEnergy ? Math.max(...latest!.energy) : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="text-primary h-5 w-5" aria-hidden />
          {t("xvf.monitor.title")}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="rate" className="text-muted-foreground text-xs">
            {t("xvf.monitor.rate")}
          </Label>
          <Select value={String(intervalMs)} onValueChange={(v) => setIntervalMs(Number(v))}>
            <SelectTrigger id="rate" className="h-8 w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RATES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRunning((r) => !r)}
            disabled={!current}
          >
            {running ? (
              <Pause className="mr-2 h-4 w-4" aria-hidden />
            ) : (
              <Play className="mr-2 h-4 w-4" aria-hidden />
            )}
            {running ? t("xvf.monitor.pause") : t("xvf.monitor.resume")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {latest && (
          <div className="flex justify-center border-b pb-6">
            <DoaCompass angle={latest.doaAngle} vadActive={latest.vad > 0.5} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatCard
            label={t("xvf.monitor.doa")}
            value={latest ? `${formatNumber(latest.doaAngle, 0)}°` : "—"}
          />
          <StatCard
            label={t("xvf.monitor.vad")}
            value={
              latest
                ? latest.vad > 0.5
                  ? t("xvf.monitor.vadActive")
                  : t("xvf.monitor.vadIdle")
                : "—"
            }
            accent={latest?.vad ? (latest.vad > 0.5 ? "primary" : undefined) : undefined}
          />
          <StatCard
            label={t("xvf.monitor.rt60")}
            value={
              latest
                ? latest.rt60 < 0
                  ? t("xvf.monitor.invalid")
                  : `${formatNumber(latest.rt60, 2)} s`
                : "—"
            }
          />
          <StatCard
            label={t("xvf.monitor.converged")}
            value={
              converged == null ? "—" : converged > 0.5 ? t("xvf.monitor.yes") : t("xvf.monitor.no")
            }
            accent={converged && converged > 0.5 ? "primary" : undefined}
          />
        </div>

        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1">
            <span className="bg-primary h-2 w-2 rounded-full" aria-hidden />
            {t("xvf.monitor.beamEnergy")}
            {hasEnergy && <span className="ml-1 tabular-nums">{formatNumber(peakEnergy, 2)}</span>}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden />
            {t("xvf.monitor.vad")}
          </Badge>
        </div>

        <div className="bg-card relative h-48 rounded-md border">
          <canvas ref={canvasRef} className="h-full w-full" aria-label="waveform" />
        </div>

        <div className="grid grid-cols-4 gap-2 text-xs">
          {(latest?.energy ?? []).map((v, i) => (
            <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
              <span className="text-muted-foreground">
                {t("xvf.monitor.beam")} {i}
              </span>
              <div className="bg-muted relative ml-auto h-1.5 w-20 overflow-hidden rounded-full">
                <div
                  className="bg-primary absolute inset-y-0 left-0"
                  style={{ width: `${Math.min(100, Math.max(0, v * 100))}%` }}
                />
              </div>
              <span className="w-10 text-right tabular-nums">{formatNumber(v, 2)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: "primary" }) {
  return (
    <div className="border p-3">
      <div className="text-muted-foreground/60 text-[10px] font-medium tracking-widest uppercase">
        {label}
      </div>
      <div
        className={`mt-1.5 font-mono text-lg tabular-nums ${accent === "primary" ? "text-foreground" : "text-muted-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}
