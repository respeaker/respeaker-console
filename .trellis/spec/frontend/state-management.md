# State Management

> How state is managed in this project.

---

## Overview

Pure React state — no external state libraries. The `useXvf` hook is the single source of truth for all device-related state. Each page manages its own local UI state.

---

## State Categories

| Category | Where | Example |
|----------|-------|---------|
| Device state | `useXvf()` hook | connected device, parameters, logs |
| UI state | Component-local `useState` | tab selection, form inputs, modals |
| Persisted prefs | `localStorage` | global shortcut key, language |
| Theme | `ThemeProvider` context | light/dark mode |

---

## Architecture

```
useXvf() ─── single hook instance in HomePage
    │
    ├── DevicePanel   (receives xvf prop)
    ├── AudioPanel    (receives xvf prop)
    ├── MonitorPanel  (receives xvf prop)
    ├── LedPanel      (receives xvf prop)
    ├── ConfigPanel   (receives xvf prop)
    └── LogsPanel     (receives xvf prop)
```

One hook instance, passed as prop to all panels. No context provider for device state.

---

## When to Use Context

Only for cross-cutting concerns that every component needs:
- Theme (light/dark)
- i18n language

Never for domain state — pass via props from the hook.

---

## Derived State

Use `useMemo` for expensive derivations:

```typescript
const source: XvfSource = useMemo(() => (xvf.isMockEnv() ? "mock" : "native"), []);
```

Never use `useEffect` + `setState` to derive state from other state.

---

## Persistence

- `localStorage` for user preferences (shortcut keys, language)
- No database, no server state cache
- Device state is ephemeral — lost on disconnect

---

## Forbidden Patterns

- No Redux, Zustand, Jotai, or any external state library
- No React Context for domain/device state
- No `useEffect` to sync derived state
- No global mutable variables for state
