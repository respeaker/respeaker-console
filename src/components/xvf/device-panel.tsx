import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import {
  Binary,
  CircleCheck,
  CircleAlert,
  Cpu,
  FileUp,
  Info,
  Loader2,
  Plug,
  PlugZap,
  RefreshCcw,
  RotateCcw,
  ShieldAlert,
  Terminal,
} from "lucide-react";
import type { UseXvfResult } from "@/hooks/use-xvf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { DfuCheckResult } from "@/lib/xvf/types";
import { cn } from "@/lib/utils";

type Props = {
  xvf: UseXvfResult;
};

export function DevicePanel({ xvf }: Props) {
  const { t } = useTranslation();
  const {
    devices,
    selectedPath,
    current,
    loading,
    error,
    refreshDevices,
    connect,
    disconnect,
    reboot,
    checkDfuUtil,
    flashFirmware,
    dfuOutputs,
    clearDfuOutputs,
    source,
  } = xvf;
  const [busy, setBusy] = useState<"connect" | "disconnect" | "reboot" | "refresh" | null>(null);
  const [rebootDialogOpen, setRebootDialogOpen] = useState(false);
  const [firmwareDialogOpen, setFirmwareDialogOpen] = useState(false);
  const [firmwareStep, setFirmwareStep] = useState<1 | 2 | 3>(1);
  const [dfuStatus, setDfuStatus] = useState<DfuCheckResult | null>(null);
  const [firmwarePath, setFirmwarePath] = useState<string | null>(null);
  const [firmwareBusy, setFirmwareBusy] = useState<"check" | "flash" | "pick" | null>(null);

  const run = async (kind: typeof busy, fn: () => Promise<unknown>) => {
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  const handleRebootClick = () => {
    setRebootDialogOpen(true);
  };

  const handleRebootConfirm = () => {
    setRebootDialogOpen(false);
    void run("reboot", reboot);
  };

  const handleOpenFirmwareDialog = () => {
    setFirmwareDialogOpen(true);
    setFirmwareStep(1);
  };

  const handleCheckDfu = async () => {
    setFirmwareBusy("check");
    try {
      const status = await checkDfuUtil();
      setDfuStatus(status);
      if (status?.available) {
        setFirmwareStep(3);
      }
    } finally {
      setFirmwareBusy(null);
    }
  };

  const handlePickFirmware = async () => {
    setFirmwareBusy("pick");
    try {
      if (source === "mock") {
        setFirmwarePath("mock-firmware.bin");
        return;
      }
      const selected = await open({
        multiple: false,
        filters: [{ name: t("xvf.device.firmware.binFile"), extensions: ["bin"] }],
      });
      if (typeof selected === "string") {
        setFirmwarePath(selected);
      }
    } finally {
      setFirmwareBusy(null);
    }
  };

  const handleFlashFirmware = async () => {
    if (!firmwarePath) return;
    setFirmwareBusy("flash");
    try {
      const ok = await flashFirmware(firmwarePath);
      if (ok) {
        setDfuStatus(null);
      }
    } finally {
      setFirmwareBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="flex items-center gap-3">
            <Cpu className="text-primary h-5 w-5" aria-hidden />
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
              <RefreshCcw
                className={`mr-2 h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`}
                aria-hidden
              />
              {t("xvf.device.refresh")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {error && (
            <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-start gap-2 rounded-md border p-3 text-sm">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
          )}

          {devices.length === 0 && !loading && (
            <div className="text-muted-foreground rounded-md border border-dashed p-6 text-center text-sm">
              {t("xvf.device.empty")}
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {devices.map((dev) => {
              const active = current?.path === dev.path;
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
                      <span className="text-muted-foreground text-xs">
                        {dev.manufacturer ?? "—"} · VID{" "}
                        {dev.vid.toString(16).padStart(4, "0").toUpperCase()} · PID{" "}
                        {dev.pid.toString(16).padStart(4, "0").toUpperCase()}
                      </span>
                      <span className="text-muted-foreground text-xs">
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
              );
            })}
          </ul>

          <Separator className="my-1" />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                run("connect", async () => {
                  if (selectedPath) await connect(selectedPath);
                })
              }
              disabled={!selectedPath || busy !== null || current?.path === selectedPath}
            >
              <Plug
                className={`mr-2 h-4 w-4 ${busy === "connect" ? "animate-pulse" : ""}`}
                aria-hidden
              />
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
              onClick={handleRebootClick}
              disabled={!current || busy !== null}
            >
              <RotateCcw
                className={`mr-2 h-4 w-4 ${busy === "reboot" ? "animate-spin" : ""}`}
                aria-hidden
              />
              {t("xvf.device.reboot")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div className="flex items-center gap-3">
            <Binary className="text-primary h-5 w-5" aria-hidden />
            <div>
              <CardTitle className="text-base font-semibold">
                {t("xvf.device.firmware.title")}
              </CardTitle>
              <p className="text-muted-foreground mt-1 text-xs">
                {t("xvf.device.firmware.description")}
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleOpenFirmwareDialog}>
            <FileUp className="mr-2 h-4 w-4" aria-hidden />
            {t("xvf.device.firmware.openWizard")}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t("xvf.device.firmware.warning")}</span>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={rebootDialogOpen} onOpenChange={setRebootDialogOpen}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-medium">
              <RotateCcw className="h-4 w-4" aria-hidden />
              {t("xvf.confirm.reboot.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/80 leading-relaxed">
              {t("xvf.confirm.reboot.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-normal">{t("xvf.confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleRebootConfirm}
              className="font-normal"
            >
              {t("xvf.confirm.reboot.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={firmwareDialogOpen} onOpenChange={setFirmwareDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-medium">
              <Binary className="h-4 w-4" aria-hidden />
              {t("xvf.device.firmware.title")}
            </DialogTitle>
            <DialogDescription>{t("xvf.device.firmware.dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="flex min-h-0 flex-col gap-4 overflow-auto pr-1">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={cn(
                    "rounded-md border px-3 py-2 text-xs",
                    firmwareStep === step ? "border-primary bg-primary/10" : "border-border"
                  )}
                >
                  <span className="text-muted-foreground">
                    {t("xvf.device.firmware.step", { step })}
                  </span>
                  <div className="mt-1 font-medium">
                    {t(`xvf.device.firmware.steps.${step}.title`)}
                  </div>
                </div>
              ))}
            </div>

            {firmwareStep === 1 && (
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{t("xvf.device.firmware.safeModeWarning")}</span>
                </div>
                <ol className="text-muted-foreground list-decimal space-y-2 pl-5 text-sm">
                  <li>{t("xvf.device.firmware.instructions.disconnect")}</li>
                  <li>{t("xvf.device.firmware.instructions.enterDfu")}</li>
                  <li>{t("xvf.device.firmware.instructions.reconnect")}</li>
                </ol>
              </div>
            )}

            {firmwareStep === 2 && (
              <div className="space-y-3">
                <Button onClick={handleCheckDfu} disabled={firmwareBusy !== null}>
                  {firmwareBusy === "check" ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Terminal className="mr-2 h-4 w-4" aria-hidden />
                  )}
                  {t("xvf.device.firmware.checkDfu")}
                </Button>
                {dfuStatus && <DfuStatusPanel status={dfuStatus} />}
              </div>
            )}

            {firmwareStep === 3 && (
              <div className="space-y-4">
                {dfuStatus && <DfuStatusPanel status={dfuStatus} />}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={handlePickFirmware}
                    disabled={firmwareBusy !== null}
                  >
                    {firmwareBusy === "pick" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <FileUp className="mr-2 h-4 w-4" aria-hidden />
                    )}
                    {t("xvf.device.firmware.selectFile")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleFlashFirmware}
                    disabled={!firmwarePath || firmwareBusy !== null}
                  >
                    {firmwareBusy === "flash" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <Binary className="mr-2 h-4 w-4" aria-hidden />
                    )}
                    {t("xvf.device.firmware.flash")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={clearDfuOutputs}
                    disabled={firmwareBusy !== null}
                  >
                    {t("xvf.logs.clear")}
                  </Button>
                </div>

                <div className="bg-muted/60 rounded-md border p-3 text-xs">
                  <div className="text-muted-foreground mb-1 font-medium">
                    {t("xvf.device.firmware.selectedFile")}
                  </div>
                  <div className="font-mono break-all">
                    {firmwarePath ?? t("xvf.device.firmware.noFile")}
                  </div>
                </div>

                <div className="bg-background max-h-52 overflow-auto rounded-md border p-3 font-mono text-xs">
                  {dfuOutputs.length === 0 ? (
                    <div className="text-muted-foreground font-sans">
                      {t("xvf.device.firmware.noOutput")}
                    </div>
                  ) : (
                    dfuOutputs.map((entry) => (
                      <div
                        key={entry.id}
                        className={cn(
                          entry.stream === "stderr" && "text-destructive",
                          entry.stream === "status" && "text-primary"
                        )}
                      >
                        [{entry.stream}] {entry.line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" onClick={() => setFirmwareDialogOpen(false)}>
              {t("xvf.confirm.cancel")}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setFirmwareStep((step) => (step > 1 ? ((step - 1) as 1 | 2) : step))}
                disabled={firmwareStep === 1 || firmwareBusy !== null}
              >
                {t("xvf.device.firmware.back")}
              </Button>
              <Button
                onClick={() => {
                  if (firmwareStep === 2) void handleCheckDfu();
                  else setFirmwareStep((step) => (step < 3 ? ((step + 1) as 2 | 3) : step));
                }}
                disabled={firmwareStep === 3 || firmwareBusy !== null}
              >
                {firmwareStep === 2
                  ? t("xvf.device.firmware.checkDfu")
                  : t("xvf.device.firmware.next")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DfuStatusPanel({ status }: { status: DfuCheckResult }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 rounded-md border p-3 text-sm">
      <div className="flex items-center gap-2">
        {status.available ? (
          <CircleCheck className="text-primary h-4 w-4" aria-hidden />
        ) : (
          <CircleAlert className="text-destructive h-4 w-4" aria-hidden />
        )}
        <span className="font-medium">
          {status.available
            ? t("xvf.device.firmware.dfuReady")
            : t("xvf.device.firmware.dfuMissing")}
        </span>
      </div>
      <div className="text-muted-foreground text-xs break-all">
        {t("xvf.device.firmware.executable")}: {status.executable}
      </div>
      {status.hint && <div className="text-muted-foreground text-xs">{status.hint}</div>}
      {(status.versionOutput || status.listOutput) && (
        <pre className="bg-muted/60 max-h-28 overflow-auto rounded p-2 text-xs whitespace-pre-wrap">
          {[status.versionOutput, status.listOutput].filter(Boolean).join("\n")}
        </pre>
      )}
    </div>
  );
}
