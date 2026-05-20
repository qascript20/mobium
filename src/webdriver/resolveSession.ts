import type { MobiumConfig } from "../config.js";
import { discoverDevices } from "../devices/discover.js";
import type { MobileDevice } from "../devices/types.js";
import type { StartSessionInput, StartSessionRequest } from "./capabilities.js";

export async function resolveStartSessionInput(
  config: MobiumConfig,
  request: StartSessionRequest
): Promise<{ input: StartSessionInput; device: MobileDevice; warnings: string[] }> {
  if (request.deviceId && request.platform) {
    return {
      input: applyLaunchDefaults(config, request as StartSessionInput),
      device: {
        id: request.deviceId,
        platform: request.platform,
        name: request.deviceId,
        state: "unknown",
        kind: request.platform === "android" ? "real" : "simulator",
        appiumAutomationName: request.platform === "android" ? "UiAutomator2" : "XCUITest"
      },
      warnings: []
    };
  }

  const discovery = await discoverDevices({
    android: config.capabilities.android,
    ios: config.capabilities.ios
  });
  const device = selectDeviceForSession(request, discovery.devices);

  return {
    input: applyLaunchDefaults(config, {
      ...request,
      platform: device.platform,
      deviceId: device.id
    }),
    device,
    warnings: discovery.warnings
  };
}

export function selectDeviceForSession(request: StartSessionRequest, devices: MobileDevice[]): MobileDevice {
  const availableDevices = devices.filter((device) => device.state === "available" || device.state === "booted");

  if (request.deviceId) {
    const device = availableDevices.find((candidate) => candidate.id === request.deviceId);
    if (!device) {
      throw new Error(`No available device found with id '${request.deviceId}'.`);
    }
    if (request.platform && device.platform !== request.platform) {
      throw new Error(`Device '${request.deviceId}' is ${device.platform}, not ${request.platform}.`);
    }
    return device;
  }

  const candidates = request.platform
    ? availableDevices.filter((device) => device.platform === request.platform)
    : defaultDeviceCandidates(availableDevices);

  if (candidates.length === 0) {
    const platformText = request.platform ? ` ${request.platform}` : "";
    throw new Error(`No available${platformText} devices found.`);
  }

  if (candidates.length > 1) {
    const list = candidates.map((device) => `${device.name} (${device.platform}, ${device.id})`).join("; ");
    throw new Error(`Multiple available devices found. Pass --device-id or set deviceId. Candidates: ${list}`);
  }

  return candidates[0];
}

function defaultDeviceCandidates(devices: MobileDevice[]): MobileDevice[] {
  const realDevices = devices.filter((device) => device.kind === "real");
  if (realDevices.length === 1) {
    return realDevices;
  }

  const bootedDevices = devices.filter((device) => device.state === "booted");
  if (bootedDevices.length === 1) {
    return bootedDevices;
  }

  return devices;
}

function applyLaunchDefaults(config: MobiumConfig, input: StartSessionInput): StartSessionInput {
  const configuredInput = applyConfiguredAppTarget(config, input);

  if (!hasLaunchTarget(configuredInput) && configuredInput.platform === "android") {
    return {
      ...configuredInput,
      appPackage: "com.android.settings",
      appActivity: ".Settings",
      noReset: true
    };
  }

  return configuredInput;
}

function hasLaunchTarget(input: Pick<StartSessionRequest, "app" | "appPackage" | "bundleId" | "browserName">): boolean {
  return Boolean(input.app || input.appPackage || input.bundleId || input.browserName);
}

function applyConfiguredAppTarget(config: MobiumConfig, input: StartSessionInput): StartSessionInput {
  if (hasLaunchTarget(input)) {
    return input;
  }

  const configuredTarget = {
    app: config.app.app,
    appPackage: config.app.appPackage,
    appActivity: config.app.appActivity,
    bundleId: config.app.bundleId,
    browserName: config.app.browserName
  };

  if (!hasLaunchTarget(configuredTarget)) {
    return input;
  }

  return {
    ...input,
    ...configuredTarget,
    noReset: input.noReset || Boolean(configuredTarget.appPackage || configuredTarget.bundleId || configuredTarget.browserName)
  };
}
