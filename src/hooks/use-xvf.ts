// React hook that aggregates the XVF client surface into a single controller
// object consumed by the dashboard panels. The underlying `xvf` client already
// handles mock vs. native backends, so this layer mostly deals with React
// state transitions, optimistic updates, and a bounded in-memory log buffer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import * as xvf from "@/lib/xvf/client";
import type {
  DeviceInfo,
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

export type XvfSource = "mock" | "native";

export interface ReadResult {
  values: XvfValue[];
}

export interface UseXvfResult {
  // Devices
  devices: (DeviceInfo & { path: string })[];
  selectedPath: string | null;
  current: (DeviceInfo & { path: string }) | null;
  loading: boolean;
  error: string | null;
  refreshDevices: () => Promise<void>;
  selectDevice: (path: string) => Promise<void>;
  connect: (path: string) => Promise<void>;
  disconnect: () => Promise<void>;
  reboot: () => Promise<void>;

  // Parameter catalog
  commands: ParameterInfo[];

  // Parameter IO
  read: (name: string) => Promise<ReadResult | null>;
  write: (name: string, values: XvfValue[]) => Promise<boolean>;
  readMany: (names: string[]) => Promise<Record<string, ReadResult>>;

  // Logs
  logs: LogEntry[];
  clearLogs: () => void;

  // Meta
  source: XvfSource;
}

const MAX_LOGS = 500;

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
  const [commands, setCommands] = useState<ParameterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const source: XvfSource = useMemo(() => (xvf.isMockEnv() ? "mock" : "native"), []);
  const logIdRef = useRef(0);

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
        }
      } catch (e) {
        pushLog("warn", `Current device probe failed: ${errorMessage(e)}`);
      }
      await refreshDevices();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshDevices, pushLog]);

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
        pushLog("info", `Connected to ${info.product ?? "device"} (${info.vidHex}:${info.pidHex})`);
      } catch (e) {
        const msg = errorMessage(e);
        setError(msg);
        pushLog("error", `Connect failed: ${msg}`);
      } finally {
        setLoading(false);
      }
    },
    [devices, pushLog]
  );

  const disconnect = useCallback(async () => {
    setLoading(true);
    try {
      await xvf.disconnect();
      setCurrent(null);
      pushLog("info", "Disconnected");
    } catch (e) {
      const msg = errorMessage(e);
      setError(msg);
      pushLog("error", `Disconnect failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [pushLog]);

  const reboot = useCallback(async () => {
    setLoading(true);
    try {
      await xvf.reboot();
      setCurrent(null);
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
  }, [pushLog, refreshDevices]);

  const read = useCallback(
    async (name: string): Promise<ReadResult | null> => {
      try {
        const values = await xvf.readParameter(name);
        return { values };
      } catch (e) {
        pushLog("error", `Read ${name} failed: ${errorMessage(e)}`);
        return null;
      }
    },
    [pushLog]
  );

  const write = useCallback(
    async (name: string, values: XvfValue[]): Promise<boolean> => {
      try {
        await xvf.writeParameter(name, values);
        pushLog("info", `${name} = ${formatValues(values)}`);
        return true;
      } catch (e) {
        pushLog("error", `Write ${name} failed: ${errorMessage(e)}`);
        return false;
      }
    },
    [pushLog]
  );

  const readMany = useCallback(async (names: string[]) => {
    if (names.length === 0) return {};
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
  }, []);

  return {
    devices,
    selectedPath,
    current,
    loading,
    error,
    refreshDevices,
    selectDevice,
    connect,
    disconnect,
    reboot,
    commands,
    read,
    write,
    readMany,
    logs,
    clearLogs,
    source,
  };
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
