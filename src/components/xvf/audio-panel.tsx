import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Gauge, MicOff, SlidersHorizontal, Sparkles, Volume2, Waves } from "lucide-react";

import type { UseXvfResult } from "@/hooks/use-xvf";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type RouteControlDef = {
  kind: "route";
  name: "AUDIO_MGR_OP_L" | "AUDIO_MGR_OP_R";
  labelKey: string;
  groupKey: string;
};

type AudioControlDef = NumericControlDef | ToggleControlDef | RouteControlDef;

type ControlState = Record<string, XvfValue[]>;

type OutputRouteCategory = {
  id: number;
  labelKey: string;
  sources: number[];
};

const OUTPUT_ROUTE_CATEGORIES: OutputRouteCategory[] = [
  { id: 0, labelKey: "xvf.audio.outputCategories.0", sources: [0] },
  { id: 1, labelKey: "xvf.audio.outputCategories.1", sources: [0, 1, 2, 3] },
  { id: 2, labelKey: "xvf.audio.outputCategories.2", sources: [0, 1, 2, 3] },
  { id: 3, labelKey: "xvf.audio.outputCategories.3", sources: [0, 1, 2, 3] },
  { id: 4, labelKey: "xvf.audio.outputCategories.4", sources: [0] },
  { id: 5, labelKey: "xvf.audio.outputCategories.5", sources: [0] },
  { id: 6, labelKey: "xvf.audio.outputCategories.6", sources: [0, 1, 2, 3] },
  { id: 7, labelKey: "xvf.audio.outputCategories.7", sources: [0, 1, 2, 3] },
  { id: 8, labelKey: "xvf.audio.outputCategories.8", sources: [0, 1] },
  { id: 9, labelKey: "xvf.audio.outputCategories.9", sources: [0, 1, 2, 3] },
  { id: 10, labelKey: "xvf.audio.outputCategories.10", sources: [0, 1, 2, 3, 4, 5] },
  { id: 11, labelKey: "xvf.audio.outputCategories.11", sources: [0, 1, 2, 3] },
  { id: 12, labelKey: "xvf.audio.outputCategories.12", sources: [0] },
];

const CONTROL_DEFS: AudioControlDef[] = [
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
    max: 15,
    step: 1,
    digits: 0,
    valueKind: "int",
  },
  {
    kind: "route",
    name: "AUDIO_MGR_OP_L",
    labelKey: "xvf.audio.outputLeft",
    groupKey: "xvf.audio.groups.output",
  },
  {
    kind: "route",
    name: "AUDIO_MGR_OP_R",
    labelKey: "xvf.audio.outputRight",
    groupKey: "xvf.audio.groups.output",
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
        const result = results[def.name];
        if (result) next[def.name] = result.values;
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
    const nextValues = valuesForParam(param, normalized);
    setValues((prev) => ({ ...prev, [def.name]: nextValues }));
    await write(def.name, nextValues);
  };

  const writeRoute = async (def: RouteControlDef, values: XvfValue[]) => {
    setValues((prev) => ({ ...prev, [def.name]: values }));
    await write(def.name, values);
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
                      checked={(resultNumber(values[def.name]) ?? 0) > 0.5}
                      onChange={(checked) => void writeValue(def, param, checked ? 1 : 0)}
                      disabled={disabled}
                    />
                  ) : def.kind === "route" ? (
                    <RouteControl
                      key={def.name}
                      def={def}
                      label={t(def.labelKey)}
                      value={values[def.name] ?? [0, 0]}
                      disabled={disabled}
                      t={t}
                      onCommit={(nextValues) => void writeRoute(def, nextValues)}
                    />
                  ) : (
                    <NumericControl
                      key={def.name}
                      def={def}
                      label={t(def.labelKey)}
                      value={resultNumber(values[def.name]) ?? def.min}
                      disabled={disabled}
                      onChange={(value) =>
                        setValues((prev) => ({
                          ...prev,
                          [def.name]: [normalizeValue(def, value)],
                        }))
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

function RouteControl({
  def,
  label,
  value,
  disabled,
  t,
  onCommit,
}: {
  def: RouteControlDef;
  label: string;
  value: XvfValue[];
  disabled: boolean;
  t: (key: string) => string;
  onCommit: (values: XvfValue[]) => void;
}) {
  const category = numericAt(value, 0) ?? 0;
  const categoryDef = OUTPUT_ROUTE_CATEGORIES.find((item) => item.id === category);
  const effectiveCategory = categoryDef ?? OUTPUT_ROUTE_CATEGORIES[0];
  const source = numericAt(value, 1) ?? effectiveCategory.sources[0] ?? 0;
  const effectiveSource = effectiveCategory.sources.includes(source)
    ? source
    : (effectiveCategory.sources[0] ?? 0);

  const commitCategory = (nextCategory: number) => {
    const nextCategoryDef =
      OUTPUT_ROUTE_CATEGORIES.find((item) => item.id === nextCategory) ??
      OUTPUT_ROUTE_CATEGORIES[0];
    onCommit([nextCategoryDef.id, nextCategoryDef.sources[0] ?? 0]);
  };

  const commitSource = (nextSource: number) => {
    onCommit([effectiveCategory.id, nextSource]);
  };

  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={`${def.name}-category`} className="text-sm">
          {label}
        </Label>
        <Badge variant="outline" className="tabular-nums">
          [{effectiveCategory.id}, {effectiveSource}]
        </Badge>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${def.name}-category`} className="text-muted-foreground text-xs">
            {t("xvf.audio.outputRoute.category")}
          </Label>
          <Select
            value={String(effectiveCategory.id)}
            onValueChange={(next) => commitCategory(Number(next))}
            disabled={disabled}
          >
            <SelectTrigger id={`${def.name}-category`} className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTPUT_ROUTE_CATEGORIES.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.id}: {t(item.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${def.name}-source`} className="text-muted-foreground text-xs">
            {t("xvf.audio.outputRoute.source")}
          </Label>
          <Select
            value={String(effectiveSource)}
            onValueChange={(next) => commitSource(Number(next))}
            disabled={disabled}
          >
            <SelectTrigger id={`${def.name}-source`} className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {effectiveCategory.sources.map((item) => (
                <SelectItem key={item} value={String(item)}>
                  {item}: {sourceLabel(effectiveCategory.id, item, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function resultNumber(values?: XvfValue[]): number | null {
  const value = values?.[0];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numericAt(values: XvfValue[], index: number): number | null {
  const value = values[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sourceLabel(category: number, source: number, t: (key: string) => string): string {
  if (category === 6 && source === 3) return t("xvf.audio.outputRoute.autoSelectBeam");
  if (category === 8) return t("xvf.audio.outputRoute.userChannel");
  return t("xvf.audio.outputRoute.sourceIndex");
}

function normalizeValue(def: NumericControlDef, value: number): number {
  if (!Number.isFinite(value)) return def.min;
  const clamped = Math.min(def.max, Math.max(def.min, value));
  return def.valueKind === "int" ? Math.round(clamped) : clamped;
}

function valuesForParam(param: ParameterInfo, value: number): XvfValue[] {
  return Array.from({ length: param.length }, () => value);
}
