import { remote } from "webdriverio";
import { ensureAppiumServer } from "../appium/processManager.js";
import type { MobiumConfig } from "../config.js";
import { buildCapabilities, type StartSessionRequest } from "../webdriver/capabilities.js";
import { performInspection, type InspectAction, type InspectRequest } from "../webdriver/inspection.js";
import { resolveStartSessionInput } from "../webdriver/resolveSession.js";
import { buildAppKey } from "../navGraph/navGraph.js";

type CliInspectRequest = InspectRequest & StartSessionRequest;

export function parseInspectArgs(args: string[]): CliInspectRequest {
  const values = parseFlags(args);
  const action = values.action ?? "snapshot";
  const platform = values.platform;

  if (!isInspectAction(action)) {
    throw new Error("inspect --action must be snapshot, diff, screenshot, source, contexts, or setContext");
  }
  if (platform !== undefined && platform !== "android" && platform !== "ios") {
    throw new Error("inspect --platform must be android or ios");
  }

  return {
    action,
    sessionName: values.name ?? "default",
    raw: values.raw === "true" || values.raw === "",
    context: values.context,
    waitForWebviewMs: parseOptionalNumber(values["wait-for-webview-ms"]),
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

export async function runInspectCommand(config: MobiumConfig, request: CliInspectRequest): Promise<Record<string, unknown>> {
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
  const artifactAppKey = buildAppKey({
    name: input.sessionName,
    sessionId: driver.sessionId,
    platform: input.platform,
    deviceId: input.deviceId,
    capabilities,
    createdAt: new Date().toISOString(),
    device,
    warnings
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
    inspection: await performInspection(config, driver, { ...request, artifactAppKey })
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

function isInspectAction(value: string): value is InspectAction {
  return value === "snapshot"
    || value === "diff"
    || value === "screenshot"
    || value === "source"
    || value === "contexts"
    || value === "setContext";
}
