# ReSpeaker Console UI Overhaul

## Summary

Redesign the main window navigation from horizontal tabs to a full-height collapsible left sidebar, fix display issues in Settings/About windows, rename the app to "ReSpeaker Console", clean up template leftovers, and add parameter preset export/import.

---

## 1. Left Sidebar Navigation

### Layout

- Full-height sidebar spanning the entire window height (including title bar area)
- Sidebar top: app logo/icon
- Title bar sits to the right of the sidebar, contains: drag region, Settings gear, About info, LanguageToggle, ThemeToggle, window controls (min/max/close)
- Content area fills remaining space to the right

### Expanded State (~180px width)

- Logo at top
- Navigation items: icon + label for each tab (Device, Audio, Monitor, LEDs, Parameters, Logs)
- Collapse toggle button at bottom (chevron left)

### Collapsed State (~48px width)

- Small logo/icon at top
- Navigation items: icon only (no labels, no tooltips required initially)
- Expand toggle button at bottom (chevron right)

### Behavior

- Manual toggle only (click collapse/expand button)
- Persist collapsed/expanded state to localStorage
- Persist last active tab to localStorage
- Active tab visually highlighted
- Smooth transition animation on collapse/expand

---

## 2. Settings/About Display Fix

- Keep as separate Tauri windows (no change to window architecture)
- Fix layout overflow: ensure all content is visible by making content areas scrollable
- Do NOT change window sizes — fix the content layout to fit and scroll within current dimensions
- Settings: 600x500, About: 500x400

---

## 3. App Rename to "ReSpeaker Console"

### Update locations

- `tauri.conf.json`: `productName`, `mainBinaryName`, window title
- `package.json`: `name` field → `respeaker-console`
- `Cargo.toml`: package name if applicable
- i18n `en.json` / `zh.json`:
  - `app.title` → "ReSpeaker Console"
  - `about.appName` → "ReSpeaker Console"
- About page: update GitHub URL to `https://github.com/Wkstr/reSpeaker_desktop_app`
- Tray menu title if applicable

### Cleanup template leftovers

- Remove `greet.*` i18n namespace from both locale files
- Remove any greet-related dead code (commands, UI references)

---

## 4. App Icon

- User will provide a 1024x1024 PNG source icon
- Place source at `src-tauri/icons/icon.png`
- Run `cargo tauri icon` to generate all platform sizes
- **Status: BLOCKED** — waiting for icon file from user. Skip this step during implementation; document how to do it.

---

## 5. Preset Export/Import (Parameters Tab)

### UI

- Two buttons in the Parameters tab toolbar area: "Export Config" and "Import Config"
- Positioned near existing action buttons (Save/Reboot)

### Export Config

1. Read all device parameters (full snapshot)
2. Serialize to JSON with metadata (device info, timestamp, app version)
3. Open system "Save" file dialog (Tauri `dialog.save()`)
4. Write JSON to user-chosen path

### Import Config

1. Open system "Open" file dialog (Tauri `dialog.open()`, filter: `*.json`)
2. Parse JSON, validate structure
3. Write all parameters to device sequentially
4. Show progress and success/failure result
5. Confirmation dialog before applying ("This will overwrite current device settings")

### JSON Format

```json
{
  "version": "1.0",
  "app_version": "0.2.3",
  "exported_at": "2026-05-07T12:00:00Z",
  "device": {
    "product_name": "...",
    "firmware_version": "..."
  },
  "parameters": {
    "PARAM_NAME": value,
    ...
  }
}
```

---

## Non-Goals

- No icon change in this task (blocked on asset)
- No new sidebar tabs (Presets is NOT a new tab)
- No routing library (keep current pathname-based approach)
- No changes to separate-window architecture for Settings/About
