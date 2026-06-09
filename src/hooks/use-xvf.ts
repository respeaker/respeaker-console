// React hook that aggregates the XVF client surface into a single controller
// object consumed by the dashboard panels. The underlying `xvf` client already
// handles mock vs. native backends, so this layer mostly deals with React
// state transitions, optimistic updates, and a bounded in-memory log buffer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as xvf from "@/lib/xvf/client";
import type {
  DeviceInfo,
  DfuCheckResult,
  DfuOutputEvent,
  LogEvent,
  LogLevel,
  ParameterInfo,
  ReadManyResult,
  XvfValue,
} from "@/lib/xvf/types";

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  message: string;
}

export interface DfuOutputEntry {
  id: number;
  ts: number;
  stream: DfuOutputEvent["stream"];
  line: string;
}

export type XvfSource = "mock" | "native";
export type XvfArrayType = "circular" | "linear";

export interface FirmwareBuildInfo {
  raw: string;
  sampleRateKhz: number | null;
  arrayType: XvfArrayType | null;
  channelMode: string | null;
}

export interface FirmwareMetadata {
  version: string | null;
  build: FirmwareBuildInfo | null;
}

export interface ReadResult {
  values: XvfValue[];
}

export interface UseXvfResult {
  // Devices
  devices: (DeviceInfo & { path: string })[];
  selectedPath: string | null;
  current: (DeviceInfo & { path: string }) | null;
  arrayType: XvfArrayType;
  firmwareMetadata: FirmwareMetadata | null;
  loading: boolean;
  error: string | null;
  refreshDevices: () => Promise<void>;
  selectDevice: (path: string) => Promise<void>;
  connect: (path: string) => Promise<void>;
  disconnect: () => Promise<void>;
  releaseDevice: () => Promise<void>;
  reboot: () => Promise<void>;
  checkDfuUtil: () => Promise<DfuCheckResult | null>;
  flashFirmware: (path: string) => Promise<boolean>;

  // Parameter catalog
  commands: ParameterInfo[];

  // Parameter IO
  read: (name: string) => Promise<ReadResult | null>;
  write: (name: string, values: XvfValue[]) => Promise<boolean>;
  readMany: (names: string[]) => Promise<Record<string, ReadResult>>;

  // Logs
  logs: LogEntry[];
  dfuOutputs: DfuOutputEntry[];
  clearLogs: () => void;
  clearDfuOutputs: () => void;

  // Meta
  source: XvfSource;
}

const MAX_LOGS = 500;
const MAX_DFU_OUTPUTS = 300;

function devicePath(d: DeviceInfo): string {
  return `${d.bus}:${d.address}:${d.vid.toString(16)}:${d.pid.toString(16)}`;
}

function withPath(d: DeviceInfo): DeviceInfo & { path: string } {
  return { ...d, path: devicePath(d) };
}

