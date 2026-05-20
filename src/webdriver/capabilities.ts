import { z } from "zod";
import type { MobilePlatform } from "../devices/types.js";

export const startSessionInputSchema = {
  sessionName: z.string().min(1).default("default"),
  platform: z.enum(["android", "ios"]).optional(),
  deviceId: z.string().min(1).optional(),
  app: z.string().min(1).optional(),
  appPackage: z.string().min(1).optional(),
  appActivity: z.string().min(1).optional(),
  bundleId: z.string().min(1).optional(),
  browserName: z.string().min(1).optional(),
  noReset: z.boolean().default(false),
  fullReset: z.boolean().default(false),
  capabilities: z.record(z.unknown()).default({})
};

export type StartSessionRequest = {
  sessionName: string;
  platform?: MobilePlatform;
  deviceId?: string;
  app?: string;
  appPackage?: string;
  appActivity?: string;
  bundleId?: string;
  browserName?: string;
  noReset: boolean;
  fullReset: boolean;
  capabilities: Record<string, unknown>;
};

export type StartSessionInput = StartSessionRequest & {
  platform: MobilePlatform;
  deviceId: string;
};

export function buildCapabilities(input: StartSessionInput): Record<string, unknown> {
  const automationName = input.platform === "android" ? "UiAutomator2" : "XCUITest";
  const platformName = input.platform === "android" ? "Android" : "iOS";

  const capabilities: Record<string, unknown> = {
    platformName,
    "appium:automationName": automationName,
    "appium:udid": input.deviceId,
    "appium:noReset": input.noReset,
    "appium:fullReset": input.fullReset,
    ...input.capabilities
  };

  if (input.browserName) {
    capabilities.browserName = input.browserName;
  }
  if (input.app) {
    capabilities["appium:app"] = input.app;
  }
  if (input.appPackage) {
    capabilities["appium:appPackage"] = input.appPackage;
  }
  if (input.appActivity) {
    capabilities["appium:appActivity"] = input.appActivity;
  }
  if (input.bundleId) {
    capabilities["appium:bundleId"] = input.bundleId;
  }

  return capabilities;
}
