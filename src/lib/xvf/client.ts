// Single entry point for the renderer -> device control surface.
//
// In the Tauri webview we delegate to the Rust commands via `invoke` and
// subscribe to the `xvf://log` event stream. When running in a plain browser
// (CI preview, Storybook, `pnpm dev`) we fall back to the in-memory mock.

import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import {
  isMockEnv,
  mockCheckDfuUtil,
  mockConnect,
  mockCurrentDevice,
  mockDisconnect,
  mockFlashFirmware,
  mockListCommands,
  mockListDevices,
  mockOnDfuOutput,
  mockOnLog,
  mockRead,
  mockReadMany,
  mockReleaseDevice,
  mockReboot,
  mockWrite,
} from "./mock";
import type {
  ConnectArgs,
  DeviceInfo,
  DfuCheckResult,
  DfuOutputEvent,
  LogEvent,
  ParameterInfo,
  ReadManyResult,
  XvfValue,
} from "./types";

// ----- Command wrappers -----

export async function listCommands(): Promise<ParameterInfo[]> {
  if (isMockEnv()) return mockListCommands();
  return invoke<ParameterInfo[]>("xvf_list_commands");
}

export async function listDevices(vid?: number): Promise<DeviceInfo[]> {
  if (isMockEnv()) return mockListDevices();
  return invoke<DeviceInfo[]>("xvf_list_devices", { vid });
}

export async function connect(args: ConnectArgs = {}): Promise<DeviceInfo> {
  if (isMockEnv()) return mockConnect(args);
  return invoke<DeviceInfo>("xvf_connect", { args });
}

export async function disconnect(): Promise<void> {
  if (isMockEnv()) return mockDisconnect();
  return invoke("xvf_disconnect");
}

export async function releaseDevice(): Promise<void> {
  if (isMockEnv()) return mockReleaseDevice();
  return invoke("xvf_release_device");
}

export async function currentDevice(): Promise<DeviceInfo | null> {
  if (isMockEnv()) return mockCurrentDevice();
  return invoke<DeviceInfo | null>("xvf_current_device");
}

export async function readParameter(name: string): Promise<XvfValue[]> {
  if (isMockEnv()) return mockRead(name);
  return invoke<XvfValue[]>("xvf_read", { name });
}

export async function writeParameter(name: string, values: XvfValue[]): Promise<void> {
  if (isMockEnv()) return mockWrite(name, values);
  return invoke("xvf_write", { name, values });
}

export async function readMany(names: string[]): Promise<ReadManyResult[]> {
  if (isMockEnv()) return mockReadMany(names);
  return invoke<ReadManyResult[]>("xvf_read_many", { names });
}

export async function reboot(): Promise<void> {
  if (isMockEnv()) return mockReboot();
  return invoke("xvf_reboot_device");
}

export async function checkDfuUtil(): Promise<DfuCheckResult> {
  if (isMockEnv()) return mockCheckDfuUtil();
  return invoke<DfuCheckResult>("xvf_check_dfu_util");
}

export async function flashFirmware(path: string): Promise<void> {
  if (isMockEnv()) return mockFlashFirmware(path);
  return invoke("xvf_flash_firmware", { path });
}

// ----- Log event stream -----

export async function onLog(listener: (event: LogEvent) => void): Promise<UnlistenFn> {
  if (isMockEnv()) {
    const off = mockOnLog(listener);
    return async () => off();
  }
  return listen<LogEvent>("xvf://log", (event) => listener(event.payload));
}

export async function onDfuOutput(listener: (event: DfuOutputEvent) => void): Promise<UnlistenFn> {
  if (isMockEnv()) {
    const off = mockOnDfuOutput(listener);
    return async () => off();
  }
  return listen<DfuOutputEvent>("xvf://dfu-output", (event) => listener(event.payload));
}

// ----- Environment helpers -----

export { isMockEnv };
