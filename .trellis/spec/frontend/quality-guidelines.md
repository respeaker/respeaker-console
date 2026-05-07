# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

TypeScript strict mode, Prettier formatting, English-only comments/logs. No linter configured yet — rely on TypeScript compiler + Prettier.

---

## Language Rules

- All comments MUST be in English
- All console logs MUST be in English
- All error messages MUST be in English
- User-facing text goes through i18n (`t("key")`)

---

## Formatting

```bash
pnpm format        # Format all files
pnpm format:check  # Check without writing
```

Prettier handles all formatting decisions. No manual formatting debates.

---

## Forbidden Patterns

| Pattern | Why |
|---------|-----|
| `any` type | Breaks type safety — use `unknown` + narrowing |
| `// @ts-ignore` | Hides real errors — fix the type instead |
| Inline styles | Use Tailwind classes |
| `console.log` in production | Use the log buffer (`pushLog`) for device operations |
| Chinese/non-English in code | Code must be readable by international contributors |
| Unused imports/variables | Clean up — TypeScript will warn |
| `var` declarations | Use `const` / `let` |

---

## Required Patterns

| Pattern | Where |
|---------|-------|
| `useCallback` for actions | Hook functions passed as props |
| `useMemo` for derived state | Expensive computations |
| Error handling with user feedback | All async operations |
| `cn()` for conditional classes | Component styling |
| Path alias `@/` | All imports |

---

## Testing Requirements

No test framework configured yet. When added:
- Unit tests for `lib/xvf/` pure functions
- Integration tests for Tauri commands via mock

---

## Pre-commit Checklist

1. `pnpm format:check` passes
2. TypeScript compiles without errors (`pnpm build` or IDE)
3. No `any` types introduced
4. All text in code is English
5. New i18n keys added to both `en.json` and `zh.json`
