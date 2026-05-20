import { resolveAdb } from "../android/adb.js";
import { runCommand } from "../util/command.js";
import type { DiscoveryResult, MobileDevice } from "./types.js";

export async function discoverAndroidDevices(): Promise<DiscoveryResult> {
  const adb = resolveAdb();
  const adbResult = await runCommand(adb.command, ["devices", "-l"]);
  if (!adbResult.ok) {
    return {
      devices: [],
      warnings: [`Android discovery skipped: ${adbResult.error ?? "adb is unavailable"}. Set MOBIUM_ADB_PATH or add Android platform-tools to PATH.`]
    };
  }

  const result = parseAdbDevices(adbResult.stdout);
  const enrichedDevices = await Promise.all(
    result.devices.map(async (device) => {
      if (device.state !== "available") {
        return device;
      }

      const propsResult = await runCommand(adb.command, ["-s", device.id, "shell", "getprop"]);
      if (!propsResult.ok) {
        result.warnings.push(`Android device ${device.id} metadata skipped: ${propsResult.error ?? "getprop failed"}`);
        return device;
      }

      return enrichAndroidDevice(device, parseAndroidGetprop(propsResult.stdout));
    })
  );

  return {
    devices: enrichedDevices,
    warnings: result.warnings
  };
}

export function parseAdbDevices(output: string): DiscoveryResult {
  const devices: MobileDevice[] = [];
  const warnings: string[] = [];
  const lines = output.split(/\r?\n/).slice(1).map((line) => line.trim()).filter(Boolean);

  for (const line of lines) {
    const [serial, rawState, ...detailParts] = line.split(/\s+/);
    if (!serial || !rawState) {
      continue;
    }

    if (rawState === "unauthorized") {
      warnings.push(`Android device ${serial} is unauthorized. Confirm the USB debugging prompt on the device.`);
    }

    const details = parseAdbDetails(detailParts);
    const state = rawState === "device" ? "available" : rawState === "offline" ? "offline" : "unknown";

    devices.push({
      id: serial,
      platform: "android",
      name: details.model ?? serial,
      state,
      kind: serial.startsWith("emulator-") ? "emulator" : "real",
      model: details.model,
      appiumAutomationName: "UiAutomator2"
    });
  }

  return { devices, warnings };
}

function parseAdbDetails(parts: string[]): Record<string, string> {
  const details: Record<string, string> = {};
  for (const part of parts) {
    const [key, ...valueParts] = part.split(":");
    if (key && valueParts.length > 0) {
      details[key] = valueParts.join(":");
    }
  }
  return details;
}

export function parseAndroidGetprop(output: string): Record<string, string> {
  const props: Record<string, string> = {};
  for (const line of output.split(/\r?\n/)) {
    const match = line.match(/^\[([^\]]+)]: \[(.*)]$/);
    if (match) {
      props[match[1]] = match[2];
    }
  }
  return props;
}

export function enrichAndroidDevice(device: MobileDevice, props: Record<string, string>): MobileDevice {
  const manufacturer = props["ro.product.manufacturer"] || props["ro.product.vendor.manufacturer"];
  const model = props["ro.product.model"] || props["ro.product.vendor.model"] || device.model;
  const osVersion = props["ro.build.version.release"];
  const rawApiLevel = props["ro.build.version.sdk"];
  const apiLevel = rawApiLevel ? Number(rawApiLevel) : undefined;
  const displayName = [manufacturer, model].filter(Boolean).join(" ").trim();

  return {
    ...device,
    name: displayName || model || device.name,
    model,
    manufacturer,
    osVersion,
    apiLevel: Number.isFinite(apiLevel) ? apiLevel : undefined
  };
}
