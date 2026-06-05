// Browser-only simulation of the Tauri XVF backend.
//
// The real USB stack is only available inside the Tauri runtime. When the
// renderer runs in a plain browser (`pnpm dev` without Tauri) we fall back
// to this mock so the UI still renders and developers can iterate on layout
// and interaction without a physical device.

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

type LogListener = (event: LogEvent) => void;
type DfuOutputListener = (event: DfuOutputEvent) => void;

const STATE: {
  devices: DeviceInfo[];
  current: DeviceInfo | null;
  values: Map<string, XvfValue[]>;
  listeners: Set<LogListener>;
  dfuListeners: Set<DfuOutputListener>;
  doaTick: number;
} = {
  devices: [
    {
      vid: 0x2886,
      pid: 0x0018,
      bus: 20,
      address: 3,
      manufacturer: "Seeed Studio",
      product: "ReSpeaker XVF3800 (Simulated)",
      serial: "SIM-XVF3800-0001",
      vidHex: "0x2886",
      pidHex: "0x0018",
    },
  ],
  current: null,
  values: new Map<string, XvfValue[]>(),
  listeners: new Set<LogListener>(),
  dfuListeners: new Set<DfuOutputListener>(),
  doaTick: 0,
};

function emit(level: LogEvent["level"], message: string) {
  const event: LogEvent = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  STATE.listeners.forEach((l) => l(event));
}

function emitDfu(stream: DfuOutputEvent["stream"], line: string) {
  const event: DfuOutputEvent = {
    stream,
    line,
    timestamp: new Date().toISOString(),
  };
  STATE.dfuListeners.forEach((l) => l(event));
}

function ensureValues(params: ParameterInfo[]) {
  if (STATE.values.size > 0) return;
  for (const p of params) {
    STATE.values.set(p.name, defaultValue(p));
  }
  // Seed some interesting defaults for the UI showcase.
  STATE.values.set("VERSION", [2, 1, 0]);
  STATE.values.set("BLD_MSG", ["ua-io16-sqr"]);
  STATE.values.set("BLD_HOST", ["v0-sandbox"]);
  STATE.values.set("BLD_REPO_HASH", ["deadbeefdeadbeefdeadbeefdeadbeefdeadbeef"]);
  STATE.values.set("BLD_MODIFIED", ["false"]);
  STATE.values.set("BOOT_STATUS", ["spi"]);
  STATE.values.set("LED_EFFECT", [4]);
  STATE.values.set("LED_BRIGHTNESS", [128]);
  STATE.values.set("LED_SPEED", [64]);
  STATE.values.set("LED_GAMMIFY", [1]);
  STATE.values.set("LED_COLOR", [0x00ff88]);
  STATE.values.set("LED_DOA_COLOR", [0x202020, 0xff8800]);
  STATE.values.set("PP_AGCONOFF", [1]);
  STATE.values.set("PP_AGCMAXGAIN", [100]);
  STATE.values.set("PP_AGCDESIREDLEVEL", [0.1]);
  STATE.values.set("PP_ECHOONOFF", [1]);
  STATE.values.set("PP_LIMITONOFF", [1]);
  STATE.values.set("PP_MIN_NS", [0.1]);
  STATE.values.set("PP_MIN_NN", [0.1]);
  STATE.values.set("AEC_HPFONOFF", [1]);
  STATE.values.set("AEC_AECCONVERGED", [1]);
  STATE.values.set("AUDIO_MGR_MIC_GAIN", [1.0]);
  STATE.values.set("AUDIO_MGR_REF_GAIN", [1.0]);
  STATE.values.set("AUDIO_MGR_OP_L", [8, 0]);
  STATE.values.set("AUDIO_MGR_OP_R", [0, 0]);
}

function defaultValue(p: ParameterInfo): XvfValue[] {
  if (p.kind === "char") return [""];
  const n: number = p.kind === "float" || p.kind === "radians" ? 0.0 : 0;
  return Array.from({ length: p.length }, () => n);
}

function requireConnected(): void {
  if (!STATE.current) {
    throw new Error("No device is currently connected");
  }
}

export function isMockEnv(): boolean {
  if (typeof window === "undefined") return true;
  // Tauri v2 exposes `__TAURI_INTERNALS__` on the window object in the webview.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return !(window as any).__TAURI_INTERNALS__;
}

export function mockOnLog(listener: LogListener): () => void {
  STATE.listeners.add(listener);
  return () => STATE.listeners.delete(listener);
}

export function mockOnDfuOutput(listener: DfuOutputListener): () => void {
  STATE.dfuListeners.add(listener);
  return () => STATE.dfuListeners.delete(listener);
}

export async function mockListCommands(): Promise<ParameterInfo[]> {
  // Lazy import to keep the table close to the catalog logic that already
  // mirrors the Rust definitions.
  const { PARAMETER_CATALOG } = await import("./catalog");
  return PARAMETER_CATALOG.slice();
}