export function useXvf(): UseXvfResult {
  const [devices, setDevices] = useState<(DeviceInfo & { path: string })[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [current, setCurrent] = useState<(DeviceInfo & { path: string }) | null>(null);
  const [arrayType, setArrayType] = useState<XvfArrayType>("circular");
  const [firmwareMetadata, setFirmwareMetadata] = useState<FirmwareMetadata | null>(null);
  const [commands, setCommands] = useState<ParameterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [dfuOutputs, setDfuOutputs] = useState<DfuOutputEntry[]>([]);

  const source: XvfSource = useMemo(() => (xvf.isMockEnv() ? "mock" : "native"), []);
  const logIdRef = useRef(0);
  const dfuOutputIdRef = useRef(0);

  const pushLog = useCallback((level: LogLevel, message: string, ts?: number) => {
    logIdRef.current += 1;
    const entry: LogEntry = {
      id: logIdRef.current,
      ts: ts ?? Date.now(),
      level,
      message,
    };
    setLogs((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_LOGS ? next.slice(next.length - MAX_LOGS) : next;
    });
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);
  const clearDfuOutputs = useCallback(() => setDfuOutputs([]), []);

  const clearRuntimeState = useCallback(() => {
    setCurrent(null);
    setArrayType("circular");
    setFirmwareMetadata(null);
  }, []);

  const probeFirmwareMetadata = useCallback(async (): Promise<FirmwareMetadata | null> => {
    try {
      const [versionValues, buildValues] = await Promise.all([
        xvf.readParameter("VERSION"),
        xvf.readParameter("BLD_MSG"),
      ]);
      const metadata: FirmwareMetadata = {
        version: formatVersion(versionValues),
        build: parseBuildInfo(buildValues),
      };
      setFirmwareMetadata(metadata);
      if (metadata.build?.arrayType) {
        setArrayType(metadata.build.arrayType);
      }
      return metadata;
    } catch (e) {
      setFirmwareMetadata(null);
      pushLog("warn", `Firmware metadata probe failed: ${errorMessage(e)}`);
      return null;
    }
  }, [pushLog]);

  const pushDfuOutput = useCallback((event: DfuOutputEvent) => {
    dfuOutputIdRef.current += 1;
    const ts = Date.parse(event.timestamp);
    const entry: DfuOutputEntry = {
      id: dfuOutputIdRef.current,
      ts: Number.isFinite(ts) ? ts : Date.now(),
      stream: event.stream,
      line: event.line,
    };
    setDfuOutputs((prev) => {
      const next = [...prev, entry];
      return next.length > MAX_DFU_OUTPUTS ? next.slice(next.length - MAX_DFU_OUTPUTS) : next;
    });
  }, []);

  // --- log stream ---
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    xvf
      .onLog((event: LogEvent) => {
        const ts = Date.parse(event.timestamp);
        pushLog(event.level, event.message, Number.isFinite(ts) ? ts : Date.now());
      })
      .then((fn) => {
        if (cancelled) fn();
        else cleanup = () => fn();
      })
      .catch((e) => {
        console.error("[v0] xvf log subscribe failed", e);
      });
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [pushLog]);

  // --- firmware flashing output stream ---
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let cancelled = false;
    xvf
      .onDfuOutput((event: DfuOutputEvent) => {
        pushDfuOutput(event);
      })
      .then((fn) => {
        if (cancelled) fn();
        else cleanup = () => fn();
      })
      .catch((e) => {
        console.error("[v0] xvf dfu output subscribe failed", e);
      });
    return () => {
      cancelled = true;
      if (cleanup) cleanup();
    };
  }, [pushDfuOutput]);

  // --- catalog ---
  useEffect(() => {
    xvf
      .listCommands()
      .then((list) => setCommands(list))
      .catch((e) => pushLog("error", `Load catalog failed: ${errorMessage(e)}`));
  }, [pushLog]);

  // --- initial device list + current ---
  const refreshDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await xvf.listDevices();
      const withPaths = list.map(withPath);
      setDevices(withPaths);
      setSelectedPath((prev) => {
        if (prev && withPaths.some((d) => d.path === prev)) return prev;
        return withPaths.length > 0 ? withPaths[0].path : null;
      });
      pushLog("info", `Found ${list.length} device(s)`);
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      pushLog("error", `Scan failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [pushLog]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const existing = await xvf.currentDevice();
        if (!cancelled && existing) {
          const withP = withPath(existing);
          setCurrent(withP);
          setSelectedPath(withP.path);
          if (!withP.isDfu) {
            await probeFirmwareMetadata();
          } else {
            setFirmwareMetadata(null);
          }
        }
      } catch (e) {
        pushLog("warn", `Current device probe failed: ${errorMessage(e)}`);
      }
      await refreshDevices();
    })();
    return () => {
      cancelled = true;
    };
  }, [probeFirmwareMetadata, refreshDevices, pushLog]);

  const selectDevice = useCallback(async (path: string) => {
    setSelectedPath(path);
  }, []);

  const connect = useCallback(
    async (path: string) => {
      const dev = devices.find((d) => d.path === path);
      if (!dev) {
        setError("Device not found");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const info = await xvf.connect({
          vid: dev.vid,
          pid: dev.pid,
          bus: dev.bus,
          address: dev.address,
        });
        const withP = withPath(info);
        setCurrent(withP);
        setSelectedPath(withP.path);
        if (withP.isDfu) {
          setFirmwareMetadata(null);
          setArrayType("circular");
        } else {
          const metadata = await probeFirmwareMetadata();
          if (metadata?.build?.arrayType) {
            pushLog("info", `Detected ${metadata.build.arrayType} microphone array`);
          } else {
            setArrayType("circular");
          }
        }
        pushLog("info", `Connected to ${info.product ?? "device"} (${info.vidHex}:${info.pidHex})`);
      } catch (e) {
        const msg = errorMessage(e);
        setError(msg);
        pushLog("error", `Connect failed: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [devices, probeFirmwareMetadata, pushLog]
  );

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await xvf.disconnect();
      clearRuntimeState();
      pushLog("info", "Disconnected");
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      pushLog("error", `Disconnect failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [clearRuntimeState, pushLog]);

  const releaseDevice = useCallback(async () => {
    try {
      await xvf.releaseDevice();
      clearRuntimeState();
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      pushLog("error", `Release device failed: ${msg}`);
    }
  }, [clearRuntimeState, pushLog]);

  const reboot = useCallback(async () => {
    if (current?.isDfu) {
      pushLog("warn", "Reboot is unavailable while the connected device is in DFU mode");
      return;
    }
    setLoading(true);
    try {
      await xvf.reboot();
      clearRuntimeState();
      pushLog("warn", "Reboot command sent; USB connection closed");
      // Refresh after short delay so renumeration finishes.
      setTimeout(() => {
        void refreshDevices();
      }, 1200);
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      pushLog("error", `Reboot failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [clearRuntimeState, current?.isDfu, pushLog, refreshDevices]);

  const checkDfuUtil = useCallback(async (): Promise<DfuCheckResult | null> => {
    try {
      const result = await xvf.checkDfuUtil();
      clearRuntimeState();
      pushLog(
        result.available ? "info" : "warn",
        result.available ? `dfu-util ready: ${result.executable}` : "dfu-util is not available"
      );
      return result;
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      pushLog("error", `dfu-util check failed: ${msg}`);
      return null;
    }
  }, [clearRuntimeState, pushLog]);

  const flashFirmware = useCallback(
    async (path: string): Promise<boolean> => {
      clearDfuOutputs();
      try {
        await xvf.flashFirmware(path);
        pushLog("info", "Firmware flashing completed");
        clearRuntimeState();
        setTimeout(() => {
          void refreshDevices();
        }, 1200);
        return true;
      } catch (e) {
        const msg = errorMessage(e);
        setError(msg);
        pushLog("error", `Firmware flashing failed: ${msg}`);
        return false;
      }
    },
    [clearDfuOutputs, clearRuntimeState, pushLog, refreshDevices]
  );

  const read = useCallback(
    async (name: string): Promise<ReadResult | null> => {
      if (current?.isDfu) {
        return null;
      }
      try {
        const values = await xvf.readParameter(name);
        return { values };
      } catch (e) {
        pushLog("error", `Read ${name} failed: ${errorMessage(e)}`);
        return null;
      }
    },
    [current?.isDfu, pushLog]
  );

  const write = useCallback(
    async (name: string, values: XvfValue[]): Promise<boolean> => {
      if (current?.isDfu) {
        return false;
      }
      try {
        await xvf.writeParameter(name, values);
        pushLog("info", `${name} = ${formatValues(values)}`);
        return true;
      } catch (e) {
        pushLog("error", `Write ${name} failed: ${errorMessage(e)}`);
        return false;
      }
    },
    [current?.isDfu, pushLog]
  );

  const readMany = useCallback(
    async (names: string[]) => {
      if (names.length === 0) return {};
      if (current?.isDfu) return {};
      try {
        const results: ReadManyResult[] = await xvf.readMany(names);
        const out: Record<string, ReadResult> = {};
        for (const r of results) {
          if (r.ok) out[r.name] = { values: r.values };
        }
        return out;
      } catch {
        return {};
      }
    },
    [current?.isDfu]
  );

  return {
    devices,
    selectedPath,
    current,
    arrayType,
    firmwareMetadata,
    loading,
    error,
    refreshDevices,
    selectDevice,
    connect,
    disconnect,
    releaseDevice,
    reboot,
    checkDfuUtil,
    flashFirmware,
    commands,
    read,
    write,
    readMany,
    logs,
    dfuOutputs,
    clearLogs,
    clearDfuOutputs,
    source,
  };
}

