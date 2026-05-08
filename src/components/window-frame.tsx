import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useEffect, useState, type ReactNode } from "react";

type WindowFrameProps = {
  titleBar: ReactNode;
  sidebar?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function WindowFrame({
  titleBar,
  sidebar,
  children,
  className,
  contentClassName,
}: WindowFrameProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWebviewWindow();

    appWindow.isMaximized().then(setIsMaximized);

    const unlistenResize = appWindow.onResized(async () => {
      const maximized = await appWindow.isMaximized();
      setIsMaximized(maximized);
    });

    return () => {
      unlistenResize.then((fn) => fn());
    };
  }, []);

  return (
    <ThemeProvider defaultTheme="system" storageKey="tauri-ui-theme">
      <div
        className={cn(
          "bg-background flex h-screen w-screen overflow-hidden",
          isMaximized ? "" : "border-border rounded-lg border",
          sidebar ? "flex-row" : "flex-col",
          className
        )}
      >
        {sidebar}
        <div className="flex min-w-0 flex-1 flex-col">
          {titleBar}
          <main className={cn("min-h-0 flex-1", contentClassName)}>{children}</main>
        </div>
      </div>
    </ThemeProvider>
  );
}
