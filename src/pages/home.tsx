import { lazy, Suspense, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

import { WindowFrame } from "@/components/window-frame";
import { SettingsPanel } from "@/components/settings-panel";
import { UpdaterDialog } from "@/components/updater-dialog";
import { Toaster } from "@/components/ui/sonner";
import { AppSidebar, STORAGE_KEY_TAB, type NavTab } from "@/components/app-sidebar";
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

const ConfigPanel = lazy(() =>
  import("@/components/xvf/config-panel").then((m) => ({ default: m.ConfigPanel }))
);

const SHORTCUT_KEY = "global-shortcut-show-main";

export default function HomePage() {
  const { t } = useAppTranslation();
  const xvf = useXvf();
  const [activeTab, setActiveTab] = useState<NavTab>(() => {
    return (localStorage.getItem(STORAGE_KEY_TAB) as NavTab) || "device";
  });

  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    localStorage.setItem(STORAGE_KEY_TAB, tab);
  };

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
      sidebar={<AppSidebar activeTab={activeTab} onTabChange={handleTabChange} />}
      contentClassName="flex flex-1 flex-col gap-4 overflow-auto p-4 md:p-6"
    >
      <Toaster />
      <UpdaterDialog />

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col">
            <h1 className="text-xl font-semibold tracking-tight text-balance">
              {t("xvf.app.title")}
            </h1>
            <p className="text-muted-foreground text-sm">{t("xvf.app.subtitle")}</p>
          </div>
          <ConnectionStatus
            device={xvf.current}
            firmwareMetadata={xvf.firmwareMetadata}
            mock={xvf.source === "mock"}
            className="w-full max-w-md"
          />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">
        {activeTab === "device" && <DevicePanel xvf={xvf} />}
        {activeTab === "audio" && <AudioPanel xvf={xvf} />}
        {activeTab === "monitor" && <MonitorPanel xvf={xvf} />}
        {activeTab === "led" && <LedPanel xvf={xvf} />}
        {activeTab === "config" && (
          <Suspense
            fallback={<div className="text-muted-foreground p-6 text-sm">{t("xvf.loading")}</div>}
          >
            <ConfigPanel xvf={xvf} />
          </Suspense>
        )}
        {activeTab === "logs" && <LogsPanel xvf={xvf} />}
        {activeTab === "settings" && <SettingsPanel />}
      </div>
    </WindowFrame>
  );
}
