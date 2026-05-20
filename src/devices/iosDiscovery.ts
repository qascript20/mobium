import { runCommand } from "../util/command.js";
import type { DiscoveryResult, MobileDevice } from "./types.js";

type SimctlDevice = {
  name: string;
  udid: string;
  state: string;
  isAvailable?: boolean;
};

type SimctlList = {
  devices?: Record<string, SimctlDevice[]>;
};

export async function discoverIosDevices(): Promise<DiscoveryResult> {
  const simctlResult = await runCommand("xcrun", ["simctl", "list", "devices", "--json"]);
  if (!simctlResult.ok) {
    return {
      devices: [],
      warnings: [`iOS simulator discovery skipped: ${simctlResult.error ?? "xcrun simctl is unavailable"}`]
    };
  }

  return parseSimctlDevices(simctlResult.stdout);
}

export function parseSimctlDevices(output: string): DiscoveryResult {
  const devices: MobileDevice[] = [];
  const warnings: string[] = [];

  let parsed: SimctlList;
  try {
    parsed = JSON.parse(output) as SimctlList;
  } catch (error) {
    return {
      devices: [],
      warnings: [`iOS simulator discovery failed: invalid simctl JSON (${String(error)})`]
    };
  }

  for (const [runtime, runtimeDevices] of Object.entries(parsed.devices ?? {})) {
    const osVersion = parseRuntimeVersion(runtime);
    for (const device of runtimeDevices) {
      if (device.isAvailable === false) {
        continue;
      }

      devices.push({
        id: device.udid,
        platform: "ios",
        name: device.name,
        state: device.state === "Booted" ? "booted" : device.state === "Shutdown" ? "available" : "unknown",
        kind: "simulator",
        osVersion,
        model: device.name,
        appiumAutomationName: "XCUITest"
      });
    }
  }

  return { devices, warnings };
}

function parseRuntimeVersion(runtime: string): string | undefined {
  const match = runtime.match(/iOS[-\s](.+)$/);
  return match?.[1]?.replaceAll("-", ".");
}
