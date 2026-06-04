import { useState, useEffect } from "react";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  ScrollText,
  Settings,
  SlidersHorizontal,
  UsbIcon,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export type NavTab = "device" | "audio" | "monitor" | "led" | "config" | "logs" | "settings";

const NAV_ITEMS: { id: NavTab; icon: typeof UsbIcon; labelKey: string }[] = [
  { id: "device", icon: UsbIcon, labelKey: "xvf.tabs.device" },
  { id: "audio", icon: Volume2, labelKey: "xvf.tabs.audio" },
  { id: "monitor", icon: Activity, labelKey: "xvf.tabs.monitor" },
  { id: "led", icon: Lightbulb, labelKey: "xvf.tabs.led" },
  { id: "config", icon: SlidersHorizontal, labelKey: "xvf.tabs.config" },
  { id: "logs", icon: ScrollText, labelKey: "xvf.tabs.logs" },
];

const STORAGE_KEY_COLLAPSED = "sidebar-collapsed";
const STORAGE_KEY_TAB = "sidebar-active-tab";

interface AppSidebarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  className?: string;
}

export function AppSidebar({ activeTab, onTabChange, className }: AppSidebarProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(STORAGE_KEY_COLLAPSED) === "true";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_COLLAPSED, String(collapsed));
  }, [collapsed]);

  return (
    <aside
      className={cn(
        "border-border/40 bg-background/95 flex flex-col border-r transition-[width] duration-200",
        collapsed ? "w-12" : "w-44",
        className
      )}
    >
      {/* Logo area */}
      <div className="border-border/40 flex h-8 items-center justify-center border-b px-2">
        {!collapsed && (
          <span className="text-foreground truncate text-xs font-semibold tracking-tight">
            ReSpeaker
          </span>
        )}
        {collapsed && <span className="text-foreground text-xs font-bold">RC</span>}
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-0.5 p-1.5">
        {NAV_ITEMS.map(({ id, icon: Icon, labelKey }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              activeTab === id ? "bg-accent text-accent-foreground" : "text-muted-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{t(labelKey)}</span>}
          </button>
        ))}
      </nav>

      <div className="border-border/40 space-y-1.5 border-t p-1.5">
        <button
          type="button"
          onClick={() => onTabChange("settings")}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
            "hover:bg-accent hover:text-accent-foreground",
            activeTab === "settings" ? "bg-accent text-accent-foreground" : "text-muted-foreground",
            collapsed && "justify-center px-0"
          )}
          aria-label={t("settings.button")}
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="truncate">{t("settings.button")}</span>}
        </button>

        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center justify-center rounded-md px-2.5 py-1.5 transition-colors"
          aria-label={collapsed ? t("settings.sidebar.expand") : t("settings.sidebar.collapse")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}

export { STORAGE_KEY_TAB };
