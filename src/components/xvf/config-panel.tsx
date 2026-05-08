import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  SlidersHorizontal,
  RefreshCcw,
  Save,
  Download,
  Upload,
  RotateCcw,
} from "lucide-react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { getVersion } from "@tauri-apps/api/app";
import { toast } from "sonner";
import type { UseXvfResult } from "@/hooks/use-xvf";
import type { ParameterInfo } from "@/lib/xvf/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatNumber } from "@/lib/xvf/format";
import { residKey } from "@/lib/xvf/types";
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

type Props = { xvf: UseXvfResult };

const GROUP_LABELS: Record<string, string> = {
  APP: "Application",
  AEC: "AEC",
  AUDIO_MGR: "Audio Manager",
  GPO_LED: "GPO / LED",
  PP: "Post-Processing",
  OTHER: "Other",
};

export function ConfigPanel({ xvf }: Props) {
  const { t } = useTranslation();
  const { commands, current, read, write, readMany } = xvf;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ParameterInfo | null>(null);
  const [values, setValues] = useState<string[]>([]);
  const [busy, setBusy] = useState<"read" | "write" | "export" | "import" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<
    "reboot" | "saveConfig" | "import" | "restoreDefaults" | null
  >(null);
  const [pendingImportData, setPendingImportData] = useState<Record<string, number[]> | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [commands, query]);

  const grouped = useMemo(() => {
    const groups = new Map<string, ParameterInfo[]>();
    for (const c of filtered) {
      const key = residKey(c.resid);
      const list = groups.get(key) ?? [];
      list.push(c);
      groups.set(key, list);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const select = (cmd: ParameterInfo) => {
    setSelected(cmd);
    setValues(new Array(cmd.length).fill(""));
    setMessage(null);
  };

  const doRead = async () => {
    if (!selected) return;
    setBusy("read");
    setMessage(null);
    try {
      const res = await read(selected.name);
      if (res) {
        setValues(res.values.map((v) => (typeof v === "number" ? formatNumber(v, 6) : String(v))));
        setMessage(t("xvf.config.readOk") ?? "Read OK");
      } else {
        setMessage(t("xvf.config.readFail") ?? "Read failed");
      }
    } finally {
      setBusy(null);
    }
  };

  const doWrite = async () => {
    if (!selected) return;

    // Check for dangerous operations and show confirmation first
    if (selected.name === "SAVE_CONFIGURATION") {
      setConfirmDialog("saveConfig");
      return;
    }
    if (selected.name === "REBOOT") {
      setConfirmDialog("reboot");
      return;
    }

    await executeWrite();
  };

  const executeWrite = async () => {
    if (!selected) return;
    setBusy("write");
    setMessage(null);
    try {
      const parsed = values.map((v, idx) => {
        if (selected.kind === "char") return v;
        const n = Number(v);
        if (!Number.isFinite(n)) {
          throw new Error(`Invalid value at index ${idx}`);
        }
        return n;
      });
      const ok = await write(selected.name, parsed);
      setMessage(
        ok ? (t("xvf.config.writeOk") ?? "Write OK") : (t("xvf.config.writeFail") ?? "Write failed")
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const executeSaveToFlash = async () => {
    setBusy("write");
    try {
      const ok = await write("SAVE_CONFIGURATION", [0]);
      if (ok) toast.success(t("xvf.config.saveToFlashOk"));
      else toast.error(t("xvf.config.writeFail"));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmDangerous = () => {
    const dialog = confirmDialog;
    setConfirmDialog(null);
    if (dialog === "import") {
      void executeImport();
    } else if (dialog === "restoreDefaults") {
      void executeRestoreDefaults();
    } else if (dialog === "saveConfig") {
      void executeSaveToFlash();
    } else {
      void executeWrite();
    }
  };

  const doRestoreDefaults = () => {
    setConfirmDialog("restoreDefaults");
  };

  const executeRestoreDefaults = async () => {
    setBusy("write");
    try {
      const ok = await write("CLEAR_CONFIGURATION", [0]);
      if (ok) {
        toast.success(t("xvf.config.restoreDefaultsOk"));
      } else {
        toast.error(t("xvf.config.writeFail"));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doExport = async () => {
    const readableParams = commands.filter((c) => c.access === "ro" || c.access === "rw");
    if (readableParams.length === 0) return;

    setBusy("export");
    try {
      const names = readableParams.map((c) => c.name);
      const results = await readMany(names);
      const parameters: Record<string, (number | string)[]> = {};
      for (const [name, result] of Object.entries(results)) {
        parameters[name] = result.values;
      }

      const appVersion = await getVersion();
      const preset = {
        version: "1.0",
        app_version: appVersion,
        exported_at: new Date().toISOString(),
        device: {
          product_name: current?.product ?? "Unknown",
          serial: current?.serial ?? null,
        },
        parameters,
      };

      const path = await save({
        title: t("xvf.config.exportTitle"),
        defaultPath: `respeaker-config-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (path) {
        await writeTextFile(path, JSON.stringify(preset, null, 2));
        toast.success(t("xvf.config.exportOk"));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    setBusy("import");
    try {
      const path = await open({
        title: t("xvf.config.importTitle"),
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
        directory: false,
      });
      if (!path) {
        setBusy(null);
        return;
      }
      const text = await readTextFile(path);
      const preset: { parameters?: Record<string, number[]> } = JSON.parse(text);
      if (!preset.parameters || typeof preset.parameters !== "object") {
        toast.error(t("xvf.config.importInvalid"));
        setBusy(null);
        return;
      }
      setPendingImportData(preset.parameters);
      setConfirmDialog("import");
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(null);
    }
  };

  const executeImport = async () => {
    if (!pendingImportData) return;
    const SKIP_ON_IMPORT = new Set(["SAVE_CONFIGURATION", "REBOOT", "CLEAR_CONFIGURATION"]);
    try {
      const writableParams = commands.filter((c) => c.access === "wo" || c.access === "rw");
      const writableNames = new Set(writableParams.map((c) => c.name));
      let written = 0;
      let failed = 0;
      for (const [name, vals] of Object.entries(pendingImportData)) {
        if (!writableNames.has(name) || SKIP_ON_IMPORT.has(name)) continue;
        const ok = await write(name, vals);
        if (ok) written++;
        else failed++;
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (failed > 0 && written === 0) {
        toast.error(t("xvf.config.importDone", { written, failed }));
      } else {
        toast.success(t("xvf.config.importDone", { written, failed }));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setPendingImportData(null);
      setBusy(null);
    }
  };

  const readOnly = selected?.access === "ro";
  const writeOnly = selected?.access === "wo";

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <SlidersHorizontal className="text-primary h-5 w-5" aria-hidden />
            {t("xvf.config.title")}
            <Badge variant="outline" className="ml-auto">
              {commands.length}
            </Badge>
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={doExport}
              disabled={!current || busy !== null}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {t("xvf.config.export")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={doImport}
              disabled={!current || busy !== null}
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {t("xvf.config.import")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={doRestoreDefaults}
              disabled={!current || busy !== null}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {t("xvf.config.restoreDefaults")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDialog("saveConfig")}
              disabled={!current || busy !== null}
            >
              <Save className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              {t("xvf.config.saveToFlash")}
            </Button>
          </div>
          <div className="relative">
            <Search
              className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("xvf.config.search") ?? "Search"}
              className="pl-8"
              aria-label={t("xvf.config.search") ?? "Search"}
            />
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <ScrollArea className="h-[480px]">
            <ul className="flex flex-col">
              {grouped.map(([group, items]) => (
                <li key={group} className="flex flex-col">
                  <div className="bg-muted/60 text-muted-foreground sticky top-0 px-4 py-1.5 text-[11px] font-semibold tracking-wide uppercase">
                    {GROUP_LABELS[group] ?? group}
                  </div>
                  <ul>
                    {items.map((cmd) => (
                      <li key={cmd.name}>
                        <button
                          type="button"
                          onClick={() => select(cmd)}
                          className={`hover:bg-accent/40 flex w-full flex-col items-start gap-0.5 border-b px-4 py-2.5 text-left transition-colors ${
                            selected?.name === cmd.name ? "bg-accent/60" : ""
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="font-mono text-xs font-semibold">{cmd.name}</span>
                            <Badge
                              variant={cmd.access === "ro" ? "outline" : "secondary"}
                              className="text-[10px] uppercase"
                            >
                              {cmd.access}
                            </Badge>
                          </div>
                          <span className="text-muted-foreground line-clamp-1 text-xs">
                            {cmd.description}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="text-muted-foreground p-6 text-center text-sm">
                  {t("xvf.config.empty")}
                </li>
              )}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base font-semibold">
            <span>{selected ? selected.name : t("xvf.config.selectPrompt")}</span>
            {selected && (
              <Badge variant="outline" className="font-mono text-xs">
                resid=0x{selected.resid.toString(16).padStart(2, "0").toUpperCase()} cmdid=0x
                {selected.cmdid.toString(16).padStart(2, "0").toUpperCase()} len={selected.length}{" "}
                {selected.kind}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {!selected ? (
            <p className="text-muted-foreground text-sm">{t("xvf.config.selectHint")}</p>
          ) : (
            <>
              <p className="text-muted-foreground text-sm">{selected.description}</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {values.map((v, idx) => (
                  <Input
                    key={idx}
                    value={v}
                    onChange={(e) => {
                      const next = [...values];
                      next[idx] = e.target.value;
                      setValues(next);
                    }}
                    placeholder={`#${idx}`}
                    aria-label={`${selected.name} value ${idx}`}
                    disabled={!current}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={doRead}
                  disabled={!current || writeOnly || busy !== null}
                >
                  <RefreshCcw
                    className={`mr-2 h-4 w-4 ${busy === "read" ? "animate-spin" : ""}`}
                    aria-hidden
                  />
                  {t("xvf.config.read")}
                </Button>
                <Button
                  size="sm"
                  onClick={doWrite}
                  disabled={!current || readOnly || busy !== null}
                >
                  <Save className="mr-2 h-4 w-4" aria-hidden />
                  {t("xvf.config.write")}
                </Button>
              </div>
              {message && <p className="text-muted-foreground text-xs">{message}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog(null);
            if (confirmDialog === "import") {
              setPendingImportData(null);
              setBusy(null);
            }
          }
        }}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-medium">
              {confirmDialog === "reboot"
                ? t("xvf.confirm.reboot.title")
                : confirmDialog === "import"
                  ? t("xvf.confirm.import.title")
                  : confirmDialog === "restoreDefaults"
                    ? t("xvf.confirm.restoreDefaults.title")
                    : t("xvf.confirm.saveConfig.title")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/80 leading-relaxed">
              {confirmDialog === "reboot"
                ? t("xvf.confirm.reboot.description")
                : confirmDialog === "import"
                  ? t("xvf.confirm.import.description")
                  : confirmDialog === "restoreDefaults"
                    ? t("xvf.confirm.restoreDefaults.description")
                    : t("xvf.confirm.saveConfig.description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-normal">{t("xvf.confirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant={
                confirmDialog === "reboot" || confirmDialog === "restoreDefaults"
                  ? "destructive"
                  : "default"
              }
              onClick={handleConfirmDangerous}
              className="font-normal"
            >
              {confirmDialog === "reboot"
                ? t("xvf.confirm.reboot.confirm")
                : confirmDialog === "import"
                  ? t("xvf.confirm.import.confirm")
                  : confirmDialog === "restoreDefaults"
                    ? t("xvf.confirm.restoreDefaults.confirm")
                    : t("xvf.confirm.saveConfig.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
