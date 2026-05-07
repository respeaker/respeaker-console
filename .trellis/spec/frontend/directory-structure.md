# Directory Structure

> How frontend code is organized in this project.

---

## Overview

Single-page Tauri app using pathname-based routing (no SPA router). Each page is a separate Tauri webview window with its own URL path.

---

## Directory Layout

```
src/
├── main.tsx              # Entry: pathname-based lazy page selector
├── index.css             # Global styles + Tailwind v4 theme tokens
├── vite-env.d.ts         # Vite type declarations
├── assets/               # Static assets (SVGs, images)
├── components/
│   ├── ui/               # shadcn/ui primitives (generated, don't edit logic)
│   ├── xvf/              # XVF device-specific panels
│   ├── window-frame.tsx  # App window chrome (title bar + content slot)
│   ├── main-title-bar.tsx
│   ├── title-bar.tsx
│   ├── theme-provider.tsx
│   ├── mode-toggle.tsx
│   ├── language-toggle.tsx
│   ├── shortcut-input.tsx
│   └── updater-dialog.tsx
├── hooks/
│   ├── use-xvf.ts        # XVF device controller hook (core state machine)
│   ├── use-updater.ts    # Auto-updater hook
│   └── use-app-translation.ts
├── i18n/
│   ├── index.ts          # i18next configuration
│   └── locales/
│       ├── en.json
│       └── zh.json
├── lib/
│   ├── utils.ts          # cn() and shared utilities
│   ├── shortcut.ts       # Global shortcut registration
│   ├── updater.ts        # Update checker logic
│   ├── window.ts         # Multi-window helpers
│   └── xvf/              # XVF client layer
│       ├── types.ts      # Shared DTOs (mirror Rust commands)
│       ├── client.ts     # Unified API (invoke or mock)
│       ├── catalog.ts    # Parameter catalog helpers
│       ├── format.ts     # Value formatting
│       └── mock.ts       # In-memory mock for dev/CI
└── pages/
    ├── home.tsx           # Main dashboard (tabs: device/audio/monitor/led/config/logs)
    ├── about.tsx          # About window
    └── settings.tsx       # Settings window
```

---

## Module Organization

- **`components/ui/`** — shadcn/ui primitives. Added via `pnpm dlx shadcn@latest add <name>`. Don't modify internal logic.
- **`components/xvf/`** — Domain-specific panels. Each panel receives the `UseXvfResult` object as prop.
- **`hooks/`** — Custom hooks. One hook per domain concern. `use-xvf.ts` is the central state machine.
- **`lib/xvf/`** — Pure logic layer. No React imports. Handles Tauri invoke calls and mock fallback.
- **`pages/`** — Top-level page components. Each page corresponds to a Tauri window.

---

## Naming Conventions

- Files: `kebab-case.ts` / `kebab-case.tsx`
- Components: `PascalCase` export, `kebab-case` filename
- Hooks: `use-<name>.ts` filename, `use<Name>` export
- Types: co-located in `types.ts` files within their module

---

## Examples

- Well-structured domain module: `src/lib/xvf/` (types → client → mock → format)
- Panel pattern: `src/components/xvf/device-panel.tsx` (receives `xvf` prop, renders UI)
