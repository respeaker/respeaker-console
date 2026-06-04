// USB control transport for ReSpeaker XVF3800.
//
// Ported from `xvf_host.py` (XMOS reference host script).
// Uses `rusb` so it works on Linux / macOS / Windows with libusb.

use std::thread;
use std::time::Duration;

use once_cell::sync::Lazy;
use rusb::{
    request_type, Context, Device, DeviceHandle, Direction, Recipient, RequestType, UsbContext,
};

use super::parameters::{response_length, Parameter};

static USB_CONTEXT: Lazy<Context> =
    Lazy::new(|| Context::new().expect("failed to create libusb context"));

pub const DEFAULT_VID: u16 = 0x2886;
pub const USB_TIMEOUT: Duration = Duration::from_millis(5000);
pub const CONTROL_SUCCESS: u8 = 0;
pub const SERVICER_COMMAND_RETRY: u8 = 64;
pub const MAX_READ_RETRY: u32 = 100;

#[derive(Clone, Debug)]
pub struct DeviceDescriptor {
    pub vid: u16,
    pub pid: u16,
    pub bus: u8,
    pub address: u8,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum XvfError {
    #[error("usb error: {0}")]
    Usb(#[from] rusb::Error),
    #[error("unknown parameter: {0}")]
    #[allow(dead_code)]
    UnknownParameter(String),
    #[error("parameter {0} is read-only")]
    ReadOnly(String),
    #[error("parameter {0} is write-only")]
    WriteOnly(String),
    #[error("{name} expects {expected} value(s), got {actual}")]
    ValueCount {
        name: String,
        expected: usize,
        actual: usize,
    },
    #[error("read attempt exceeded {0} times")]
    TooManyReadAttempts(u32),
    #[error("unknown status code: {0}")]
    UnknownStatus(u8),
    #[error("no device is currently connected")]
    NotConnected,
    #[error("device not found (vid=0x{vid:04x}, pid={pid_display})")]
    NotFound {
        vid: u16,
        pid: Option<u16>,
        pid_display: String,
    },
    #[error("value out of range for {kind}: {value}")]
    ValueRange { kind: &'static str, value: f64 },
    #[error("invalid parameter kind: {0}")]
    InvalidKind(String),
}

// Small wrapper around rusb's global default Context so we can reuse it and
// talk to multiple devices without paying the initialization cost every call.
#[allow(dead_code)]
pub fn list_devices() -> Result<Vec<DeviceDescriptor>, XvfError> {
    list_devices_with_vid(DEFAULT_VID)
}

pub fn list_devices_with_vid(vid: u16) -> Result<Vec<DeviceDescriptor>, XvfError> {
    let mut out = Vec::new();
    for device in USB_CONTEXT.devices()?.iter() {
        let descriptor = match device.device_descriptor() {
            Ok(d) => d,
            Err(_) => continue,
        };
        if descriptor.vendor_id() != vid {
            continue;
        }
        let (manufacturer, product, serial) = read_strings(&device, &descriptor);
        out.push(DeviceDescriptor {
            vid: descriptor.vendor_id(),
            pid: descriptor.product_id(),
            bus: device.bus_number(),
            address: device.address(),
            manufacturer,
            product,
            serial,
        });
    }
    out.sort_by_key(|d| d.pid);
    Ok(out)
}

fn read_strings<T: UsbContext>(
    device: &Device<T>,
    descriptor: &rusb::DeviceDescriptor,
) -> (Option<String>, Option<String>, Option<String>) {
    // Opening a device for string descriptor reads requires permissions.
    // If opening fails we silently skip the string fields.
    let handle = match device.open() {
        Ok(h) => h,
        Err(_) => return (None, None, None),
    };
    let manufacturer = descriptor
        .manufacturer_string_index()
        .and_then(|i| handle.read_string_descriptor_ascii(i).ok())
        .map(|s| s.trim().to_string());
    let product = descriptor
        .product_string_index()
        .and_then(|i| handle.read_string_descriptor_ascii(i).ok())
        .map(|s| s.trim().to_string());
    let serial = handle
        .read_serial_number_string_ascii(descriptor)
        .ok()
        .map(|s| s.trim().to_string());
    (manufacturer, product, serial)
}

pub struct XvfDevice {
    handle: DeviceHandle<Context>,
    descriptor: DeviceDescriptor,
}

impl XvfDevice {
    pub fn open(
        vid: u16,
        pid: Option<u16>,
        bus_address: Option<(u8, u8)>,
    ) -> Result<Self, XvfError> {
        for device in USB_CONTEXT.devices()?.iter() {
            let d = match device.device_descriptor() {
                Ok(d) => d,
                Err(_) => continue,
            };
            if d.vendor_id() != vid {
                continue;
            }
            if let Some(pid) = pid {
                if d.product_id() != pid {
                    continue;
                }
            }
            if let Some((bus, address)) = bus_address {
                if device.bus_number() != bus || device.address() != address {
                    continue;
                }
            }
            let (manufacturer, product, serial) = read_strings(&device, &d);
            let handle = device.open()?;
            let descriptor = DeviceDescriptor {
                vid: d.vendor_id(),
                pid: d.product_id(),
                bus: device.bus_number(),
                address: device.address(),
                manufacturer,
                product,
                serial,
            };
            log::info!(
                "[xvf] opened device vid=0x{:04x} pid=0x{:04x} bus={} addr={}",
                descriptor.vid,
                descriptor.pid,
                descriptor.bus,
                descriptor.address
            );
            return Ok(XvfDevice { handle, descriptor });
        }
        Err(XvfError::NotFound {
            vid,
            pid,
            pid_display: pid
                .map(|p| format!("0x{:04x}", p))
                .unwrap_or_else(|| "auto".to_string()),
        })
    }

    pub fn descriptor(&self) -> &DeviceDescriptor {
        &self.descriptor
    }

    // ----- Raw control transfers -----

    fn control_out(
        &self,
        request: u8,
        value: u16,
        index: u16,
        data: &[u8],
    ) -> Result<(), XvfError> {
        let req_type = request_type(Direction::Out, RequestType::Vendor, Recipient::Device);
        let written =
            self.handle
                .write_control(req_type, request, value, index, data, USB_TIMEOUT)?;
        if written != data.len() {
            log::warn!(
                "[xvf] control_out short write: wrote {} of {} bytes",
                written,
                data.len()
            );
        }
        Ok(())
    }

    fn control_in(
        &self,
        request: u8,
        value: u16,
        index: u16,
        length: usize,
    ) -> Result<Vec<u8>, XvfError> {
        let req_type = request_type(Direction::In, RequestType::Vendor, Recipient::Device);
        let mut buf = vec![0u8; length];
        let read =
            self.handle
                .read_control(req_type, request, value, index, &mut buf, USB_TIMEOUT)?;
        buf.truncate(read);
        Ok(buf)
    }

    // ----- Parameter read / write (mirrors xvf_host.py) -----

    pub fn write_parameter(&self, param: &Parameter, values: &[f64]) -> Result<(), XvfError> {
        if !param.is_writable() {
            return Err(XvfError::ReadOnly(param.name.to_string()));
        }
        if values.len() != param.length as usize {
            return Err(XvfError::ValueCount {
                name: param.name.to_string(),
                expected: param.length as usize,
                actual: values.len(),
            });
        }

        let payload = encode_payload(param, values)?;
        let wvalue = param.cmdid as u16;
        let windex = param.resid as u16;

        log::debug!(
            "[xvf] write cmdid={} resid={} len={} kind={} payload={:?}",
            param.cmdid,
            param.resid,
            param.length,
            param.kind,
            payload
        );
        self.control_out(0, wvalue, windex, &payload)
    }

    #[allow(dead_code)]
    pub fn write_parameter_strbytes(
        &self,
        param: &Parameter,
        bytes: &[u8],
    ) -> Result<(), XvfError> {
        if !param.is_writable() {
            return Err(XvfError::ReadOnly(param.name.to_string()));
        }
        let wvalue = param.cmdid as u16;
        let windex = param.resid as u16;
        self.control_out(0, wvalue, windex, bytes)
    }

    pub fn read_parameter(&self, param: &Parameter) -> Result<Vec<ReadValue>, XvfError> {
        if !param.is_readable() {
            return Err(XvfError::WriteOnly(param.name.to_string()));
        }

        let wvalue = 0x80u16 | param.cmdid as u16;
        let windex = param.resid as u16;
        let length = response_length(param);

        let mut attempts: u32 = 1;
        let mut response = self.control_in(0, wvalue, windex, length)?;
        loop {
            if response.is_empty() {
                return Err(XvfError::UnknownStatus(0));
            }
            match response[0] {
                CONTROL_SUCCESS => break,
                SERVICER_COMMAND_RETRY => {
                    if attempts > MAX_READ_RETRY {
                        return Err(XvfError::TooManyReadAttempts(MAX_READ_RETRY));
                    }
                    attempts += 1;
                    thread::sleep(Duration::from_millis(10));
                    response = self.control_in(0, wvalue, windex, length)?;
                }
                other => return Err(XvfError::UnknownStatus(other)),
            }
        }

        log::debug!(
            "[xvf] read cmdid={} resid={} len={} kind={} raw={:?}",
            param.cmdid,
            param.resid,
            param.length,
            param.kind,
            response
        );

        decode_response(param, &response[1..])
    }
}

impl Drop for XvfDevice {
    fn drop(&mut self) {
        log::info!(
            "[xvf] closed device vid=0x{:04x} pid=0x{:04x}",
            self.descriptor.vid,
            self.descriptor.pid
        );
    }
}

// ----- Payload encoding / decoding -----

fn encode_payload(param: &Parameter, values: &[f64]) -> Result<Vec<u8>, XvfError> {
    let mut out = Vec::with_capacity((param.length as usize) * 4);
    match param.kind {
        "float" | "radians" => {
            for v in values {
                out.extend_from_slice(&(*v as f32).to_le_bytes());
            }
        }
        "uint8" => {
            for v in values {
                if !(0.0..=u8::MAX as f64).contains(v) {
                    return Err(XvfError::ValueRange {
                        kind: "uint8",
                        value: *v,
                    });
                }
                out.push(*v as u8);
            }
        }
        "uint16" => {
            for v in values {
                if !(0.0..=u16::MAX as f64).contains(v) {
                    return Err(XvfError::ValueRange {
                        kind: "uint16",
                        value: *v,
                    });
                }
                out.extend_from_slice(&(*v as u16).to_le_bytes());
            }
        }
        "uint32" => {
            for v in values {
                if !(0.0..=u32::MAX as f64).contains(v) {
                    return Err(XvfError::ValueRange {
                        kind: "uint32",
                        value: *v,
                    });
                }
                out.extend_from_slice(&(*v as u32).to_le_bytes());
            }
        }
        "int32" => {
            for v in values {
                if !((i32::MIN as f64)..=(i32::MAX as f64)).contains(v) {
                    return Err(XvfError::ValueRange {
                        kind: "int32",
                        value: *v,
                    });
                }
                out.extend_from_slice(&(*v as i32).to_le_bytes());
            }
        }
        "char" => {
            for v in values {
                out.push(*v as u8);
            }
        }
        other => return Err(XvfError::InvalidKind(other.to_string())),
    }
    Ok(out)
}

#[derive(Debug, Clone)]
pub enum ReadValue {
    U8(u8),
    U16(u16),
    U32(u32),
    I32(i32),
    Float(f32),
    Str(String),
}

fn decode_response(param: &Parameter, payload: &[u8]) -> Result<Vec<ReadValue>, XvfError> {
    let count = param.length as usize;
    let mut out = Vec::with_capacity(count);
    match param.kind {
        "uint8" => {
            for i in 0..count {
                out.push(ReadValue::U8(payload[i]));
            }
        }
        "uint16" => {
            for i in 0..count {
                let offset = i * 2;
                let v = u16::from_le_bytes([payload[offset], payload[offset + 1]]);
                out.push(ReadValue::U16(v));
            }
        }
        "uint32" => {
            for i in 0..count {
                let o = i * 4;
                let v = u32::from_le_bytes([
                    payload[o],
                    payload[o + 1],
                    payload[o + 2],
                    payload[o + 3],
                ]);
                out.push(ReadValue::U32(v));
            }
        }
        "int32" => {
            for i in 0..count {
                let o = i * 4;
                let v = i32::from_le_bytes([
                    payload[o],
                    payload[o + 1],
                    payload[o + 2],
                    payload[o + 3],
                ]);
                out.push(ReadValue::I32(v));
            }
        }
        "float" | "radians" => {
            for i in 0..count {
                let o = i * 4;
                let v = f32::from_le_bytes([
                    payload[o],
                    payload[o + 1],
                    payload[o + 2],
                    payload[o + 3],
                ]);
                out.push(ReadValue::Float(v));
            }
        }
        "char" => {
            // Trim trailing NULs and decode as UTF-8 (lossy).
            let end = payload
                .iter()
                .take(count)
                .position(|&b| b == 0)
                .unwrap_or_else(|| payload.len().min(count));
            let s = String::from_utf8_lossy(&payload[..end]).into_owned();
            out.push(ReadValue::Str(s));
        }
        other => return Err(XvfError::InvalidKind(other.to_string())),
    }
    Ok(out)
}
