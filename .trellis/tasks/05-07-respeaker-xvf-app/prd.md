# ReSpeaker XVF3800 — DOA Compass + Dangerous Operation Confirmation

## Goal

Add two features to the existing ReSpeaker XVF3800 desktop app:
1. **DOA polar/compass visualization** in the Monitor panel
2. **Confirmation dialogs** for dangerous operations (reboot, save-to-flash)

## Requirements

### Feature 1: DOA Compass Visualization

Add a polar/compass diagram to the Monitor panel that visually represents the sound source direction (DOA angle).

**Current state**: `monitor-panel.tsx` displays DOA as a numeric value (`StatCard`) and plots beam energy + VAD on a time-series canvas chart. There is no directional/polar visualization.

**Target**:
- Add a circular compass component showing the DOA angle as a directional indicator
- The compass shows 0°–360° with cardinal markers (N/E/S/W or 0°/90°/180°/270°)
- A line/arrow from center pointing at the current DOA angle
- VAD state visually indicated (e.g., arrow color: active=green, idle=gray)
- Updates in real-time with the existing polling loop (no new data source needed)
- Responsive size, fits alongside existing stat cards
- Works in both light and dark theme

**Technical approach**:
- New component: `src/components/xvf/doa-compass.tsx`
- Renders as an SVG (resolution-independent, theme-friendly)
- Props: `angle: number`, `vadActive: boolean`
- Placed in the Monitor panel above or alongside the stat cards grid

### Feature 2: Dangerous Operation Confirmation Dialogs

Add confirmation dialogs before executing potentially destructive operations.

**Current state**: 
- `device-panel.tsx` has a "Reboot" button (variant="destructive") that calls `reboot()` directly with no confirmation
- `config-panel.tsx` has write functionality for SAVE_CONFIGURATION and REBOOT parameters (via the generic write command), also with no confirmation

**Target**:
- Reboot button in DevicePanel: show a confirmation dialog before executing
- SAVE_CONFIGURATION write in ConfigPanel: show a confirmation dialog before executing
- Dialog content: warning icon, clear description of what will happen, cancel/confirm buttons
- Use shadcn/ui `Dialog` component (already imported in project)
- i18n for all dialog text (en + zh)

**Technical approach**:
- Wrap the reboot action in DevicePanel with an `AlertDialog` from shadcn/ui
- For ConfigPanel, intercept `doWrite` when `selected.name` is `"SAVE_CONFIGURATION"` or `"REBOOT"`
- Reusable pattern: a `ConfirmDialog` component or inline `AlertDialog` usage

## Acceptance Criteria

- [ ] DOA compass renders a circular indicator with current angle
- [ ] Compass arrow/indicator updates in real-time with polling data
- [ ] VAD state reflected visually on the compass (color change)
- [ ] Compass works in light and dark themes
- [ ] Reboot button shows confirmation dialog before executing
- [ ] Writing SAVE_CONFIGURATION shows confirmation dialog before executing
- [ ] Writing REBOOT from config panel shows confirmation dialog before executing
- [ ] All new UI text has i18n keys in both en.json and zh.json
- [ ] TypeScript compiles without errors
- [ ] `pnpm format:check` passes

## Definition of Done

- TypeScript compiles without errors
- `pnpm format:check` passes
- App runs in dev mode without console errors
- All user-facing text is i18n'd (en + zh)
- Compass visible in Monitor tab when device connected or in mock mode

## Out of Scope

- DOA history trail / heatmap
- Compass animation/smoothing between samples
- Diagnostic export (separate task)
- Factory reset (separate task)
- Changes to the Rust backend (no new commands needed)

## Technical Notes

- Monitor panel data source: `readMany(["DOA_VALUE", ...])` — index 0 is angle (degrees), index 1 is VAD
- shadcn/ui AlertDialog: already available via `pnpm dlx shadcn@latest add alert-dialog`
- Existing Dialog component at `src/components/ui/dialog.tsx`
- Theme CSS variables: `--primary`, `--muted-foreground`, `--destructive` (usable in SVG via `currentColor` or `hsl(var(...))`)
- Mock data provides random DOA angles, so compass will work in mock mode

## Files to modify

- `src/components/xvf/monitor-panel.tsx` — integrate compass component
- `src/components/xvf/device-panel.tsx` — add confirmation for reboot
- `src/components/xvf/config-panel.tsx` — add confirmation for dangerous writes
- `src/i18n/locales/en.json` — new keys
- `src/i18n/locales/zh.json` — new keys

## Files to create

- `src/components/xvf/doa-compass.tsx` — SVG compass component
