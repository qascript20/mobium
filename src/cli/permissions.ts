import { remote } from "webdriverio";
import { ensureAppiumServer } from "../appium/processManager.js";
import type { MobiumConfig } from "../config.js";
import { buildCapabilities, type StartSessionRequest } from "../webdriver/capabilities.js";
import { performPermissionsAction, type PermissionsActionRequest } from "../webdriver/permissions.js";
import { resolveStartSessionInput } from "../webdriver/resolveSession.js";

type CliPermissionsRequest = PermissionsActionRequest & StartSessionRequest;

export function parsePermissionsArgs(args: string[]): CliPermissionsRequest {
  const values = parseFlags(args);
  const action = values.action;
  const platform = values.platform;

  if (!isPermissionsAction(action)) {
    throw new Error("permissions requires --action get|grant|revoke|set");
  }
  if (platform !== undefined && platform !== "android" && platform !== "ios") {
    throw new Error("permissions --platform must be android or ios");
  }

  return {
    action,
    sessionName: values.name ?? "default",
    appId: values["app-id"],
    appPackage: values["app-package"],
    appActivity: values["app-activity"],
    bundleId: values["bundle-id"],
    permissions: parsePermissions(values.permissions),
    permissionType: parsePermissionType(values.type),
    permissionAction: parsePermissionAction(values["permission-action"]),
    target: parseTarget(values.target),
    platform,
    deviceId: values["device-id"] ?? values.udid,
    app: values.app,
    browserName: values["browser-name"],
    noReset: values["no-reset"] === "true" || values["no-reset"] === "",
    fullReset: values["full-reset"] === "true" || values["full-reset"] === "",
    capabilities: parseCapabilities(values.capability)
  };
}

export async function runPermissionsCommand(config: MobiumConfig, request: CliPermissionsRequest): Promise<Record<string, unknown>> {
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
    permissions: await performPermissionsAction(driver, request)
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

function parsePermissions(value: string | undefined): string | string[] | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "all") {
    return value;
  }
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function parsePermissionType(value: string | undefined): CliPermissionsRequest["permissionType"] {
  if (value === undefined) {
    return "granted";
  }
  if (value === "requested" || value === "granted" || value === "denied") {
    return value;
  }
  throw new Error("permissions --type must be requested, granted, or denied");
}

function parsePermissionAction(value: string | undefined): CliPermissionsRequest["permissionAction"] {
  if (value === undefined) {
    return undefined;
  }
  if (value === "grant" || value === "revoke" || value === "allow" || value === "deny" || value === "ignore" || value === "default") {
    return value;
  }
  throw new Error("permissions --permission-action must be grant, revoke, allow, deny, ignore, or default");
}

function parseTarget(value: string | undefined): CliPermissionsRequest["target"] {
  if (value === undefined) {
    return "pm";
  }
  if (value === "pm" || value === "appops") {
    return value;
  }
  throw new Error("permissions --target must be pm or appops");
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

function isPermissionsAction(value: string | undefined): value is CliPermissionsRequest["action"] {
  return value === "get" || value === "grant" || value === "revoke" || value === "set";
}
