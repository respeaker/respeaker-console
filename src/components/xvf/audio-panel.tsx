import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gauge, MicOff, SlidersHorizontal, Sparkles, Volume2, Waves } from "lucide-react";

import type { UseXvfResult } from "@/hooks/use-xvf";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatNumber } from "@/lib/xvf/format";
import type { ParameterInfo, XvfValue } from "@/lib/xvf/types";

type Props = { xvf: UseXvfResult };

type NumericKind = "float" | "int";

type NumericControlDef = {
  kind: "numeric";
  name: string;
  labelKey: string;
  groupKey: string;
  min: number;
  max: number;
  step: number;
  digits: number;
  valueKind: NumericKind;
  unit?: string;
};

type ToggleControlDef = {
  kind: "toggle";
  name: string;
  labelKey: string;
  groupKey: string;
};

type AudioControlDef = NumericControlDef | ToggleControlDef;

type ControlState = Record<string, number>;

const CONTROL_DEFS: AudioControlDef[] = [
  {
    kind: "numeric",
    name: "AUDIO_MGR_MIC_GAIN",
    labelKey: "xvf.audio.micGain",
    groupKey: "xvf.audio.groups.gain",
    min: 0,
    max: 10,
    step: 0.05,
    digits: 2,
    valueKind: "float",
    unit: "x",
  },
  {
    kind: "numeric",
    name: "AUDIO_MGR_REF_GAIN",
    labelKey: "xvf.audio.refGain",
    groupKey: "xvf.audio.groups.gain",
    min: 0,
    max: 10,
    step: 0.05,
    digits: 2,
    valueKind: "float",
    unit: "x",
  },
  {
    kind: "numeric",
    name: "PP_AGCDESIREDLEVEL",
    labelKey: "xvf.audio.agcTarget",
    groupKey: "xvf.audio.groups.gain",
    min: 0.001,
    max: 1,
    step: 0.001,
    digits: 4,
    valueKind: "float",
  },
  {
    kind: "numeric",
    name: "PP_AGCMAXGAIN",
    labelKey: "xvf.audio.agcMaxGain",
    groupKey: "xvf.audio.groups.gain",
    min: 1,
    max: 1000,
    step: 1,
    digits: 0,
    valueKind: "float",
    unit: "x",
  },
  {
    kind: "numeric",
    name: "PP_MGSCALE",
    labelKey: "xvf.audio.mgScale",
    groupKey: "xvf.audio.groups.gain",
    min: 0,
    max: 4,
    step: 0.01,
    digits: 2,
    valueKind: "float",
  },
  {
    kind: "numeric",
    name: "PP_MIN_NN",
    labelKey: "xvf.audio.minNn",
    groupKey: "xvf.audio.groups.noiseSuppression",
    min: 0,
    max: 1,
    step: 0.01,
    digits: 2,
    valueKind: "float",
  },
  {
    kind: "numeric",
    name: "PP_MIN_NS",
    labelKey: "xvf.audio.minNs",
    groupKey: "xvf.audio.groups.noiseSuppression",
    min: 0,
    max: 1,
    step: 0.01,
    digits: 2,
    valueKind: "float",
  },
  {
    kind: "toggle",
    name: "PP_NLATTENONOFF",
    labelKey: "xvf.audio.nlAtten",
    groupKey: "xvf.audio.groups.noiseSuppression",
  },
  {
    kind: "numeric",
    name: "PP_DTSENSITIVE",
    labelKey: "xvf.audio.dtSensitive",
    groupKey: "xvf.audio.groups.detection",
    min: 0,
    max: 10,
    step: 1,
    digits: 0,
    valueKind: "int",
  },
  {
    kind: "numeric",
    name: "PP_FMIN_SPEINDEX",
    labelKey: "xvf.audio.fminSpeindex",
    groupKey: "xvf.audio.groups.detection",
    min: 0,
    max: 8000,
    step: 10,
    digits: 0,
    valueKind: "float",
    unit: "Hz",
  },
  {
    kind: "numeric",
    name: "AUDIO_MGR_OP_L",
    labelKey: "xvf.audio.outputLeft",
    groupKey: "xvf.audio.groups.output",
    min: 0,
    max: 255,
    step: 1,
    digits: 0,
    valueKind: "int",
  },
  {
    kind: "numeric",
    name: "AUDIO_MGR_OP_R",
    labelKey: "xvf.audio.outputRight",
    groupKey: "xvf.audio.groups.output",
    min: 0,
    max: 255,
    step: 1,
    digits: 0,
    valueKind: "int",
  },
  {
    kind: "toggle",
    name: "SHF_BYPASS",
    labelKey: "xvf.audio.aecBypass",
    groupKey: "xvf.audio.groups.detection",
  },
  {
    kind: "toggle",
    name: "PP_AGCONOFF",
    labelKey: "xvf.audio.agcOn",
    groupKey: "xvf.audio.groups.gain",
  },
  {
    kind: "toggle",
    name: "PP_ECHOONOFF",
    labelKey: "xvf.audio.echoOn",
    groupKey: "xvf.audio.groups.noiseSuppression",
  },
  {
    kind: "toggle",
    name: "PP_LIMITONOFF",
    labelKey: "xvf.audio.limiterOn",
    groupKey: "xvf.audio.groups.output",
  },
];

