import { remote } from "webdriverio";
import { ensureAppiumServer } from "../appium/processManager.js";
import type { MobiumConfig } from "../config.js";
import { buildCapabilities, type StartSessionRequest } from "../webdriver/capabilities.js";
import { performDeviceStateAction, type DeviceStateActionRequest } from "../webdriver/deviceState.js";
import { resolveStartSessionInput } from "../webdriver/resolveSession.js";

type CliDeviceStateRequest = DeviceStateActionRequest & StartSessionRequest;

export function parseDeviceStateArgs(args: string[]): CliDeviceStateRequest {
  const values = parseFlags(args);
  const action = values.action;
  const platform = values.platform;

  if (!isDeviceStateAction(action)) {
    throw new Error("device-state requires --action lock|unlock|isLocked|getClipboard|setClipboard|toggleAirplaneMode|toggleData|toggleWiFi");
  }
  if (platform !== undefined && platform !== "android" && platform !== "ios") {
    throw new Error("device-state --platform must be android or ios");
  }

  return {
    action,
    sessionName: values.name ?? "default",
    seconds: parseOptionalNumber(values.seconds),
    content: values.content,
    contentType: parseContentType(values["content-type"]),
    label: values.label,
    enabled: parseOptionalBoolean(values.enabled),
    timeoutMs: parseOptionalNumber(values.timeout),
    unlockKey: values["unlock-key"],
    unlockType: values["unlock-type"],
    unlockStrategy: parseUnlockStrategy(values["unlock-strategy"]),
    platform,
    deviceId: values["device-id"] ?? values.udid,
    app: values.app,
    appPackage: values["app-package"],
    appActivity: values["app-activity"],
    bundleId: values["bundle-id"],
    browserName: values["browser-name"],
    noReset: values["no-reset"] === "true" || values["no-reset"] === "",
    fullReset: values["full-reset"] === "true" || values["full-reset"] === "",
    capabilities: parseCapabilities(values.capability)
  };
}

export async function runDeviceStateCommand(config: MobiumConfig, request: CliDeviceStateRequest): Promise<Record<string, unknown>> {
  const { input, device, warnings } = await resolveStartSessionInput(config, request);
  const appiumServer = await ensureAppiumServer(config);
  const driver = await remote({
    hostname: appiumServer.host,
    port: appiumServer.port,
    path: appiumServer.basePath,
    connectionRetryCount: 0,
    capabilities: buildCapabilities(input)
  });

  return {
    session: {
      sessionId: driver.sessionId,
      platform: input.platform,
      deviceId: input.deviceId,
      device,
      warnings,
      appium: {
        host: appiumServer.host,
        port: appiumServer.port,
        basePath: appiumServer.basePath,
        autoStarted: appiumServer.started,
        pid: appiumServer.pid
      }
    },
    device: await performDeviceStateAction(driver, request)
  };
}

function parseFlags(args: string[]): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument '${arg}'. Use --key value flags.`);
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = "";
      continue;
    }

    values[key] = next;
    index += 1;
  }

  return values;
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric value, got '${value}'.`);
  }
  return parsed;
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "" || value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error(`Expected boolean value, got '${value}'.`);
}

function parseContentType(value: string | undefined): CliDeviceStateRequest["contentType"] {
  if (value === undefined) {
    return "plaintext";
  }
  if (value === "plaintext" || value === "image" || value === "url") {
    return value;
  }
  throw new Error("device-state --content-type must be plaintext, image, or url");
}

function parseUnlockStrategy(value: string | undefined): CliDeviceStateRequest["unlockStrategy"] {
  if (value === undefined) {
    return undefined;
  }
  if (value === "locksettings" || value === "uiautomator") {
    return value;
  }
  throw new Error("device-state --unlock-strategy must be locksettings or uiautomator");
}

function parseCapabilities(value: string | undefined): Record<string, unknown> {
  if (!value) {
    return {};
  }

  const parsed = JSON.parse(value) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("--capability must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function isDeviceStateAction(value: string | undefined): value is CliDeviceStateRequest["action"] {
  return value === "lock"
    || value === "unlock"
    || value === "isLocked"
    || value === "getClipboard"
    || value === "setClipboard"
    || value === "toggleAirplaneMode"
    || value === "toggleData"
    || value === "toggleWiFi";
}
