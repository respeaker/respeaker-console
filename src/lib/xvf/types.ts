// Shared types for the XVF3800 client surface. These mirror the DTOs returned
// by the Tauri commands in src-tauri/src/xvf/commands.rs so the renderer can
// consume them without any conversion layer.

export type ParameterAccess = "ro" | "wo" | "rw";

export type ParameterKind = "uint8" | "uint16" | "uint32" | "int32" | "float" | "radians" | "char";

export interface ParameterInfo {
  name: string;
  resid: number;
  cmdid: number;
  length: number;
  access: ParameterAccess;
  kind: ParameterKind;
  description: string;
}

export interface DeviceInfo {
  vid: number;
  pid: number;
  bus: number;
  address: number;
  manufacturer: string | null;
  product: string | null;
  serial: string | null;
  vidHex: string;
  pidHex: string;
}

export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogEvent {
  level: LogLevel;
  message: string;
  timestamp: string;
}

export type DfuOutputStream = "stdout" | "stderr" | "warning" | "status";

export interface DfuOutputEvent {
  stream: DfuOutputStream;
  line: string;
  timestamp: string;
}

export interface DfuCheckResult {
  available: boolean;
  executable: string;
  versionOutput: string;
  listOutput: string;
  hint: string | null;
}

export interface ReadManyResult {
  name: string;
  ok: boolean;
  values: XvfValue[];
  error: string | null;
}

export type XvfValue = number | string;

export interface ConnectArgs {
  vid?: number;
  pid?: number;
  bus?: number;
  address?: number;
}

// Resource IDs (resid) used to group commands on the device.
export const RESID = {
  APP: 48,
  AEC: 33,
  AUDIO_MGR: 35,
  GPO_LED: 20,
  PP: 17,
} as const;

export type ResidKey = keyof typeof RESID;

export function residKey(resid: number): ResidKey | "OTHER" {
  switch (resid) {
    case RESID.APP:
      return "APP";
    case RESID.AEC:
      return "AEC";
    case RESID.AUDIO_MGR:
      return "AUDIO_MGR";
    case RESID.GPO_LED:
      return "GPO_LED";
    case RESID.PP:
      return "PP";
    default:
      return "OTHER";
  }
}

export function isNumericKind(kind: ParameterKind): boolean {
  return kind !== "char";
}
