# Backend Development Guidelines (Rust / Tauri v2)

> Best practices for the Rust backend in this project.

---

## Overview

Tauri v2 backend providing USB device control via `rusb`. Single-device connection model with a global `Mutex<Option<XvfDevice>>` state.

---

## Guidelines Index

| Guide | Description |
|-------|-------------|
| Architecture | Module structure and data flow |
| Commands | Tauri command conventions |
| Error Handling | Error propagation patterns |
| USB Safety | Device access rules |

---

## Architecture

```
src-tauri/src/
├── main.rs               # Entry point (calls lib::run)
├── lib.rs                # Plugin registration + command handler
├── plugins/
│   ├── mod.rs
│   └── system_tray.rs    # System tray plugin
└── xvf/
    ├── mod.rs            # Module declarations
    ├── parameters.rs     # Static parameter table (from xvf_host.py)
    ├── device.rs         # rusb USB transport layer
    └── commands.rs       # Tauri command surface (DTOs + handlers)
```

---

## Command Conventions

1. All commands prefixed with `xvf_` (e.g., `xvf_read`, `xvf_write`)
2. Commands take `AppHandle` as first param when they need to emit log events
3. Return `Result<T, String>` — Tauri serializes the error to the frontend
4. DTOs are separate structs with `#[derive(Serialize)]` — never expose internal types

```rust
#[tauri::command]
pub fn xvf_read(app: AppHandle, name: String) -> Result<Vec<Value>, String> { ... }
```

---

## Device State

- Single global: `static CURRENT_DEVICE: Lazy<Mutex<Option<XvfDevice>>>`
- Only one device connected at a time (PRD requirement)
- `xvf_connect` drops any existing device before opening new one
- `xvf_disconnect` takes the device out of the mutex

---

## Error Handling

- All USB errors mapped to `String` via `.to_string()` at command boundary
- Internal errors use `XvfError` enum (in `device.rs`)
- Log events emitted via `emit_log()` before returning errors

---

## Logging

- Use `emit_log(&app, level, message)` to push events to the frontend log stream
- Event name: `xvf://log`
- Levels: `"info"`, `"warn"`, `"error"`
- Also logs via `log::info!` for backend-side diagnostics

---

## USB Safety Rules

- Never hold the device mutex lock across await points (all commands are sync)
- Always check `guard.as_ref().ok_or(NotConnected)` before device operations
- Reboot command sleeps 200ms then drops the device handle
- VID filter: `DEFAULT_VID = 0x2886` (XMOS/Seeed)

---

## Pre-Development Checklist

1. [ ] Read `src-tauri/src/xvf/parameters.rs` if adding new device parameters
2. [ ] Mirror any new DTO fields in `src/lib/xvf/types.ts` (frontend)
3. [ ] Register new commands in `lib.rs` `invoke_handler`
4. [ ] Update `capabilities/default.json` if adding new plugins

---

## Quality Check

1. [ ] `cargo build` succeeds without warnings
2. [ ] `cargo clippy` passes
3. [ ] All comments and error messages in English
4. [ ] DTO field names use camelCase via `#[serde(rename = "...")]`
5. [ ] New commands registered in `generate_handler![]`
