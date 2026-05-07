// XVF3800 USB control module.
//
// Organized into three sub-modules:
// - `parameters` : static command table ported from `xvf_host.py`.
// - `device`     : rusb-based USB transport (open, read, write).
// - `commands`   : Tauri command surface consumed by the renderer.

pub mod commands;
pub mod device;
pub mod parameters;
