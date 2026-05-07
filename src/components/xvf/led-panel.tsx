import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lightbulb } from "lucide-react";
import type { UseXvfResult } from "@/hooks/use-xvf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = { xvf: UseXvfResult };

// Matches LED_EFFECT values documented in the firmware parameter table.
const MODES = [
  { value: "0", label: "xvf.led.modes.off" },
  { value: "1", label: "xvf.led.modes.breath" },
  { value: "2", label: "xvf.led.modes.rainbow" },
  { value: "3", label: "xvf.led.modes.single" },
  { value: "4", label: "xvf.led.modes.doa" },
  { value: "5", label: "xvf.led.modes.ring" },
];

// LED_COLOR is a single uint32 packed as 0x00RRGGBB.
function unpackColor(v: number): { r: number; g: number; b: number } {
  const n = Math.max(0, Math.min(0xffffff, Math.floor(v)));
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

function packColor(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export function LedPanel({ xvf }: Props) {
  const { t } = useTranslation();
  const { current, read, write } = xvf;
  const [mode, setMode] = useState("0");
  const [brightness, setBrightness] = useState(128);
  const [speed, setSpeed] = useState(64);
  const [r, setR] = useState(0);
  const [g, setG] = useState(128);
  const [b, setB] = useState(255);
  const manualLike = mode === "1" || mode === "3";

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!current) return;
      const [m, br, sp, col] = await Promise.all([
        read("LED_EFFECT"),
        read("LED_BRIGHTNESS"),
        read("LED_SPEED"),
        read("LED_COLOR"),
      ]);
      if (cancelled) return;
      if (m && typeof m.values[0] === "number") setMode(String(Math.round(m.values[0])));
      if (br && typeof br.values[0] === "number") setBrightness(Math.round(br.values[0]));
      if (sp && typeof sp.values[0] === "number") setSpeed(Math.round(sp.values[0]));
      if (col && typeof col.values[0] === "number") {
        const { r: cr, g: cg, b: cb } = unpackColor(col.values[0]);
        setR(cr);
        setG(cg);
        setB(cb);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [current, read]);

  const commitColor = (nr = r, ng = g, nb = b) => {
    void write("LED_COLOR", [packColor(nr, ng, nb)]);
  };

  const disabled = !current;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Lightbulb className="text-primary h-5 w-5" aria-hidden />
          {t("xvf.led.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>{t("xvf.led.mode")}</Label>
            <Select
              value={mode}
              onValueChange={(v) => {
                setMode(v);
                void write("LED_EFFECT", [Number(v)]);
              }}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {t(m.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>{t("xvf.led.brightness")}</Label>
              <span className="text-muted-foreground text-sm tabular-nums">{brightness}</span>
            </div>
            <Slider
              value={[brightness]}
              min={0}
              max={255}
              step={1}
              onValueChange={(v) => setBrightness(v[0] ?? 0)}
              onValueCommit={(v) => void write("LED_BRIGHTNESS", [v[0] ?? 0])}
              disabled={disabled}
            />
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>{t("xvf.led.speed")}</Label>
              <span className="text-muted-foreground text-sm tabular-nums">{speed}</span>
            </div>
            <Slider
              value={[speed]}
              min={0}
              max={255}
              step={1}
              onValueChange={(v) => setSpeed(v[0] ?? 0)}
              onValueCommit={(v) => void write("LED_SPEED", [v[0] ?? 0])}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="flex flex-col items-stretch gap-4 rounded-md border p-4 sm:flex-row sm:items-center">
          <div
            className="mx-auto h-24 w-24 shrink-0 rounded-full border shadow-inner sm:mx-0"
            style={{
              backgroundColor: `rgb(${r}, ${g}, ${b})`,
              opacity: Math.max(0.2, brightness / 255),
            }}
            aria-hidden
          />
          <div className="grid flex-1 gap-3">
            <ColorSlider
              label="R"
              value={r}
              onChange={(v) => {
                setR(v);
                commitColor(v, g, b);
              }}
              disabled={disabled || !manualLike}
            />
            <ColorSlider
              label="G"
              value={g}
              onChange={(v) => {
                setG(v);
                commitColor(r, v, b);
              }}
              disabled={disabled || !manualLike}
            />
            <ColorSlider
              label="B"
              value={b}
              onChange={(v) => {
                setB(v);
                commitColor(r, g, v);
              }}
              disabled={disabled || !manualLike}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { l: t("xvf.led.presets.off"), c: [0, 0, 0] },
            { l: t("xvf.led.presets.red"), c: [255, 0, 0] },
            { l: t("xvf.led.presets.green"), c: [0, 255, 0] },
            { l: t("xvf.led.presets.blue"), c: [0, 128, 255] },
            { l: t("xvf.led.presets.warm"), c: [255, 180, 80] },
            { l: t("xvf.led.presets.white"), c: [255, 255, 255] },
          ].map((p) => (
            <Button
              key={p.l}
              size="sm"
              variant="outline"
              disabled={disabled || !manualLike}
              onClick={() => {
                setR(p.c[0]);
                setG(p.c[1]);
                setB(p.c[2]);
                commitColor(p.c[0], p.c[1], p.c[2]);
              }}
            >
              <span
                className="mr-2 h-3 w-3 rounded-full border"
                style={{ backgroundColor: `rgb(${p.c[0]}, ${p.c[1]}, ${p.c[2]})` }}
                aria-hidden
              />
              {p.l}
            </Button>
          ))}
        </div>
        {!manualLike && (
          <p className="text-muted-foreground text-xs">{t("xvf.led.colorDisabledHint")}</p>
        )}
      </CardContent>
    </Card>
  );
}

function ColorSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-muted-foreground w-5 text-xs font-semibold">{label}</span>
      <Slider
        className="flex-1"
        value={[value]}
        min={0}
        max={255}
        step={1}
        onValueChange={(v) => onChange(v[0] ?? 0)}
        disabled={disabled}
        aria-label={label}
      />
      <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">{value}</span>
    </div>
  );
}
