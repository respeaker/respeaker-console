import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollText, Trash2, Download } from "lucide-react";
import type { UseXvfResult } from "@/hooks/use-xvf";
import type { LogLevel } from "@/lib/xvf/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Props = { xvf: UseXvfResult };

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: "bg-muted text-muted-foreground",
  info: "bg-primary/10 text-primary",
  warn: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  error: "bg-destructive/15 text-destructive",
};

export function LogsPanel({ xvf }: Props) {
  const { t } = useTranslation();
  const [level, setLevel] = useState<"all" | LogLevel>("all");

  const filtered = useMemo(
    () => (level === "all" ? xvf.logs : xvf.logs.filter((l) => l.level === level)),
    [xvf.logs, level],
  );

  const exportLogs = () => {
    const text = xvf.logs
      .map((l) => `[${new Date(l.ts).toISOString()}] ${l.level.toUpperCase()} ${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `respeaker-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <ScrollText className="text-primary h-5 w-5" aria-hidden />
          {t("xvf.logs.title")}
          <Badge variant="outline" className="ml-2">
            {xvf.logs.length}
          </Badge>
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={level} onValueChange={(v) => setLevel(v as typeof level)}>
            <SelectTrigger className="h-8 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("xvf.logs.all")}</SelectItem>
              <SelectItem value="debug">Debug</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warn">Warn</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={exportLogs}
            disabled={xvf.logs.length === 0}
          >
            <Download className="mr-2 h-4 w-4" aria-hidden />
            {t("xvf.logs.export")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={xvf.clearLogs}
            disabled={xvf.logs.length === 0}
          >
            <Trash2 className="mr-2 h-4 w-4" aria-hidden />
            {t("xvf.logs.clear")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <ScrollArea className="h-[420px]">
          <ul className="flex flex-col divide-y font-mono text-xs">
            {filtered.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-1.5">
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {new Date(entry.ts).toLocaleTimeString()}
                </span>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${LEVEL_COLOR[entry.level]}`}
                >
                  {entry.level}
                </span>
                <span className="break-words">{entry.message}</span>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="text-muted-foreground p-6 text-center text-sm">
                {t("xvf.logs.empty")}
              </li>
            )}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
