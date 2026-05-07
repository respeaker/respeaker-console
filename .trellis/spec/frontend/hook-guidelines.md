# Hook Guidelines

> Custom hooks and data fetching patterns for this project.

---

## Overview

Hooks are the primary state management mechanism. One central hook (`useXvf`) owns all device state; other hooks handle orthogonal concerns (updater, translation).

---

## Central Pattern: Controller Hook

`useXvf()` returns a flat object with all device state and actions:

```typescript
export interface UseXvfResult {
  // State
  devices: DeviceInfo[];
  current: (DeviceInfo & { path: string }) | null;
  loading: boolean;
  error: string | null;
  logs: LogEntry[];
  commands: ParameterInfo[];

  // Actions
  refreshDevices: () => Promise<void>;
  connect: (path: string) => Promise<void>;
  disconnect: () => Promise<void>;
  read: (name: string) => Promise<ReadResult | null>;
  write: (name: string, values: XvfValue[]) => Promise<boolean>;
  // ...
}
```

---

## Custom Hook Patterns

- One hook per domain concern (device, updater, translation)
- Return a flat object (not nested) for easy destructuring
- Actions are `useCallback`-wrapped async functions
- Derived state uses `useMemo`

---

## Data Fetching

- All device communication goes through `@/lib/xvf/client.ts`
- Client handles mock vs. native switching internally
- Hooks never call `invoke()` directly — always go through the client layer
- Errors: set both `error` state and push to log buffer

---

## Naming Conventions

- File: `use-<name>.ts`
- Export: `use<Name>()`
- Return type: `Use<Name>Result`

---

## Cleanup

All subscriptions (`listen`, intervals) must return cleanup functions:

```typescript
useEffect(() => {
  let cancelled = false;
  xvf.onLog(handler).then((fn) => {
    if (cancelled) fn();
    else cleanup = fn;
  });
  return () => { cancelled = true; cleanup?.(); };
}, []);
```

---

## Forbidden Patterns

- No `useEffect` as event handler (use callbacks)
- No state updates after unmount (use `cancelled` flag pattern)
- No hook that calls another hook's action in its own effect without dep tracking
- No external state libraries (Redux, Zustand, etc.)
