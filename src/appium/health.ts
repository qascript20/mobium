import type { MobiumConfig } from "../config.js";
import { resolveAdb } from "../android/adb.js";
import { resolveAppiumCommand } from "./command.js";
import { runCommand } from "../util/command.js";

export type HealthCheck = {
  name: string;
  ok: boolean;
  detail: string;
  remediation?: string;
};

export type DoctorReport = {
  checks: HealthCheck[];
  ok: boolean;
};

export async function runDoctor(config: MobiumConfig): Promise<DoctorReport> {
  const adb = resolveAdb();
  const checks = await Promise.all([
    checkNode(),
    checkCommand("appium", [resolveAppiumCommand(config.appium.command), "--version"], "Install Appium with `npm install -g appium` or configure MOBIUM_APPIUM_COMMAND."),
    checkCommand("adb", [adb.command, "version"], "Install Android platform tools, set MOBIUM_ADB_PATH, or ensure `adb` is on PATH."),
    checkCommand("xcrun", ["xcrun", "--version"], "Install Xcode command line tools for iOS simulator support.")
  ]);

  return {
    checks,
    ok: checks.every((check) => check.ok)
  };
}

function checkNode(): HealthCheck {
  const major = Number(process.versions.node.split(".")[0]);
  return {
    name: "node",
    ok: major >= 20,
    detail: `Node ${process.versions.node}`,
    remediation: major >= 20 ? undefined : "Install Node.js 20 or newer."
  };
}

async function checkCommand(name: string, commandAndArgs: string[], remediation: string): Promise<HealthCheck> {
  const [command, ...args] = commandAndArgs;
  const result = await runCommand(command, args);
  const detail = result.ok
    ? firstLine(result.stdout || result.stderr) || `${command} is available`
    : result.error ?? `${command} is unavailable`;

  return {
    name,
    ok: result.ok,
    detail,
    remediation: result.ok ? undefined : remediation
  };
}

function firstLine(value: string): string {
  return value.split(/\r?\n/).find(Boolean)?.trim() ?? "";
}
