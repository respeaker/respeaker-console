# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

Tauri v2 + React 19 + TypeScript (strict) + Tailwind CSS v4 + shadcn/ui. Single central hook (`useXvf`) for device state; pathname-based routing (no SPA router).

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Module organization and file layout | Done |
| [Component Guidelines](./component-guidelines.md) | Component patterns, props, composition | Done |
| [Hook Guidelines](./hook-guidelines.md) | Custom hooks, data fetching patterns | Done |
| [State Management](./state-management.md) | Local state, global state, server state | Done |
| [Quality Guidelines](./quality-guidelines.md) | Code standards, forbidden patterns | Done |
| [Type Safety](./type-safety.md) | Type patterns, validation | Done |

---

## Pre-Development Checklist

Before writing frontend code, verify:

1. [ ] Read the relevant spec files above for the area you're changing
2. [ ] Check `src/lib/xvf/types.ts` if touching device data flow
3. [ ] Check both `en.json` and `zh.json` if adding user-facing text
4. [ ] Use `@/` path alias for all imports

---

## Quality Check

After writing frontend code, verify:

1. [ ] `pnpm format:check` passes
2. [ ] TypeScript compiles without errors
3. [ ] No `any` types introduced
4. [ ] All code comments and logs are in English
5. [ ] New i18n keys added to both locale files
6. [ ] shadcn/ui components not modified internally

---

**Language**: All documentation should be written in **English**.
