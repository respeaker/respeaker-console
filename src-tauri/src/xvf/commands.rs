// Tauri command surface exposed to the renderer.
//
// Keeps the USB interaction strictly inside the Rust process, so the UI only
// deals with JSON serializable values. A single connected device is held in a
// Mutex to honour the "one device at a time" rule from the PRD.

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};

use super::device::{
    list_devices_with_vid, DeviceDescriptor, ReadValue, XvfDevice, XvfError, DEFAULT_VID,
};
use super::parameters::{self, Parameter};

static CURRENT_DEVICE: Lazy<Mutex<Option<XvfDevice>>> = Lazy::new(|| Mutex::new(None));

// ----- Serializable DTOs -----

#[derive(Debug, Clone, Serialize)]
pub struct DeviceInfoDto {
    pub vid: u16,
    pub pid: u16,
    pub bus: u8,
    pub address: u8,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial: Option<String>,
    #[serde(rename = "vidHex")]
    pub vid_hex: String,
    #[serde(rename = "pidHex")]
    pub pid_hex: String,
}

impl From<&DeviceDescriptor> for DeviceInfoDto {
    fn from(d: &DeviceDescriptor) -> Self {
        Self {
            vid: d.vid,
            pid: d.pid,
            bus: d.bus,
            address: d.address,
            manufacturer: d.manufacturer.clone(),
            product: d.product.clone(),
            serial: d.serial.clone(),
            vid_hex: format!("0x{:04x}", d.vid),
            pid_hex: format!("0x{:04x}", d.pid),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ParameterDto {
    pub name: &'static str,
    pub resid: u8,
    pub cmdid: u8,
    pub length: u16,
    pub access: &'static str,
    pub kind: &'static str,
    pub description: &'static str,
}

impl From<&Parameter> for ParameterDto {
    fn from(p: &Parameter) -> Self {
        Self {
            name: p.name,
            resid: p.resid,
            cmdid: p.cmdid,
            length: p.length,
            access: p.access,
            kind: p.kind,
            description: p.description,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct LogEvent {
    pub level: String,
    pub message: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct DfuCheckResult {
    pub available: bool,
    pub executable: String,
    #[serde(rename = "versionOutput")]
    pub version_output: String,
    #[serde(rename = "listOutput")]
    pub list_output: String,
    pub hint: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DfuOutputEvent {
    pub stream: String,
    pub line: String,
    pub timestamp: String,
}

fn emit_log(app: &AppHandle, level: &str, message: String) {
    log::info!("[xvf:log][{}] {}", level, message);
    let evt = LogEvent {
        level: level.to_string(),
        message,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    let _ = app.emit("xvf://log", &evt);
}

fn emit_dfu_output(app: &AppHandle, stream: &str, line: String) {
    let event = DfuOutputEvent {
        stream: stream.to_string(),
        line,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    let _ = app.emit("xvf://dfu-output", &event);
}

fn dfu_hint() -> Option<String> {
    #[cfg(target_os = "linux")]
    {
        return Some(
            "Install dfu-util and ensure USB permissions are available; you may need udev rules or sudo."
                .to_string(),
        );
    }
    #[cfg(target_os = "macos")]
    {
        return Some(
            "Install dfu-util with Homebrew or MacPorts. Common paths: /opt/homebrew/bin/dfu-util, /usr/local/bin/dfu-util, /opt/local/bin/dfu-util."
                .to_string(),
        );
    }
    #[cfg(target_os = "windows")]
    {
        return Some("Bundle dfu-util.exe with the application or place it on PATH.".to_string());
    }
    #[allow(unreachable_code)]
    None
}

fn resolve_dfu_util() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let bundled = dir.join("dfu-util");
                if bundled.exists() {
                    return bundled;
                }
            }
        }

        for candidate in [
            "/opt/homebrew/bin/dfu-util",
            "/opt/homebrew/opt/dfu-util/bin/dfu-util",
            "/usr/local/bin/dfu-util",
            "/usr/local/opt/dfu-util/bin/dfu-util",
            "/opt/local/bin/dfu-util",
            "/opt/local/sbin/dfu-util",
        ] {
            let path = PathBuf::from(candidate);
            if path.exists() {
                return path;
            }
        }

        return PathBuf::from("dfu-util");
    }

    #[cfg(target_os = "windows")]
    {
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let adjacent = dir.join("dfu-util.exe");
                if adjacent.exists() {
                    return adjacent;
                }
                let bundled = dir.join("binaries").join("dfu-util.exe");
                if bundled.exists() {
                    return bundled;
                }
            }
        }
        return PathBuf::from("dfu-util.exe");
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        PathBuf::from("dfu-util")
    }
}

fn read_values_to_json(values: Vec<ReadValue>) -> Vec<Value> {
    values
        .into_iter()
        .map(|v| match v {
            ReadValue::U8(x) => Value::from(x),
            ReadValue::U16(x) => Value::from(x),
            ReadValue::U32(x) => Value::from(x),
            ReadValue::I32(x) => Value::from(x),
            ReadValue::Float(x) => serde_json::Number::from_f64(x as f64)
                .map(Value::Number)
                .unwrap_or(Value::Null),
            ReadValue::Str(s) => Value::String(s),
        })
        .collect()
}

fn normalize_values(param: &Parameter, values: Vec<Value>) -> Result<Vec<f64>, String> {
    if values.len() != param.length as usize {
        return Err(format!(
            "{} expects {} value(s), got {}",
            param.name,
            param.length,
            values.len()
        ));
    }
    let mut out = Vec::with_capacity(values.len());
    for v in values {
        let n = match v {
            Value::Number(n) => n
                .as_f64()
                .ok_or_else(|| "cannot convert number to f64".to_string())?,
            Value::Bool(b) => {
                if b {
                    1.0
                } else {
                    0.0
                }
            }
            Value::String(s) => s
                .parse::<f64>()
                .map_err(|e| format!("cannot parse '{}' as number: {}", s, e))?,
            other => return Err(format!("unsupported value type: {:?}", other)),
        };
        out.push(n);
    }
    Ok(out)
}

// ----- Tauri commands -----

#[tauri::command]
pub fn xvf_list_commands() -> Vec<ParameterDto> {
    parameters::PARAMETERS
        .iter()
        .map(ParameterDto::from)
        .collect()
}

#[tauri::command]
pub fn xvf_list_devices(app: AppHandle, vid: Option<u16>) -> Result<Vec<DeviceInfoDto>, String> {
    let vid = vid.unwrap_or(DEFAULT_VID);
    match list_devices_with_vid(vid) {
        Ok(devs) => {
            emit_log(
                &app,
                "info",
                format!(
                    "Scanned USB bus for vid=0x{:04x}, found {} device(s)",
                    vid,
                    devs.len()
                ),
            );
            Ok(devs.iter().map(DeviceInfoDto::from).collect())
        }
        Err(e) => {
            emit_log(&app, "error", format!("Failed to list devices: {}", e));
            Err(e.to_string())
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct ConnectArgs {
    pub vid: Option<u16>,
    pub pid: Option<u16>,
    pub bus: Option<u8>,
    pub address: Option<u8>,
}

#[tauri::command]
pub fn xvf_connect(app: AppHandle, args: ConnectArgs) -> Result<DeviceInfoDto, String> {
    let mut guard = CURRENT_DEVICE
        .lock()
        .map_err(|e| format!("lock poisoned: {}", e))?;

    // Enforce single-connection rule: drop any previous device.
    if guard.is_some() {
        emit_log(
            &app,
            "info",
            "Closing previous device before reconnecting".into(),
        );
        guard.take();
    }

    let vid = args.vid.unwrap_or(DEFAULT_VID);
    let bus_address = match (args.bus, args.address) {
        (Some(b), Some(a)) => Some((b, a)),
        _ => None,
    };

    let device = XvfDevice::open(vid, args.pid, bus_address).map_err(|e| {
        emit_log(&app, "error", format!("Connect failed: {}", e));
        e.to_string()
    })?;

    let dto = DeviceInfoDto::from(device.descriptor());
    emit_log(
        &app,
        "info",
        format!(
            "Connected to {} {} ({}) bus={} addr={}",
            dto.manufacturer
                .clone()
                .unwrap_or_else(|| "<unknown>".into()),
            dto.product.clone().unwrap_or_else(|| "<unknown>".into()),
            dto.serial.clone().unwrap_or_else(|| "<no serial>".into()),
            dto.bus,
            dto.address
        ),
    );
    *guard = Some(device);
    Ok(dto)
}

#[tauri::command]
pub fn xvf_disconnect(app: AppHandle) -> Result<(), String> {
    let mut guard = CURRENT_DEVICE
        .lock()
        .map_err(|e| format!("lock poisoned: {}", e))?;
    if guard.take().is_some() {
        emit_log(&app, "info", "Disconnected from device".into());
    }
    Ok(())
}

#[tauri::command]
pub fn xvf_current_device() -> Result<Option<DeviceInfoDto>, String> {
    let guard = CURRENT_DEVICE
        .lock()
        .map_err(|e| format!("lock poisoned: {}", e))?;
    Ok(guard.as_ref().map(|d| DeviceInfoDto::from(d.descriptor())))
}

#[tauri::command]
pub fn xvf_read(app: AppHandle, name: String) -> Result<Vec<Value>, String> {
    let param = parameters::find(&name).ok_or_else(|| format!("Unknown parameter: {}", name))?;
    let guard = CURRENT_DEVICE
        .lock()
        .map_err(|e| format!("lock poisoned: {}", e))?;
    let dev = guard
        .as_ref()
        .ok_or_else(|| XvfError::NotConnected.to_string())?;
    match dev.read_parameter(param) {
        Ok(values) => Ok(read_values_to_json(values)),
        Err(e) => {
            emit_log(&app, "error", format!("Read {} failed: {}", name, e));
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn xvf_write(app: AppHandle, name: String, values: Vec<Value>) -> Result<(), String> {
    let param = parameters::find(&name).ok_or_else(|| format!("Unknown parameter: {}", name))?;
    let floats = normalize_values(param, values)?;
    let guard = CURRENT_DEVICE
        .lock()
        .map_err(|e| format!("lock poisoned: {}", e))?;
    let dev = guard
        .as_ref()
        .ok_or_else(|| XvfError::NotConnected.to_string())?;
    match dev.write_parameter(param, &floats) {
        Ok(()) => {
            emit_log(&app, "info", format!("Write {} = {:?}", name, floats));
            Ok(())
        }
        Err(e) => {
            emit_log(&app, "error", format!("Write {} failed: {}", name, e));
            Err(e.to_string())
        }
    }
}

#[tauri::command]
pub fn xvf_read_many(app: AppHandle, names: Vec<String>) -> Vec<ReadManyResult> {
    let guard = match CURRENT_DEVICE.lock() {
        Ok(g) => g,
        Err(e) => {
            emit_log(&app, "error", format!("lock poisoned: {}", e));
            return Vec::new();
        }
    };
    let dev = match guard.as_ref() {
        Some(d) => d,
        None => {
            return names
                .into_iter()
                .map(|name| ReadManyResult {
                    name,
                    ok: false,
                    values: Vec::new(),
                    error: Some(XvfError::NotConnected.to_string()),
                })
                .collect();
        }
    };

    names
        .into_iter()
        .map(|name| match parameters::find(&name) {
            Some(p) => match dev.read_parameter(p) {
                Ok(vs) => ReadManyResult {
                    name,
                    ok: true,
                    values: read_values_to_json(vs),
                    error: None,
                },
                Err(e) => ReadManyResult {
                    name,
                    ok: false,
                    values: Vec::new(),
                    error: Some(e.to_string()),
                },
            },
            None => ReadManyResult {
                name: name.clone(),
                ok: false,
                values: Vec::new(),
                error: Some(format!("Unknown parameter: {}", name)),
            },
        })
        .collect()
}

#[derive(Debug, Serialize)]
pub struct ReadManyResult {
    pub name: String,
    pub ok: bool,
    pub values: Vec<Value>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn xvf_reboot_device(app: AppHandle) -> Result<(), String> {
    // Send the REBOOT command and then drop the handle because the device will
    // re-enumerate. The renderer is expected to refresh its device list.
    {
        let guard = CURRENT_DEVICE
            .lock()
            .map_err(|e| format!("lock poisoned: {}", e))?;
        let dev = guard
            .as_ref()
            .ok_or_else(|| XvfError::NotConnected.to_string())?;
        let param =
            parameters::find("REBOOT").ok_or_else(|| "REBOOT command missing".to_string())?;
        dev.write_parameter(param, &[1.0])
            .map_err(|e| e.to_string())?;
    }
    emit_log(
        &app,
        "warn",
        "Rebooting device; USB connection will be reset".into(),
    );
    std::thread::sleep(Duration::from_millis(200));
    if let Ok(mut guard) = CURRENT_DEVICE.lock() {
        guard.take();
    }
    Ok(())
}

#[tauri::command]
pub fn xvf_check_dfu_util(app: AppHandle) -> Result<DfuCheckResult, String> {
    let executable = resolve_dfu_util();
    let executable_display = executable.to_string_lossy().to_string();

    let version_output = Command::new(&executable)
        .arg("--version")
        .output()
        .map(|output| combine_output(&output.stdout, &output.stderr))
        .unwrap_or_default();

    let list = Command::new(&executable).arg("-l").output();
    match list {
        Ok(output) => {
            let list_output = combine_output(&output.stdout, &output.stderr);
            let available = output.status.success() || !list_output.is_empty();
            if available {
                emit_log(
                    &app,
                    "info",
                    format!("dfu-util found: {}", executable_display),
                );
            } else {
                emit_log(
                    &app,
                    "warn",
                    "dfu-util did not return device list output".into(),
                );
            }

            Ok(DfuCheckResult {
                available,
                executable: executable_display,
                version_output,
                list_output,
                hint: if available { None } else { dfu_hint() },
            })
        }
        Err(error) => {
            emit_log(&app, "warn", format!("dfu-util check failed: {}", error));
            Ok(DfuCheckResult {
                available: false,
                executable: executable_display,
                version_output,
                list_output: error.to_string(),
                hint: dfu_hint(),
            })
        }
    }
}

#[tauri::command]
pub fn xvf_flash_firmware(app: AppHandle, path: String) -> Result<(), String> {
    let executable = resolve_dfu_util();
    let executable_display = executable.to_string_lossy().to_string();

    emit_log(
        &app,
        "info",
        format!("Starting firmware flash with {}", executable_display),
    );
    emit_dfu_output(
        &app,
        "status",
        format!("Running {} -R -e -a 1 -D {}", executable_display, path),
    );

    let mut child = Command::new(&executable)
        .args(["-R", "-e", "-a", "1", "-D"])
        .arg(&path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|error| {
            let message = format!("Failed to start dfu-util: {}", error);
            emit_log(&app, "error", message.clone());
            message
        })?;

    let mut handles = Vec::new();
    if let Some(stdout) = child.stdout.take() {
        let app = app.clone();
        handles.push(thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                emit_dfu_output(&app, "stdout", line);
            }
        }));
    }
    if let Some(stderr) = child.stderr.take() {
        let app = app.clone();
        handles.push(thread::spawn(move || {
            for line in BufReader::new(stderr).lines().map_while(Result::ok) {
                emit_dfu_output(&app, "stderr", line);
            }
        }));
    }

    let status = child.wait().map_err(|error| {
        let message = format!("Failed to wait for dfu-util: {}", error);
        emit_log(&app, "error", message.clone());
        message
    })?;

    for handle in handles {
        let _ = handle.join();
    }

    if status.success() {
        emit_dfu_output(
            &app,
            "status",
            "Firmware flashing completed successfully".to_string(),
        );
        emit_log(
            &app,
            "info",
            "Firmware flashing completed successfully".into(),
        );
        Ok(())
    } else {
        let message = format!("Firmware flashing failed with status {}", status);
        emit_dfu_output(&app, "status", message.clone());
        emit_log(&app, "error", message.clone());
        Err(message)
    }
}

fn combine_output(stdout: &[u8], stderr: &[u8]) -> String {
    let mut output = String::new();
    output.push_str(&String::from_utf8_lossy(stdout));
    output.push_str(&String::from_utf8_lossy(stderr));
    output.trim().to_string()
}
