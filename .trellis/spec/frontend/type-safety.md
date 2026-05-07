# Type Safety

> Type safety patterns in this project.

---

## Overview

TypeScript strict mode enabled. Types mirror Rust DTOs for the Tauri bridge layer. No runtime validation library — trust the Tauri invoke boundary.

---

## Type Organization

| Location | Purpose |
|----------|---------|
| `src/lib/xvf/types.ts` | Shared DTOs (mirror Rust `#[derive(Serialize)]` structs) |
| Hook files (`use-*.ts`) | Hook return types (`Use<Name>Result`) |
| Component files | Props interfaces (co-located, not exported separately) |

---

## Tauri Bridge Types

Types in `lib/xvf/types.ts` must exactly mirror the Rust command return types:

```typescript
// Must match src-tauri/src/xvf/commands.rs DeviceInfo
export interface DeviceInfo {
  vid: number;
  pid: number;
  bus: number;
  address: number;
  manufacturer: string | null;
  product: string | null;
  serial: string | null;
  vidHex: string;
  pidHex: string;
}
```

When Rust types change, update TypeScript types to match.

---

## Discriminated Unions

Use string literal unions for known sets:

```typescript
export type ParameterAccess = "ro" | "wo" | "rw";
export type ParameterKind = "uint8" | "uint16" | "uint32" | "int32" | "float" | "radians" | "char";
export type LogLevel = "info" | "warn" | "error" | "debug";
```

---

## Type Guards

Use type-narrowing functions for runtime checks:

```typescript
export function isNumericKind(kind: ParameterKind): boolean {
  return kind !== "char";
}
```

---

## Generic Patterns

- `invoke<T>()` with explicit return type at call site
- `Record<string, T>` for dynamic key maps
- Intersection types for augmenting base types: `DeviceInfo & { path: string }`

---

## Forbidden Patterns

- `any` — use `unknown` and narrow
- Type assertions (`as T`) except for DOM element types (`as HTMLElement`)
- Non-null assertions (`!`) — check for null explicitly
- `// @ts-ignore` or `// @ts-expect-error` — fix the type
- Exporting types from component files — keep them co-located
