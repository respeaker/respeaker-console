// Tauri command surface exposed to the renderer.
//
// Keeps the USB interaction strictly inside the Rust process, so the UI only
// deals with JSON serializable values. A single connected device is held in a
// Mutex to honour the "one device at a time" rule from the PRD.

use std::sync::Mutex;
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

fn emit_log(app: &AppHandle, level: &str, message: String) {
    log::info!("[xvf:log][{}] {}", level, message);
    let evt = LogEvent {
        level: level.to_string(),
        message,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };
    let _ = app.emit("xvf://log", &evt);
}

fn read_values_to_json(values: Vec<ReadValue>) -> Vec<Value> {
    values
        .into_iter()
        .map(|v| match v {
            ReadValue::U8(x) => Value::from(x),
            ReadValue::U16(x) => Value::from(x),
            ReadValue::U32(x) => Value::from(x),
            ReadValue::I32(x) => Value::from(x),
            ReadValue::Float(x) => {
                serde_json::Number::from_f64(x as f64)
                    .map(Value::Number)
                    .unwrap_or(Value::Null)
            }
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
    parameters::PARAMETERS.iter().map(ParameterDto::from).collect()
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
        emit_log(&app, "info", "Closing previous device before reconnecting".into());
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
            dto.manufacturer.clone().unwrap_or_else(|| "<unknown>".into()),
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
    let param = parameters::find(&name)
        .ok_or_else(|| format!("Unknown parameter: {}", name))?;
    let guard = CURRENT_DEVICE
        .lock()
        .map_err(|e| format!("lock poisoned: {}", e))?;
    let dev = guard.as_ref().ok_or_else(|| XvfError::NotConnected.to_string())?;
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
    let param = parameters::find(&name)
        .ok_or_else(|| format!("Unknown parameter: {}", name))?;
    let floats = normalize_values(param, values)?;
    let guard = CURRENT_DEVICE
        .lock()
        .map_err(|e| format!("lock poisoned: {}", e))?;
    let dev = guard.as_ref().ok_or_else(|| XvfError::NotConnected.to_string())?;
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
        let param = parameters::find("REBOOT").ok_or_else(|| "REBOOT command missing".to_string())?;
        dev.write_parameter(param, &[1.0]).map_err(|e| e.to_string())?;
    }
    emit_log(&app, "warn", "Rebooting device; USB connection will be reset".into());
    std::thread::sleep(Duration::from_millis(200));
    if let Ok(mut guard) = CURRENT_DEVICE.lock() {
        guard.take();
    }
    Ok(())
}
