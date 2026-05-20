import { z } from "zod";

export const deviceStateActionSchema = {
  action: z.enum(["lock", "unlock", "isLocked", "getClipboard", "setClipboard", "toggleAirplaneMode", "toggleData", "toggleWiFi"]),
  sessionName: z.string().min(1).default("default"),
  seconds: z.number().int().nonnegative().optional(),
  content: z.string().optional(),
  contentType: z.enum(["plaintext", "image", "url"]).default("plaintext"),
  label: z.string().optional(),
  enabled: z.boolean().optional(),
  timeoutMs: z.number().int().positive().optional(),
  unlockKey: z.string().optional(),
  unlockType: z.string().optional(),
  unlockStrategy: z.enum(["locksettings", "uiautomator"]).optional()
};

export type DeviceStateActionRequest = {
  action: "lock" | "unlock" | "isLocked" | "getClipboard" | "setClipboard" | "toggleAirplaneMode" | "toggleData" | "toggleWiFi";
  sessionName: string;
  seconds?: number;
  content?: string;
  contentType: "plaintext" | "image" | "url";
  label?: string;
  enabled?: boolean;
  timeoutMs?: number;
  unlockKey?: string;
  unlockType?: string;
  unlockStrategy?: "locksettings" | "uiautomator";
};

type DeviceStateDriver = {
  lock?: (seconds?: number) => Promise<unknown>;
  unlock?: (options?: {
    strategy?: "locksettings" | "uiautomator";
    timeoutMs?: number;
    unlockKey?: string;
    unlockType?: string;
  }) => Promise<unknown>;
  isLocked?: () => Promise<boolean>;
  getClipboard?: (contentType?: string) => Promise<string>;
  setClipboard?: (content: string, contentType?: string, label?: string) => Promise<unknown>;
  toggleAirplaneMode?: (enabled: boolean) => Promise<unknown>;
  toggleData?: (enabled: boolean) => Promise<unknown>;
  toggleWiFi?: (enabled: boolean) => Promise<unknown>;
};

export async function performDeviceStateAction(driver: DeviceStateDriver, request: DeviceStateActionRequest): Promise<Record<string, unknown>> {
  switch (request.action) {
    case "lock":
      requireDriverMethod(driver.lock, "lock");
      return {
        action: request.action,
        seconds: request.seconds,
        result: await driver.lock(request.seconds)
      };
    case "unlock":
      requireDriverMethod(driver.unlock, "unlock");
      return {
        action: request.action,
        result: await driver.unlock({
          strategy: request.unlockStrategy,
          timeoutMs: request.timeoutMs,
          unlockKey: request.unlockKey,
          unlockType: request.unlockType
        })
      };
    case "isLocked":
      requireDriverMethod(driver.isLocked, "isLocked");
      return {
        action: request.action,
        locked: await driver.isLocked()
      };
    case "getClipboard":
      requireDriverMethod(driver.getClipboard, "getClipboard");
      return {
        action: request.action,
        contentType: request.contentType,
        content: await driver.getClipboard(request.contentType)
      };
    case "setClipboard":
      requireDriverMethod(driver.setClipboard, "setClipboard");
      if (request.content === undefined) {
        throw new Error("setClipboard requires content.");
      }
      return {
        action: request.action,
        contentType: request.contentType,
        label: request.label,
        result: await driver.setClipboard(request.content, request.contentType, request.label)
      };
    case "toggleAirplaneMode":
      requireDriverMethod(driver.toggleAirplaneMode, "toggleAirplaneMode");
      return {
        action: request.action,
        enabled: requireEnabled(request),
        result: await driver.toggleAirplaneMode(requireEnabled(request))
      };
    case "toggleData":
      requireDriverMethod(driver.toggleData, "toggleData");
      return {
        action: request.action,
        enabled: requireEnabled(request),
        result: await driver.toggleData(requireEnabled(request))
      };
    case "toggleWiFi":
      requireDriverMethod(driver.toggleWiFi, "toggleWiFi");
      return {
        action: request.action,
        enabled: requireEnabled(request),
        result: await driver.toggleWiFi(requireEnabled(request))
      };
  }
}

function requireEnabled(request: DeviceStateActionRequest): boolean {
  if (request.enabled === undefined) {
    throw new Error(`${request.action} requires enabled.`);
  }
  return request.enabled;
}

function requireDriverMethod<T>(method: T | undefined, name: string): asserts method is T {
  if (!method) {
    throw new Error(`Device state action requires driver.${name}.`);
  }
}