const GROUPS = [
  { key: "xvf.audio.groups.noiseSuppression", icon: Waves },
  { key: "xvf.audio.groups.gain", icon: Gauge },
  { key: "xvf.audio.groups.detection", icon: Sparkles },
  { key: "xvf.audio.groups.output", icon: Volume2 },
] as const;

export function AudioPanel({ xvf }: Props) {
  const { t } = useTranslation();
  const { current, commands, readMany, write } = xvf;
  const [values, setValues] = useState<ControlState>({});
  const [ready, setReady] = useState(false);

  const availableControls = useMemo(() => {
    const writable = new Map(
      commands.filter((param) => param.access === "rw").map((param) => [param.name, param])
    );
    return CONTROL_DEFS.flatMap((def) => {
      const param = writable.get(def.name);
      if (!param) return [];
      return [{ def, param }];
    });
  }, [commands]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!current || availableControls.length === 0) {
        setReady(false);
        return;
      }
      setReady(false);
      const results = await readMany(availableControls.map(({ def }) => def.name));
      if (cancelled) return;
      const next: ControlState = {};
      for (const { def } of availableControls) {
        const value = resultNumber(results[def.name]?.values);
        if (value != null) next[def.name] = value;
      }
      setValues(next);
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [availableControls, current, readMany]);

  const disabled = !current || !ready;

  const writeValue = async (def: AudioControlDef, param: ParameterInfo, value: number) => {
    const normalized = def.kind === "numeric" ? normalizeValue(def, value) : value > 0.5 ? 1 : 0;
    setValues((prev) => ({ ...prev, [def.name]: normalized }));
    await write(def.name, valuesForParam(param, normalized));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <SlidersHorizontal className="text-primary h-5 w-5" aria-hidden />
          {t("xvf.audio.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-2">
        {GROUPS.map((group) => {
          const controls = availableControls.filter(({ def }) => def.groupKey === group.key);
          if (controls.length === 0) return null;
          const Icon = group.icon;
          return (
            <section key={group.key} className="rounded-lg border p-4">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-medium">
                <Icon className="text-muted-foreground h-4 w-4" aria-hidden />
                {t(group.key)}
              </h3>
              <div className="flex flex-col gap-5">
                {controls.map(({ def, param }) =>
                  def.kind === "toggle" ? (
                    <ToggleControl
                      key={def.name}
                      id={def.name}
                      label={t(def.labelKey)}
                      checked={(values[def.name] ?? 0) > 0.5}
                      onChange={(checked) => void writeValue(def, param, checked ? 1 : 0)}
                      disabled={disabled}
                    />
                  ) : (
                    <NumericControl
                      key={def.name}
                      def={def}
                      label={t(def.labelKey)}
                      value={values[def.name] ?? def.min}
                      disabled={disabled}
                      onChange={(value) =>
                        setValues((prev) => ({ ...prev, [def.name]: normalizeValue(def, value) }))
                      }
                      onCommit={(value) => void writeValue(def, param, value)}
                    />
                  )
                )}
              </div>
            </section>
          );
        })}
      </CardContent>
    </Card>
  );
}

function NumericControl({
  def,
  label,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  def: NumericControlDef;
  label: string;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
}) {
  const displayValue = normalizeValue(def, value);
  const formatted = `${formatNumber(displayValue, def.digits)}${def.unit ?? ""}`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={def.name} className="text-sm">
          {label}
        </Label>
        <Badge variant="outline" className="tabular-nums">
          {formatted}
        </Badge>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3">
        <Slider
          id={def.name}
          value={[displayValue]}
          min={def.min}
          max={def.max}
          step={def.step}
          onValueChange={(next) => onChange(next[0] ?? def.min)}
          onValueCommit={(next) => onCommit(next[0] ?? def.min)}
          disabled={disabled}
          aria-label={label}
        />
        <Input
          type="number"
          value={String(displayValue)}
          min={def.min}
          max={def.max}
          step={def.step}
          onChange={(event) => onChange(Number(event.target.value))}
          onBlur={(event) => onCommit(Number(event.target.value))}
          disabled={disabled}
          aria-label={label}
          className="h-8 text-right tabular-nums"
        />
      </div>
    </div>
  );
}

function ToggleControl({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <Label htmlFor={id} className="flex items-center gap-2">
        <MicOff className="text-muted-foreground h-4 w-4" aria-hidden />
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

function resultNumber(values?: XvfValue[]): number | null {
  const value = values?.[0];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeValue(def: NumericControlDef, value: number): number {
  if (!Number.isFinite(value)) return def.min;
  const clamped = Math.min(def.max, Math.max(def.min, value));
  return def.valueKind === "int" ? Math.round(clamped) : clamped;
}

function valuesForParam(param: ParameterInfo, value: number): XvfValue[] {
  return Array.from({ length: param.length }, () => value);
}
