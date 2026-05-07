import { useState } from "react"
import { useTranslation } from "react-i18next"
import {
  RefreshCcw,
  Plug,
  PlugZap,
  RotateCcw,
  Cpu,
  Info,
  CircleCheck,
  CircleAlert,
} from "lucide-react"
import type { UseXvfResult } from "@/hooks/use-xvf"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

type Props = {
  xvf: UseXvfResult
}

export function DevicePanel({ xvf }: Props) {
  const { t } = useTranslation()
  const { devices, selectedPath, current, loading, error, refreshDevices, connect, disconnect, reboot, source } = xvf
  const [busy, setBusy] = useState<"connect" | "disconnect" | "reboot" | "refresh" | null>(null)

  const run = async (kind: typeof busy, fn: () => Promise<unknown>) => {
    setBusy(kind)
    try {
      await fn()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="flex items-center gap-3">
            <Cpu className="h-5 w-5 text-primary" aria-hidden />
            <CardTitle className="text-base font-semibold">{t("xvf.device.title")}</CardTitle>
            {source === "mock" && (
              <Badge variant="secondary" className="gap-1">
                <Info className="h-3 w-3" aria-hidden />
                {t("xvf.device.mockBadge")}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => run("refresh", refreshDevices)}
              disabled={busy !== null}
            >
              <RefreshCcw className={`mr-2 h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} aria-hidden />
              {t("xvf.device.refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {devices.length === 0 && !loading && (
            <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              {t("xvf.device.empty")}
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {devices.map((dev) => {
              const active = current?.path === dev.path
              return (
                <li key={dev.path}>
                  <button
                    type="button"
                    onClick={() => void xvf.selectDevice(dev.path)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/10"
                        : selectedPath === dev.path
                          ? "border-primary/40"
                          : "border-border hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {dev.product ?? t("xvf.device.unknownProduct")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {dev.manufacturer ?? "—"} · VID {dev.vid.toString(16).padStart(4, "0").toUpperCase()} · PID{" "}
                        {dev.pid.toString(16).padStart(4, "0").toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t("xvf.device.serial")}: {dev.serial ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {active && (
                        <Badge variant="default" className="gap-1">
                          <CircleCheck className="h-3 w-3" aria-hidden />
                          {t("xvf.device.connected")}
                        </Badge>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>

          <Separator className="my-1" />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                run("connect", async () => {
                  if (selectedPath) await connect(selectedPath)
                })
              }
              disabled={!selectedPath || busy !== null || current?.path === selectedPath}
            >
              <Plug className={`mr-2 h-4 w-4 ${busy === "connect" ? "animate-pulse" : ""}`} aria-hidden />
              {t("xvf.device.connect")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => run("disconnect", disconnect)}
              disabled={!current || busy !== null}
            >
              <PlugZap className="mr-2 h-4 w-4" aria-hidden />
              {t("xvf.device.disconnect")}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => run("reboot", reboot)}
              disabled={!current || busy !== null}
            >
              <RotateCcw className={`mr-2 h-4 w-4 ${busy === "reboot" ? "animate-spin" : ""}`} aria-hidden />
              {t("xvf.device.reboot")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
