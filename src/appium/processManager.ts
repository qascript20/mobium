import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import type { MobiumConfig } from "../config.js";
import { runCommand } from "../util/command.js";
import { resolveAppiumCommand } from "./command.js";

type AppiumServerState = {
  started: boolean;
  host: string;
  port: number;
  basePath: string;
  url: string;
  pid?: number;
};

let managedProcess: ChildProcess | undefined;

export async function ensureAppiumServer(config: MobiumConfig): Promise<AppiumServerState> {
  if (!config.appium.autoStart) {
    const url = appiumStatusUrl(config.appium.host, config.appium.port, config.appium.basePath);
    if (await isAppiumReachable(url)) {
      return {
        started: false,
        host: config.appium.host,
        port: config.appium.port,
        basePath: config.appium.basePath,
        url
      };
    }
    throw new Error(`Appium is not reachable at ${url}. Start Appium or enable appium.autoStart.`);
  }

  await stopRunningAppiumServers(config);
  const port = await findAvailablePort(config.appium.host, config.appium.port);
  const url = appiumStatusUrl(config.appium.host, port, config.appium.basePath);
  managedProcess = startAppiumProcess(config, port);

  await waitForAppium(url, config.sessions.defaultTimeoutMs);
  return {
    started: true,
    host: config.appium.host,
    port,
    basePath: config.appium.basePath,
    url,
    pid: managedProcess.pid
  };
}

export async function stopRunningAppiumServers(config: MobiumConfig): Promise<number[]> {
  const stoppedPids = new Set<number>();

  await stopManagedAppiumServer();

  for (let port = config.appium.port; port < config.appium.port + 100; port += 1) {
    const url = appiumStatusUrl(config.appium.host, port, config.appium.basePath);
    if (!await isAppiumServer(url)) {
      continue;
    }

    const pids = await findPidsListeningOnPort(port);
    for (const pid of pids) {
      if (pid === process.pid) {
        continue;
      }

      try {
        process.kill(pid, "SIGINT");
        stoppedPids.add(pid);
      } catch {
        // The process may already be gone; the port wait below handles the observable state.
      }
    }

    await waitForPortToClose(config.appium.host, port, 3_000);
  }

  return [...stoppedPids];
}

export async function stopManagedAppiumServer(): Promise<void> {
  if (!managedProcess || managedProcess.killed) {
    return;
  }

  const processToStop = managedProcess;
  managedProcess = undefined;
  processToStop.kill("SIGINT");
}

function startAppiumProcess(config: MobiumConfig, port: number): ChildProcess {
  const logDir = join(process.cwd(), config.artifacts.outputDir, "logs");
  mkdirSync(logDir, { recursive: true });

  const args = [
    "--address",
    config.appium.host,
    "--port",
    String(port)
  ];

  const child = spawn(resolveAppiumCommand(config.appium.command), args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...inferAndroidSdkEnv()
    },
    detached: true,
    stdio: ["ignore", "ignore", "ignore"]
  });

  child.unref();

  return child;
}

async function waitForAppium(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isAppiumReachable(url)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for Appium at ${url}.`);
}

async function isAppiumReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function isAppiumServer(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return false;
    }
    const payload = await response.json() as { value?: { build?: unknown; ready?: unknown; message?: unknown } };
    return Boolean(payload.value && ("build" in payload.value || "ready" in payload.value || "message" in payload.value));
  } catch {
    return false;
  }
}

function appiumStatusUrl(host: string, port: number, basePath: string): string {
  const normalizedBasePath = basePath === "/" ? "" : basePath.replace(/\/$/, "");
  return `http://${host}:${port}${normalizedBasePath}/status`;
}

async function findPidsListeningOnPort(port: number): Promise<number[]> {
  if (process.platform === "win32") {
    return [];
  }

  const result = await runCommand("lsof", ["-ti", `tcp:${port}`], 2_000);
  if (!result.ok) {
    return [];
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => Number(line.trim()))
    .filter((pid) => Number.isInteger(pid) && pid > 0);
}

async function waitForPortToClose(host: string, port: number, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortAvailable(host, port)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function findAvailablePort(host: string, startingPort: number): Promise<number> {
  for (let port = startingPort; port < startingPort + 100; port += 1) {
    if (await isPortAvailable(host, port)) {
      return port;
    }
  }

  throw new Error(`Could not find an available Appium port starting at ${startingPort}.`);
}

async function isPortAvailable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, host);
  });
}

function inferAndroidSdkEnv(): NodeJS.ProcessEnv {
  if (process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT) {
    return {};
  }

  const candidates = [
    join(process.env.HOME ?? "", "Library", "Android", "sdk"),
    join(process.env.HOME ?? "", "Android", "Sdk")
  ];
  const sdkRoot = candidates.find((candidate) => candidate && existsSync(candidate));
  if (!sdkRoot) {
    return {};
  }

  return {
    ANDROID_HOME: sdkRoot,
    ANDROID_SDK_ROOT: sdkRoot
  };
}
