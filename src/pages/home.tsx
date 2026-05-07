import { lazy, Suspense, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Activity, Lightbulb, ScrollText, SlidersHorizontal, UsbIcon, Volume2 } from "lucide-react";

import { WindowFrame } from "@/components/window-frame";
import { MainTitleBar } from "@/components/main-title-bar";
import { UpdaterDialog } from "@/components/updater-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConnectionStatus } from "@/components/xvf/connection-status";
import { DevicePanel } from "@/components/xvf/device-panel";
import { AudioPanel } from "@/components/xvf/audio-panel";
import { MonitorPanel } from "@/components/xvf/monitor-panel";
import { LedPanel } from "@/components/xvf/led-panel";
import { LogsPanel } from "@/components/xvf/logs-panel";
import { registerShortcut } from "@/lib/shortcut";
import { toggleWindow } from "@/lib/window";
import { useAppTranslation } from "@/hooks/use-app-translation";
import { useXvf } from "@/hooks/use-xvf";

// The configuration table is heavy (renders every firmware parameter). Lazy
// load it so the initial dashboard paint stays snappy.
const ConfigPanel = lazy(() =>
  import("@/components/xvf/config-panel").then((m) => ({ default: m.ConfigPanel }))
);

const SHORTCUT_KEY = "global-shortcut-show-main";

export default function HomePage() {
  const { t } = useAppTranslation();
  const xvf = useXvf();

  useEffect(() => {
    const unlistenShortcutChanged = listen<{ shortcut: string }>(
      "shortcut-changed",
      async (event) => {
        const newShortcut = event.payload.shortcut;
        if (newShortcut) {
          await registerShortcut(newShortcut, async () => {
            await toggleWindow("main");
          });
        }
      }
    );

    const initTrayMenu = async () => {
      try {
        await invoke("update_tray_menu", {
          showText: t("tray.show"),
          quitText: t("tray.quit"),
        });
      } catch (error) {
        console.error("Failed to initialize tray menu:", error);
      }
    };
    void initTrayMenu();

    const initShortcut = async () => {
      const savedShortcut = localStorage.getItem(SHORTCUT_KEY);
      if (savedShortcut) {
        await registerShortcut(savedShortcut, async () => {
          await toggleWindow("main");
        });
      }
    };
    void initShortcut();

    return () => {
      unlistenShortcutChanged.then((fn) => fn());
    };
  }, [t]);

  return (
    <WindowFrame
      titleBar={<MainTitleBar />}
      contentClassName="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6"
    >
      <UpdaterDialog />

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">
              {t("xvf.app.title")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("xvf.app.subtitle")}</p>
          </div>
          <ConnectionStatus
            device={xvf.current}
            mock={xvf.source === "mock"}
            className="w-full max-w-md"
          />
        </div>
      </header>

      <Tabs defaultValue="device" className="flex min-h-0 flex-1 flex-col gap-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="device" className="gap-2">
            <UsbIcon className="h-4 w-4" aria-hidden />
            <span>{t("xvf.tabs.device")}</span>
          </TabsTrigger>
          <TabsTrigger value="audio" className="gap-2">
            <Volume2 className="h-4 w-4" aria-hidden />
            <span>{t("xvf.tabs.audio")}</span>
          </TabsTrigger>
          <TabsTrigger value="monitor" className="gap-2">
            <Activity className="h-4 w-4" aria-hidden />
            <span>{t("xvf.tabs.monitor")}</span>
          </TabsTrigger>
          <TabsTrigger value="led" className="gap-2">
            <Lightbulb className="h-4 w-4" aria-hidden />
            <span>{t("xvf.tabs.led")}</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            <span>{t("xvf.tabs.config")}</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ScrollText className="h-4 w-4" aria-hidden />
            <span>{t("xvf.tabs.logs")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="device" className="mt-0">
          <DevicePanel xvf={xvf} />
        </TabsContent>
        <TabsContent value="audio" className="mt-0">
          <AudioPanel xvf={xvf} />
        </TabsContent>
        <TabsContent value="monitor" className="mt-0">
          <MonitorPanel xvf={xvf} />
        </TabsContent>
        <TabsContent value="led" className="mt-0">
          <LedPanel xvf={xvf} />
        </TabsContent>
        <TabsContent value="config" className="mt-0">
          <Suspense
            fallback={<div className="text-muted-foreground p-6 text-sm">{t("xvf.loading")}</div>}
          >
            <ConfigPanel xvf={xvf} />
          </Suspense>
        </TabsContent>
        <TabsContent value="logs" className="mt-0">
          <LogsPanel xvf={xvf} />
        </TabsContent>
      </Tabs>
    </WindowFrame>
  );
}
