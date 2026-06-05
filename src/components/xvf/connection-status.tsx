import { Activity, Plug, Unplug, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FirmwareMetadata } from "@/hooks/use-xvf";
import type { DeviceInfo } from "@/lib/xvf/types";

type Props = {
  device: DeviceInfo | null;
  firmwareMetadata?: FirmwareMetadata | null;
  mock: boolean;
  className?: string;
};

export function ConnectionStatus({ device, firmwareMetadata, mock, className }: Props) {
  const { t } = useTranslation();
  const buildSummary = formatBuildSummary(firmwareMetadata, t);

  return (
    <div
      className={cn(
        "bg-card flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3",
        className
      )}
    >
      <StatusDot connected={!!device} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{device ? (device.product ?? "reSpeaker XVF3800") : t("xvf.status.noDevice")}</span>
          {mock ? (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="size-3" />
              {t("xvf.status.mockMode")}
            </Badge>
          ) : device ? (
            <Badge variant="success" className="gap-1">
              <Plug className="size-3" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground gap-1">
              <Unplug className="size-3" />
              {t("xvf.status.offline")}
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {device
            ? `${device.vidHex} / ${device.pidHex}${device.serial ? ` · SN ${device.serial}` : ""} · bus ${device.bus} addr ${device.address}`
            : t("xvf.status.connectHint")}
        </div>
        {device && firmwareMetadata && (
          <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {firmwareMetadata.version && (
              <span>
                {t("xvf.device.info.version")}: {firmwareMetadata.version}
              </span>
            )}
            {buildSummary && (
              <span>
                {t("xvf.device.info.build")}: {buildSummary}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <Activity className="size-3" />
        <span>{device ? t("xvf.status.streaming") : t("xvf.status.idle")}</span>
      </div>
    </div>
  );
}

function formatBuildSummary(
  metadata: FirmwareMetadata | null | undefined,
  t: (key: string) => string
): string | null {
  const build = metadata?.build;
  if (!build) return null;

  const parts: string[] = [];
  if (build.raw) parts.push(build.raw);
  if (build.sampleRateKhz != null) parts.push(`${build.sampleRateKhz} kHz`);
  if (build.arrayType) {
    parts.push(t(`xvf.device.info.arrayTypes.${build.arrayType}`));
  }
  if (build.channelMode) parts.push(build.channelMode);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span className="relative flex size-3 shrink-0" aria-hidden="true">
      {connected ? (
        <>
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
        </>
      ) : (
        <span className="bg-muted-foreground/40 relative inline-flex size-3 rounded-full" />
      )}
    </span>
  );
}
