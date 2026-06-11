import { useCallback, useEffect, useMemo, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  Github,
  Info,
  Keyboard,
  Languages,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  Sun,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ShortcutInput } from "@/components/shortcut-input";
import { useTheme } from "@/components/theme-provider";
import { useManualUpdateCheck } from "@/components/updater-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { registerShortcut, unregisterShortcut } from "@/lib/shortcut";
import { cn } from "@/lib/utils";
import { toggleWindow } from "@/lib/window";
import packageJson from "../../package.json";

const SHORTCUT_KEY = "global-shortcut-show-main";

type SettingsSection = "general" | "shortcuts" | "about";
type SupportedLanguage = "en" | "zh";

const techVersions = {
  tauri: packageJson.dependencies["@tauri-apps/api"].replace(/^\^/, "v"),
  react: packageJson.dependencies.react.replace(/^\^/, "v"),
  typescript: packageJson.devDependencies.typescript.replace(/^~/, "v"),
};

export function SettingsPanel() {
  const { i18n, t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const { checkUpdate, checking, showNoUpdate } = useManualUpdateCheck();
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [shortcut, setShortcut] = useState("");
  const [appVersion, setAppVersion] = useState("");

  const currentLanguage: SupportedLanguage = i18n.language.startsWith("zh") ? "zh" : "en";

  const handleShowMainWindow = useCallback(async () => {
    await toggleWindow("main");
  }, []);

  useEffect(() => {
    const savedShortcut = localStorage.getItem(SHORTCUT_KEY);
    if (savedShortcut) {
      setShortcut(savedShortcut);
      void registerShortcut(savedShortcut, handleShowMainWindow);
    }
  }, [handleShowMainWindow]);

  useEffect(() => {
    void getVersion().then(setAppVersion);
  }, []);

  const menuItems = useMemo(
    () => [
      {
        id: "general" as const,
        label: t("settings.nav.general"),
        icon: Palette,
      },
      {
        id: "shortcuts" as const,
        label: t("settings.nav.shortcuts"),
        icon: Keyboard,
      },
      {
        id: "about" as const,
        label: t("settings.nav.about"),
        icon: Info,
      },
    ],
    [t]
  );

  const handleShortcutChange = async (newShortcut: string) => {
    const oldShortcut = shortcut;
    setShortcut(newShortcut);

    if (newShortcut) {
      localStorage.setItem(SHORTCUT_KEY, newShortcut);
      await registerShortcut(newShortcut, handleShowMainWindow, oldShortcut);
      await emit("shortcut-changed", { shortcut: newShortcut });
      toast.success(t("settings.shortcut.setSuccess", { shortcut: newShortcut }));
      return;
    }

    localStorage.removeItem(SHORTCUT_KEY);
    if (oldShortcut) {
      await unregisterShortcut(oldShortcut);
    }
    await emit("shortcut-changed", { shortcut: "" });
    toast.info(t("settings.shortcut.cleared"));
  };

  const handleLanguageChange = async (language: SupportedLanguage) => {
    await i18n.changeLanguage(language);

    try {
      await invoke("update_tray_menu", {
        showText: t("tray.show", { lng: language }),
        quitText: t("tray.quit", { lng: language }),
      });
    } catch (error) {
      console.error("Failed to update tray menu:", error);
    }

    await emit("language-changed", { language });
  };

  const handleOpenGithub = async () => {
    await openUrl("https://github.com/Wkstr/reSpeaker_desktop_app");
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border">
      <aside className="bg-muted/20 flex w-48 shrink-0 flex-col border-r p-3">
        <div className="px-2 pb-3">
          <h2 className="text-base font-semibold">{t("settings.title")}</h2>
          <p className="text-muted-foreground mt-1 text-xs">{t("settings.description")}</p>
        </div>

        <nav className="space-y-1">
          {menuItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveSection(id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                activeSection === id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1 overflow-auto p-5">
        {activeSection === "general" && (
          <div className="max-w-3xl space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t("settings.general.title")}</h3>
              <p className="text-muted-foreground text-sm">{t("settings.general.description")}</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.appearance.theme")}</CardTitle>
                <CardDescription>{t("settings.general.themeDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  variant={theme === "light" ? "default" : "outline"}
                  onClick={() => setTheme("light")}
                  className="gap-2"
                >
                  <Sun className="h-4 w-4" />
                  {t("settings.appearance.light")}
                </Button>
                <Button
                  variant={theme === "dark" ? "default" : "outline"}
                  onClick={() => setTheme("dark")}
                  className="gap-2"
                >
                  <Moon className="h-4 w-4" />
                  {t("settings.appearance.dark")}
                </Button>
                <Button
                  variant={theme === "system" ? "default" : "outline"}
                  onClick={() => setTheme("system")}
                  className="gap-2"
                >
                  <Monitor className="h-4 w-4" />
                  {t("settings.appearance.system")}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.appearance.language")}</CardTitle>
                <CardDescription>{t("settings.general.languageDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  variant={currentLanguage === "en" ? "default" : "outline"}
                  onClick={() => void handleLanguageChange("en")}
                  className="gap-2"
                >
                  <Languages className="h-4 w-4" />
                  {t("language.en")}
                </Button>
                <Button
                  variant={currentLanguage === "zh" ? "default" : "outline"}
                  onClick={() => void handleLanguageChange("zh")}
                  className="gap-2"
                >
                  <Languages className="h-4 w-4" />
                  {t("language.zh")}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === "shortcuts" && (
          <div className="max-w-3xl space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t("settings.shortcut.title")}</h3>
              <p className="text-muted-foreground text-sm">{t("settings.shortcut.description")}</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.shortcut.showMain")}</CardTitle>
                <CardDescription>{t("settings.shortcut.showMainDesc")}</CardDescription>
              </CardHeader>
              <CardContent>
                <ShortcutInput
                  value={shortcut}
                  onChange={(value) => void handleShortcutChange(value)}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {activeSection === "about" && (
          <div className="max-w-3xl space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t("about.appName")}</h3>
              <p className="text-muted-foreground text-sm">{t("settings.about.description")}</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{t("settings.about.versionInfo")}</CardTitle>
                <CardDescription>{t("settings.about.versionDescription")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <VersionRow label={t("about.version")} value={appVersion || "-"} />
                <Separator />
                <VersionRow label="Tauri" value={techVersions.tauri} />
                <VersionRow label="React" value={techVersions.react} />
                <VersionRow label="TypeScript" value={techVersions.typescript} />
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleOpenGithub} variant="outline" className="gap-2">
                <Github className="h-4 w-4" />
                GitHub
              </Button>
              <Button
                onClick={() => void checkUpdate()}
                variant="outline"
                disabled={checking}
                className="gap-2"
              >
                <RefreshCw className={cn("h-4 w-4", checking && "animate-spin")} />
                {checking ? t("updater.checking") : t("updater.checkForUpdates")}
              </Button>
              {showNoUpdate && <Badge variant="success">{t("updater.upToDate")}</Badge>}
            </div>

            <p className="text-muted-foreground text-xs">{t("about.copyright")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function VersionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