export async function mockListDevices(): Promise<DeviceInfo[]> {
  emit("info", "Mock: scanning for devices");
  return STATE.devices.slice();
}

export async function mockConnect(args: ConnectArgs): Promise<DeviceInfo> {
  const vid = args.vid ?? 0x2886;
  const dev = STATE.devices.find(
    (d) =>
      d.vid === vid &&
      (args.pid == null || d.pid === args.pid) &&
      (args.bus == null || d.bus === args.bus) &&
      (args.address == null || d.address === args.address)
  );
  if (!dev) throw new Error(`No device found for vid=0x${vid.toString(16)}`);
  STATE.current = dev;
  const params = await mockListCommands();
  ensureValues(params);
  emit("info", `Mock: connected to ${dev.product ?? "device"}`);
  return dev;
}

export async function mockDisconnect(): Promise<void> {
  if (STATE.current) {
    emit("info", "Mock: disconnected");
  }
  STATE.current = null;
}

export async function mockCurrentDevice(): Promise<DeviceInfo | null> {
  return STATE.current;
}

export async function mockRead(name: string): Promise<XvfValue[]> {
  requireConnected();
  const { getParameter } = await import("./catalog");
  const p = getParameter(name);
  if (!p) throw new Error(`Unknown parameter: ${name}`);
  if (p.access === "wo") throw new Error(`${name} is write-only`);

  // Synthesize live telemetry for a few commands so the monitoring UI feels
  // alive even without a real device.
  if (name === "DOA_VALUE") {
    STATE.doaTick += 1;
    const angle = Math.floor(
      180 + 120 * Math.sin(STATE.doaTick / 12) + 40 * Math.cos(STATE.doaTick / 3)
    );
    const vad = Math.abs(Math.sin(STATE.doaTick / 5)) > 0.4 ? 1 : 0;
    return [((angle % 360) + 360) % 360, vad];
  }
  if (name === "AEC_RT60") {
    return [0.35 + 0.05 * Math.sin(Date.now() / 1000)];
  }
  if (name === "AEC_SPENERGY_VALUES") {
    const base = Math.max(0, Math.sin(Date.now() / 800));
    return [base, base * 0.6, base * 0.8, base * 0.9];
  }
  if (name === "AEC_AZIMUTH_VALUES" || name === "AUDIO_MGR_SELECTED_AZIMUTHS") {
    const rad = (Math.PI / 180) * ((STATE.doaTick * 3) % 360);
    return [rad, rad + 0.1, rad - 0.2, rad + 0.05].slice(0, p.length);
  }
  const stored = STATE.values.get(name);
  if (stored) return stored.slice();
  const fresh = defaultValue(p);
  STATE.values.set(name, fresh);
  return fresh.slice();
}

export async function mockWrite(name: string, values: XvfValue[]): Promise<void> {
  requireConnected();
  const { getParameter } = await import("./catalog");
  const p = getParameter(name);
  if (!p) throw new Error(`Unknown parameter: ${name}`);
  if (p.access === "ro") throw new Error(`${name} is read-only`);
  if (values.length !== p.length) {
    throw new Error(`${name} expects ${p.length} value(s), got ${values.length}`);
  }
  STATE.values.set(name, values.slice());
  emit("info", `Mock: ${name} = ${JSON.stringify(values)}`);
  if (name === "REBOOT") {
    STATE.current = null;
    emit("warn", "Mock: device rebooted, connection closed");
  }
  if (name === "CLEAR_CONFIGURATION") {
    STATE.values.clear();
    const params = await mockListCommands();
    ensureValues(params);
    emit("warn", "Mock: configuration cleared");
  }
}

export async function mockReadMany(names: string[]): Promise<ReadManyResult[]> {
  const out: ReadManyResult[] = [];
  for (const name of names) {
    try {
      const values = await mockRead(name);
      out.push({ name, ok: true, values, error: null });
    } catch (e) {
      out.push({
        name,
        ok: false,
        values: [],
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return out;
}

export async function mockReboot(): Promise<void> {
  if (!STATE.current) throw new Error("No device is currently connected");
  emit("warn", "Mock: REBOOT sent, connection dropped");
  STATE.current = null;
}

export async function mockCheckDfuUtil(): Promise<DfuCheckResult> {
  emit("info", "Mock: dfu-util is available");
  return {
    available: true,
    executable: "dfu-util",
    versionOutput: "dfu-util 0.11 (mock)",
    listOutput: "Found DFU: [2886:0018] ver=0200, devnum=1, cfg=1, intf=0, path=mock",
    hint: null,
  };
}

export async function mockFlashFirmware(path: string): Promise<void> {
  emit("warn", "Mock: firmware flashing started");
  emitDfu("status", `Mock flashing ${path}`);
  for (const line of ["Opening DFU device", "Erasing", "Downloading", "Resetting device"]) {
    emitDfu("stdout", line);
    await new Promise((resolve) => window.setTimeout(resolve, 200));
  }
  emitDfu("status", "Mock firmware flashing completed successfully");
  emit("info", "Mock: firmware flashing completed");
}
