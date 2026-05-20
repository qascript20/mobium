import { remote } from "webdriverio";
import { ensureAppiumServer } from "../appium/processManager.js";
import type { MobiumConfig } from "../config.js";
import { buildCapabilities, type StartSessionRequest } from "../webdriver/capabilities.js";
import { performInteraction, type InteractionAction, type InteractionRequest } from "../webdriver/interactions.js";
import { resolveStartSessionInput } from "../webdriver/resolveSession.js";

type CliInteractionRequest = InteractionRequest & StartSessionRequest;

export function parseInteractArgs(args: string[]): CliInteractionRequest {
  const values = parseFlags(args);
  const action = values.action;
  const platform = values.platform;

  if (!isInteractionAction(action)) {
    throw new Error("interact requires --action tap|type|clear|wait|pressKey|swipe|scroll|longPress|drag");
  }
  if (platform !== undefined && platform !== "android" && platform !== "ios") {
    throw new Error("interact --platform must be android or ios");
  }

  return {
    action,
    sessionName: values.name ?? "default",
    ref: values.ref,
    fromRef: values["from-ref"],
    toRef: values["to-ref"],
    text: values.text,
    accessibilityId: values["accessibility-id"],
    x: parseOptionalNumber(values.x),
    y: parseOptionalNumber(values.y),
    toX: parseOptionalNumber(values["to-x"]),
    toY: parseOptionalNumber(values["to-y"]),
    key: values.key,
    keycode: parseOptionalNumber(values.keycode),
    timeoutMs: parseOptionalNumber(values.timeout),
    durationMs: parseOptionalNumber(values.duration),
    direction: parseDirection(values.direction),
    percent: parseOptionalNumber(values.percent),
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

export async function runInteractCommand(config: MobiumConfig, request: CliInteractionRequest): Promise<Record<string, unknown>> {
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
    interaction: await performInteraction(driver, request)
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

function parseDirection(value: string | undefined): CliInteractionRequest["direction"] {
  if (value === undefined) {
    return undefined;
  }
  if (value === "up" || value === "down" || value === "left" || value === "right") {
    return value;
  }
  throw new Error("interact --direction must be up, down, left, or right");
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

function isInteractionAction(value: string | undefined): value is InteractionAction {
  return value === "tap"
    || value === "type"
    || value === "clear"
    || value === "wait"
    || value === "pressKey"
    || value === "swipe"
    || value === "scroll"
    || value === "longPress"
    || value === "drag";
}
