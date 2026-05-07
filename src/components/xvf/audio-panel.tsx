import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Volume2, MicOff, Gauge, ShieldCheck } from "lucide-react";
import type { UseXvfResult } from "@/hooks/use-xvf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/xvf/format";

type Props = { xvf: UseXvfResult };

// Maps UI widgets to the real XVF3800 parameter names defined in
// src-tauri/src/xvf/parameters.rs. Adjust the min/max ranges here if the
// firmware evolves, not in the Rust layer.
export function AudioPanel({ xvf }: Props) {
  const { t } = useTranslation();
  const { current, read, write } = xvf;

  const [micGain, setMicGain] = useState(1.0);
  const [refGain, setRefGain] = useState(1.0);
  const [shfBypass, setShfBypass] = useState(false); // 1 = bypass AEC
  const [agcOn, setAgcOn] = useState(true);
  const [echoOn, setEchoOn] = useState(true);
  const [limitOn, setLimitOn] = useState(true);
  const [agcTarget, setAgcTarget] = useState(0.1);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!current) return;
      setReady(false);
      const [mg, rg, shf, agc, echo, lim, tgt] = await Promise.all([
        read("AUDIO_MGR_MIC_GAIN"),
        read("AUDIO_MGR_REF_GAIN"),
        read("SHF_BYPASS"),
        read("PP_AGCONOFF"),
        read("PP_ECHOONOFF"),
        read("PP_LIMITONOFF"),
        read("PP_AGCDESIREDLEVEL"),
      ]);
      if (cancelled) return;
      if (mg && typeof mg.values[0] === "number") setMicGain(mg.values[0]);
      if (rg && typeof rg.values[0] === "number") setRefGain(rg.values[0]);
      if (shf && typeof shf.values[0] === "number") setShfBypass(shf.values[0] > 0.5);
      if (agc && typeof agc.values[0] === "number") setAgcOn(agc.values[0] > 0.5);
      if (echo && typeof echo.values[0] === "number") setEchoOn(echo.values[0] > 0.5);
      if (lim && typeof lim.values[0] === "number") setLimitOn(lim.values[0] > 0.5);
      if (tgt && typeof tgt.values[0] === "number") setAgcTarget(tgt.values[0]);
      setReady(true);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [current, read]);

  const disabled = useMemo(() => !current || !ready, [current, ready]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Volume2 className="text-primary h-5 w-5" aria-hidden />
          {t("xvf.audio.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Gauge className="text-muted-foreground h-4 w-4" aria-hidden />
              {t("xvf.audio.micGain")}
            </Label>
            <Badge variant="outline" className="tabular-nums">
              {formatNumber(micGain, 2)}×
            </Badge>
          </div>
          <Slider
            value={[micGain]}
            min={0}
            max={10}
            step={0.05}
            onValueChange={(v) => setMicGain(v[0] ?? 0)}
            onValueCommit={(v) => void write("AUDIO_MGR_MIC_GAIN", [v[0] ?? 0])}
            disabled={disabled}
            aria-label={t("xvf.audio.micGain") ?? "Mic gain"}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <Volume2 className="text-muted-foreground h-4 w-4" aria-hidden />
              {t("xvf.audio.refGain")}
            </Label>
            <Badge variant="outline" className="tabular-nums">
              {formatNumber(refGain, 2)}×
            </Badge>
          </div>
          <Slider
            value={[refGain]}
            min={0}
            max={10}
            step={0.05}
            onValueChange={(v) => setRefGain(v[0] ?? 0)}
            onValueCommit={(v) => void write("AUDIO_MGR_REF_GAIN", [v[0] ?? 0])}
            disabled={disabled}
            aria-label={t("xvf.audio.refGain") ?? "Reference gain"}
          />
        </div>

        <div className="flex flex-col gap-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2">
              <ShieldCheck className="text-muted-foreground h-4 w-4" aria-hidden />
              {t("xvf.audio.agcTarget")}
            </Label>
            <Badge variant="outline" className="tabular-nums">
              {formatNumber(agcTarget, 4)}
            </Badge>
          </div>
          <Slider
            value={[agcTarget]}
            min={0.001}
            max={1}
            step={0.001}
            onValueChange={(v) => setAgcTarget(v[0] ?? 0)}
            onValueCommit={(v) => void write("PP_AGCDESIREDLEVEL", [v[0] ?? 0])}
            disabled={disabled || !agcOn}
            aria-label={t("xvf.audio.agcTarget") ?? "AGC target"}
          />
        </div>

        <ToggleRow
          id="shf"
          label={t("xvf.audio.aecBypass")}
          checked={shfBypass}
          onChange={(v) => {
            setShfBypass(v);
            void write("SHF_BYPASS", [v ? 1 : 0]);
          }}
          disabled={disabled}
          icon={<MicOff className="text-muted-foreground h-4 w-4" aria-hidden />}
        />

        <ToggleRow
          id="agc"
          label={t("xvf.audio.agcOn")}
          checked={agcOn}
          onChange={(v) => {
            setAgcOn(v);
            void write("PP_AGCONOFF", [v ? 1 : 0]);
          }}
          disabled={disabled}
          icon={<Gauge className="text-muted-foreground h-4 w-4" aria-hidden />}
        />

        <ToggleRow
          id="echo"
          label={t("xvf.audio.echoOn")}
          checked={echoOn}
          onChange={(v) => {
            setEchoOn(v);
            void write("PP_ECHOONOFF", [v ? 1 : 0]);
          }}
          disabled={disabled}
          icon={<ShieldCheck className="text-muted-foreground h-4 w-4" aria-hidden />}
        />

        <ToggleRow
          id="limit"
          label={t("xvf.audio.limiterOn")}
          checked={limitOn}
          onChange={(v) => {
            setLimitOn(v);
            void write("PP_LIMITONOFF", [v ? 1 : 0]);
          }}
          disabled={disabled}
          icon={<ShieldCheck className="text-muted-foreground h-4 w-4" aria-hidden />}
        />
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
  disabled,
  icon,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <Label htmlFor={id} className="flex items-center gap-2">
        {icon}
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}
