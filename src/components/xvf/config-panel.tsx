import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, RefreshCcw, RotateCcw, Save, Search, Upload } from "lucide-react";
import { getVersion } from "@tauri-apps/api/app";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";

import type { UseXvfResult } from "@/hooks/use-xvf";
import type { ParameterInfo, XvfValue } from "@/lib/xvf/types";
import { RESID } from "@/lib/xvf/types";
import { formatValue } from "@/lib/xvf/format";
import { cn } from "@/lib/utils";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = { xvf: UseXvfResult };

type ConfigCategory = "audio" | "aec" | "postproc" | "ledGpio" | "system" | "other";
type BusyState = "read" | "write" | "export" | "import" | null;
type ConfirmDialog = "reboot" | "saveConfig" | "import" | "restoreDefaults" | null;

type ImportEntry = {
  param: ParameterInfo;
  values: XvfValue[];
};

type ConfigPreset = {
  version?: unknown;
  parameters?: unknown;
};

const CATEGORIES: ConfigCategory[] = ["audio", "aec", "postproc", "ledGpio", "system", "other"];

const CATEGORY_RESID: Partial<Record<ConfigCategory, number>> = {
  audio: RESID.AUDIO_MGR,
  aec: RESID.AEC,
  postproc: RESID.PP,
  ledGpio: RESID.GPO_LED,
  system: RESID.APP,
};

const SKIP_ON_IMPORT = new Set(["SAVE_CONFIGURATION", "REBOOT", "CLEAR_CONFIGURATION"]);

interface PendingWrite {
  param: ParameterInfo;
  values: XvfValue[];
}

