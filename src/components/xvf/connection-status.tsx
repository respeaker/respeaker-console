import { Activity, Plug, Unplug, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DeviceInfo } from "@/lib/xvf/types";

type Props = {
  device: DeviceInfo | null;
  mock: boolean;
  className?: string;
};

export function ConnectionStatus({ device, mock, className }: Props) {
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
          <span>{device ? (device.product ?? "ReSpeaker XVF3800") : "No device connected"}</span>
          {mock ? (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="size-3" />
              Simulation
            </Badge>
          ) : device ? (
            <Badge variant="success" className="gap-1">
              <Plug className="size-3" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground gap-1">
              <Unplug className="size-3" />
              Offline
            </Badge>
          )}
        </div>
        <div className="text-muted-foreground truncate text-xs">
          {device
            ? `${device.vidHex} / ${device.pidHex}${device.serial ? ` · SN ${device.serial}` : ""} · bus ${device.bus} addr ${device.address}`
            : "Plug a ReSpeaker XVF3800 via USB and click Scan to detect it."}
        </div>
      </div>
      <div className="text-muted-foreground flex items-center gap-1 text-xs">
        <Activity className="size-3" />
        <span>{device ? "Streaming telemetry" : "Idle"}</span>
      </div>
    </div>
  );
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
