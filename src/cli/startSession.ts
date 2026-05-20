import { remote } from "webdriverio";
import { ensureAppiumServer } from "../appium/processManager.js";
import type { MobiumConfig } from "../config.js";
import { buildCapabilities, type StartSessionRequest } from "../webdriver/capabilities.js";
import { resolveStartSessionInput } from "../webdriver/resolveSession.js";

export function parseStartSessionArgs(args: string[]): StartSessionRequest {
  const values = parseFlags(args);
  const platform = values.platform;
  const deviceId = values["device-id"] ?? values.udid;

  if (platform !== undefined && platform !== "android" && platform !== "ios") {
    throw new Error("start-session --platform must be android or ios");
  }

  return {
    sessionName: values.name ?? "default",
    platform,
    deviceId,
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

export async function startMobileSession(config: MobiumConfig, request: StartSessionRequest) {
  const { input, device, warnings } = await resolveStartSessionInput(config, request);
  const appiumServer = await ensureAppiumServer(config);
  const capabilities = buildCapabilities(input);
  const driver = await remote({
    hostname: appiumServer.host,
    port: appiumServer.port,
    path: appiumServer.basePath,
    connectionRetryCount: 0,
    capabilities
  });

  return {
    name: input.sessionName,
    sessionId: driver.sessionId,
    appium: {
      host: appiumServer.host,
      port: appiumServer.port,
      basePath: appiumServer.basePath,
      autoStarted: appiumServer.started,
      pid: appiumServer.pid
    },
    platform: input.platform,
    deviceId: input.deviceId,
    device,
    warnings,
    capabilities
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