export function ConfigPanel({ xvf }: Props) {
  const { t } = useTranslation();
  const { commands, current, read, write, readMany } = xvf;
  const [activeCategory, setActiveCategory] = useState<ConfigCategory>("audio");
  const [query, setQuery] = useState("");
  const [currentValues, setCurrentValues] = useState<Record<string, XvfValue[]>>({});
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [loadingCategory, setLoadingCategory] = useState<ConfigCategory | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [busyParam, setBusyParam] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog>(null);
  const [pendingWrite, setPendingWrite] = useState<PendingWrite | null>(null);
  const [pendingImportData, setPendingImportData] = useState<ImportEntry[] | null>(null);

  const commandsByCategory = useMemo(() => {
    const map = new Map<ConfigCategory, ParameterInfo[]>();
    for (const category of CATEGORIES) {
      map.set(category, []);
    }

    for (const command of commands) {
      map.get(categoryForResid(command.resid))?.push(command);
    }

    for (const category of CATEGORIES) {
      map.get(category)?.sort((a, b) => a.name.localeCompare(b.name));
    }

    return map;
  }, [commands]);

  const activeParams = useMemo(
    () => commandsByCategory.get(activeCategory) ?? [],
    [activeCategory, commandsByCategory]
  );

  const filteredParams = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeParams;
    return activeParams.filter(
      (param) => param.name.toLowerCase().includes(q) || param.description.toLowerCase().includes(q)
    );
  }, [activeParams, query]);

  useEffect(() => {
    if (!current || activeParams.length === 0) {
      return;
    }

    let cancelled = false;
    const readable = activeParams.filter((param) => param.access === "ro" || param.access === "rw");
    if (readable.length === 0) {
      return;
    }

    const loadCategory = async () => {
      setLoadingCategory(activeCategory);
      const results = await readMany(readable.map((param) => param.name));
      if (cancelled) {
        return;
      }

      setCurrentValues((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(results).map(([name, result]) => [name, result.values])
        ),
      }));
      setDraftValues((prev) => ({
        ...prev,
        ...Object.fromEntries(
          Object.entries(results).map(([name, result]) => [name, valuesToDraft(result.values)])
        ),
      }));
      setLoadingCategory(null);
    };

    void loadCategory();
    return () => {
      cancelled = true;
    };
  }, [activeCategory, activeParams, current, readMany]);

  const readParam = async (param: ParameterInfo) => {
    if (param.access === "wo") {
      return;
    }

    setBusy("read");
    setBusyParam(param.name);
    try {
      const result = await read(param.name);
      if (!result) {
        toast.error(t("xvf.config.readFail"));
        return;
      }

      setCurrentValues((prev) => ({ ...prev, [param.name]: result.values }));
      setDraftValues((prev) => ({ ...prev, [param.name]: valuesToDraft(result.values) }));
      toast.success(t("xvf.config.readOk"));
    } finally {
      setBusy(null);
      setBusyParam(null);
    }
  };

  const writeParam = async (param: ParameterInfo) => {
    if (param.access === "ro") {
      return;
    }

    let parsed: XvfValue[];
    try {
      parsed = parseDraft(param, draftValues[param.name] ?? "");
    } catch (error) {
      toast.error((error as Error).message);
      return;
    }

    if (param.name === "SAVE_CONFIGURATION") {
      setConfirmDialog("saveConfig");
      return;
    }
    if (param.name === "REBOOT") {
      setPendingWrite({ param, values: parsed });
      setConfirmDialog("reboot");
      return;
    }
    if (param.name === "CLEAR_CONFIGURATION") {
      setPendingWrite({ param, values: parsed });
      setConfirmDialog("restoreDefaults");
      return;
    }

    await executeWrite(param, parsed);
  };

  const executeWrite = async (param: ParameterInfo, values: XvfValue[]) => {
    setBusy("write");
    setBusyParam(param.name);
    try {
      const ok = await write(param.name, values);
      if (ok) {
        setCurrentValues((prev) => ({ ...prev, [param.name]: values }));
        toast.success(t("xvf.config.writeOk"));
      } else {
        toast.error(t("xvf.config.writeFail"));
      }
    } finally {
      setBusy(null);
      setBusyParam(null);
    }
  };

  const executeSaveToFlash = async () => {
    setBusy("write");
    try {
      const ok = await write("SAVE_CONFIGURATION", [0]);
      if (ok) toast.success(t("xvf.config.saveToFlashOk"));
      else toast.error(t("xvf.config.writeFail"));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const executeRestoreDefaults = async () => {
    setBusy("write");
    try {
      const ok = await write("CLEAR_CONFIGURATION", [0]);
      if (ok) toast.success(t("xvf.config.restoreDefaultsOk"));
      else toast.error(t("xvf.config.writeFail"));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const handleConfirmDangerous = () => {
    const dialog = confirmDialog;
    const writeRequest = pendingWrite;
    setConfirmDialog(null);
    setPendingWrite(null);

    if (dialog === "import") {
      void executeImport();
    } else if (dialog === "saveConfig") {
      void executeSaveToFlash();
    } else if (dialog === "restoreDefaults") {
      if (writeRequest) void executeWrite(writeRequest.param, writeRequest.values);
      else void executeRestoreDefaults();
    } else if (dialog === "reboot" && writeRequest) {
      void executeWrite(writeRequest.param, writeRequest.values);
    }
  };

  const doExport = async () => {
    const writableParams = commands.filter((param) => param.access === "rw");
    if (writableParams.length === 0) return;

    setBusy("export");
    try {
      const results = await readMany(writableParams.map((param) => param.name));
      const parameters: Record<string, XvfValue[]> = {};
      for (const param of writableParams) {
        const result = results[param.name];
        if (!result || result.values.length === 0) continue;
        parameters[param.name] = result.values;
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
    } catch (error) {
      toast.error((error as Error).message);
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
      const preset = JSON.parse(text) as ConfigPreset;
      if (!isConfigPreset(preset) || preset.version !== "1.0") {
        toast.error(t("xvf.config.importInvalid"));
        setBusy(null);
        return;
      }

      const validation = validateImportEntries(preset.parameters, commands);
      if (validation.entries.length === 0) {
        toast.error(t("xvf.config.importInvalid"));
        if (validation.errors.length > 0) {
          toast.error(
            t("xvf.config.importFailedParameters", { names: summarizeNames(validation.errors) })
          );
        }
        setBusy(null);
        return;
      }

      if (validation.errors.length > 0) {
        toast.warning(t("xvf.config.importSkipped", { count: validation.errors.length }));
        toast.error(
          t("xvf.config.importFailedParameters", { names: summarizeNames(validation.errors) })
        );
      }

      setPendingImportData(validation.entries);
      setConfirmDialog("import");
    } catch (error) {
      toast.error((error as Error).message);
      setBusy(null);
    }
  };

  const executeImport = async () => {
    if (!pendingImportData) return;

    try {
      let written = 0;
      let failed = 0;
      const failedNames: string[] = [];

      for (const entry of pendingImportData) {
        const ok = await write(entry.param.name, entry.values);
        if (ok) written += 1;
        else {
          failed += 1;
          failedNames.push(entry.param.name);
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      if (failedNames.length > 0) {
        toast.error(t("xvf.config.importFailedParameters", { names: summarizeNames(failedNames) }));
      }

      if (failed > 0 && written === 0) {
        toast.error(t("xvf.config.importDone", { written, failed }));
      } else {
        toast.success(t("xvf.config.importDone", { written, failed }));
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPendingImportData(null);
      setBusy(null);
    }
  };

  const categoryIsLoading = loadingCategory === activeCategory;

  return (
    <Card className="min-h-0 flex-1 gap-0 overflow-hidden py-0">
      <CardHeader className="gap-3 border-b py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold">{t("xvf.config.title")}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={doExport}
              disabled={!current || busy !== null}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {t("xvf.config.export")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={doImport}
              disabled={!current || busy !== null}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {t("xvf.config.import")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmDialog("saveConfig")}
              disabled={!current || busy !== null}
            >
              <Save className="h-3.5 w-3.5" aria-hidden />
              {t("xvf.config.saveToFlash")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => setConfirmDialog("restoreDefaults")}
              disabled={!current || busy !== null}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t("xvf.config.restoreDefaults")}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tabs
            value={activeCategory}
            onValueChange={(value) => setActiveCategory(value as ConfigCategory)}
          >
            <TabsList className="flex h-auto flex-wrap justify-start">
              {CATEGORIES.map((category) => (
                <TabsTrigger key={category} value={category} className="gap-2">
                  {t(`xvf.config.categories.${category}`)}
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {commandsByCategory.get(category)?.length ?? 0}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="relative min-w-56 flex-1 md:max-w-xs">
            <Search
              className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("xvf.config.search")}
              className="pl-8"
              aria-label={t("xvf.config.search")}
            />
          </div>

          {categoryIsLoading && (
            <span className="text-muted-foreground flex items-center gap-2 text-xs">
              <RefreshCcw className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t("xvf.config.loadingCategory")}
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-auto p-0">
        <div className="min-w-[960px]">
          <div className="bg-muted/50 text-muted-foreground grid grid-cols-[220px_190px_240px_110px_minmax(260px,1fr)] border-b px-4 py-2 text-xs font-medium">
            <span>{t("xvf.config.columns.name")}</span>
            <span>{t("xvf.config.columns.currentValue")}</span>
            <span>{t("xvf.config.columns.newValue")}</span>
            <span>{t("xvf.config.columns.actions")}</span>
            <span>{t("xvf.config.columns.description")}</span>
          </div>

          {filteredParams.map((param) => {
            const isReadOnly = param.access === "ro";
            const isWriteOnly = param.access === "wo";
            const rowBusy = busyParam === param.name;
            const currentText = isWriteOnly
              ? t("xvf.config.writeOnly")
              : formatValue(param, currentValues[param.name] ?? null);

            return (
              <div
                key={param.name}
                className="hover:bg-muted/30 grid grid-cols-[220px_190px_240px_110px_minmax(260px,1fr)] items-center gap-3 border-b px-4 py-2.5 text-sm font-normal"
              >
                <div className="min-w-0">
                  <div className="truncate font-mono text-xs font-semibold" title={param.name}>
                    {param.name}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge
                      variant={isReadOnly ? "outline" : "secondary"}
                      className="text-[10px] uppercase"
                    >
                      {param.access}
                    </Badge>
                    <span className="text-muted-foreground text-[10px]">
                      {param.kind} x{param.length}
                    </span>
                  </div>
                </div>

                <div
                  className="text-muted-foreground truncate font-mono text-xs font-[400]"
                  title={currentText}
                >
                  {currentText}
                </div>

                <Input
                  value={draftValues[param.name] ?? ""}
                  onChange={(event) =>
                    setDraftValues((prev) => ({ ...prev, [param.name]: event.target.value }))
                  }
                  placeholder={isReadOnly ? t("xvf.config.readOnly") : t("xvf.config.newValue")}
                  disabled={!current || isReadOnly}
                  aria-label={`${param.name} ${t("xvf.config.newValue")}`}
                  className="h-8 font-mono text-xs font-[400]"
                />

                <div className="flex items-center gap-1.5">
                  <Button
                    size="icon-xs"
                    variant="outline"
                    onClick={() => void readParam(param)}
                    disabled={!current || isWriteOnly || busy !== null}
                    aria-label={`${t("xvf.config.read")} ${param.name}`}
                  >
                    <RefreshCcw
                      className={cn("h-3 w-3", rowBusy && busy === "read" && "animate-spin")}
                    />
                  </Button>
                  <Button
                    size="icon-xs"
                    onClick={() => void writeParam(param)}
                    disabled={!current || isReadOnly || busy !== null}
                    aria-label={`${t("xvf.config.write")} ${param.name}`}
                  >
                    <Save className="h-3 w-3" />
                  </Button>
                </div>

                <div
                  className="text-muted-foreground truncate text-xs font-[400]"
                  title={param.description}
                >
                  {param.description}
                </div>
              </div>
            );
          })}

          {filteredParams.length === 0 && (
            <div className="text-muted-foreground p-8 text-center text-sm">
              {t("xvf.config.empty")}
            </div>
          )}
        </div>
      </CardContent>

      <AlertDialog
        open={confirmDialog !== null}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmDialog(null);
            setPendingWrite(null);
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
              {getConfirmTitle(confirmDialog, t)}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground/80 leading-relaxed">
              {getConfirmDescription(confirmDialog, t)}
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
              {getConfirmAction(confirmDialog, t)}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function categoryForResid(resid: number): ConfigCategory {
  switch (resid) {
    case CATEGORY_RESID.audio:
      return "audio";
    case CATEGORY_RESID.aec:
      return "aec";
    case CATEGORY_RESID.postproc:
      return "postproc";
    case CATEGORY_RESID.ledGpio:
      return "ledGpio";
    case CATEGORY_RESID.system:
      return "system";
    default:
      return "other";
  }
}

function valuesToDraft(values: XvfValue[]): string {
  return values.map((value) => String(value)).join(", ");
}

function parseDraft(param: ParameterInfo, draft: string): XvfValue[] {
  if (param.kind === "char") {
    return [draft];
  }

  const parts = draft
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 0) {
    throw new Error(`Missing value for ${param.name}`);
  }

  return parts.map((part, index) => {
    const value = Number(part);
    if (!Number.isFinite(value)) {
      throw new Error(`Invalid value at index ${index} for ${param.name}`);
    }
    return value;
  });
}

function isConfigPreset(
  value: ConfigPreset
): value is { version: string; parameters: Record<string, unknown> } {
  return (
    typeof value.version === "string" &&
    value.parameters != null &&
    typeof value.parameters === "object" &&
    !Array.isArray(value.parameters)
  );
}

function validateImportEntries(
  parameters: Record<string, unknown>,
  commands: ParameterInfo[]
): { entries: ImportEntry[]; errors: string[] } {
  const writable = new Map(
    commands
      .filter((param) => param.access === "rw" && !SKIP_ON_IMPORT.has(param.name))
      .map((param) => [param.name, param])
  );
  const entries: ImportEntry[] = [];
  const errors: string[] = [];

  for (const [name, rawValues] of Object.entries(parameters)) {
    const param = writable.get(name);
    if (!param) {
      errors.push(name);
      continue;
    }
    if (!Array.isArray(rawValues) || rawValues.length !== param.length) {
      errors.push(name);
      continue;
    }

    const values = normalizeImportedValues(param, rawValues);
    if (!values) {
      errors.push(name);
      continue;
    }
    entries.push({ param, values });
  }

  return { entries, errors };
}

function normalizeImportedValues(param: ParameterInfo, values: unknown[]): XvfValue[] | null {
  if (param.kind === "char") {
    return values.every((value) => typeof value === "string") ? (values as string[]) : null;
  }

  const normalized: XvfValue[] = [];
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    normalized.push(value);
  }
  return normalized;
}

function summarizeNames(names: string[]): string {
  const preview = names.slice(0, 6).join(", ");
  return names.length > 6 ? `${preview}, +${names.length - 6}` : preview;
}

function getConfirmTitle(confirmDialog: ConfirmDialog, t: (key: string) => string): string {
  if (confirmDialog === "reboot") return t("xvf.confirm.reboot.title");
  if (confirmDialog === "import") return t("xvf.confirm.import.title");
  if (confirmDialog === "restoreDefaults") return t("xvf.confirm.restoreDefaults.title");
  return t("xvf.confirm.saveConfig.title");
}

function getConfirmDescription(confirmDialog: ConfirmDialog, t: (key: string) => string): string {
  if (confirmDialog === "reboot") return t("xvf.confirm.reboot.description");
  if (confirmDialog === "import") return t("xvf.confirm.import.description");
  if (confirmDialog === "restoreDefaults") return t("xvf.confirm.restoreDefaults.description");
  return t("xvf.confirm.saveConfig.description");
}

function getConfirmAction(confirmDialog: ConfirmDialog, t: (key: string) => string): string {
  if (confirmDialog === "reboot") return t("xvf.confirm.reboot.confirm");
  if (confirmDialog === "import") return t("xvf.confirm.import.confirm");
  if (confirmDialog === "restoreDefaults") return t("xvf.confirm.restoreDefaults.confirm");
  return t("xvf.confirm.saveConfig.confirm");
}