function valuesToText(values: XvfValue[]): string {
  const strings = values.map((value) => String(value));
  const separator = strings.length > 1 && strings.every((value) => value.length <= 1) ? "" : " ";
  return strings.join(separator).split(String.fromCharCode(0)).join("").trim();
}

function formatVersion(values: XvfValue[]): string | null {
  const numeric = values.filter((value): value is number => typeof value === "number");
  if (numeric.length >= 3) {
    return numeric.slice(0, 3).join(".");
  }

  const text = valuesToText(values);
  return text.length > 0 ? text : null;
}

function parseBuildInfo(values: XvfValue[]): FirmwareBuildInfo | null {
  const raw = valuesToText(values);
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  const match = normalized.match(/io(\d+)(?:-(\d+)ch)?-(sqr|lin)/);
  const sampleRateKhz = match ? Number(match[1]) : null;
  const channelMode = match?.[2] ? `${match[2]}ch` : null;
  const arrayType = parseArrayType(values);

  return {
    raw,
    sampleRateKhz: Number.isFinite(sampleRateKhz) ? sampleRateKhz : null,
    arrayType,
    channelMode,
  };
}

function parseArrayType(values: XvfValue[]): XvfArrayType | null {
  const message = values
    .map((value) => String(value))
    .join(" ")
    .toLowerCase();
  if (message.includes("lin")) return "linear";
  if (message.includes("sqr")) return "circular";
  return null;
}

function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return JSON.stringify(e);
}

function formatValues(values: XvfValue[]): string {
  return values
    .map((v) =>
      typeof v === "number"
        ? Number.isInteger(v)
          ? String(v)
          : Number(v.toFixed(4)).toString()
        : `"${v}"`
    )
    .join(", ");
}
