import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import { type ReactNode } from "react";

type WindowFrameProps = {
  titleBar?: ReactNode;
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
  return (
    <ThemeProvider defaultTheme="system" storageKey="tauri-ui-theme">
      <div
        className={cn(
          "bg-background flex h-screen w-screen overflow-hidden",
          sidebar ? "flex-row" : "flex-col",
          className
        )}
      >
        {sidebar}
        <div className="flex min-w-0 flex-1 flex-col">
          {titleBar && titleBar}
          <main className={cn("min-h-0 flex-1", contentClassName)}>{children}</main>
        </div>
      </div>
    </ThemeProvider>
  );
}
