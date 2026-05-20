import type { MobiumConfig } from "../config.js";
import type { DiscoveryResult } from "../devices/types.js";
import { discoverDevices } from "../devices/discover.js";
import { resolveDiscoveryPlatforms, type DiscoverPlatform } from "../server/tools/devices.js";

export type DevicesRequest = {
  platform: DiscoverPlatform;
};

export function parseDevicesArgs(args: string[]): DevicesRequest {
  const values = parseFlags(args);
  const platform = values.platform ?? "both";

  if (platform !== "android" && platform !== "ios" && platform !== "both") {
    throw new Error("devices --platform must be android, ios, or both");
  }

  return { platform };
}

export async function runDevicesCommand(config: MobiumConfig, request: DevicesRequest): Promise<DiscoveryResult> {
  return discoverDevices(resolveDiscoveryPlatforms(config, request.platform));
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
