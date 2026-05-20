import { remote } from "webdriverio";
import { ensureAppiumServer } from "../appium/processManager.js";
import type { MobiumConfig } from "../config.js";
import { performAppAction, type AppActionRequest } from "../webdriver/appManagement.js";
import { buildCapabilities, type StartSessionRequest } from "../webdriver/capabilities.js";
import { resolveStartSessionInput } from "../webdriver/resolveSession.js";

type CliAppRequest = AppActionRequest & StartSessionRequest;

export function parseAppArgs(args: string[]): CliAppRequest {
  const values = parseFlags(args);
  const action = values.action;
  const platform = values.platform;

  if (!isAppAction(action)) {
    throw new Error("app requires --action install|remove|activate|terminate|state|background|reset");
  }
  if (platform !== undefined && platform !== "android" && platform !== "ios") {
    throw new Error("app --platform must be android or ios");
  }

  return {
    action,
    sessionName: values.name ?? "default",
    platform,
    deviceId: values["device-id"] ?? values.udid,
    app: values.app,
    appId: values["app-id"],
    appPackage: values["app-package"],
    appActivity: values["app-activity"],
    bundleId: values["bundle-id"],
    browserName: values["browser-name"],
    noReset: values["no-reset"] === "true" || values["no-reset"] === "",
    fullReset: values["full-reset"] === "true" || values["full-reset"] === "",
    capabilities: parseCapabilities(values.capability),
    seconds: values.seconds ? Number(values.seconds) : 0
  };
}

export async function runAppCommand(config: MobiumConfig, request: CliAppRequest): Promise<Record<string, unknown>> {
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
    app: await performAppAction(driver, request)
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

function isAppAction(value: string | undefined): value is CliAppRequest["action"] {
  return value === "install"
    || value === "remove"
    || value === "activate"
    || value === "terminate"
    || value === "state"
    || value === "background"
    || value === "reset";
}
