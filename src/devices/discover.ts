import { discoverAndroidDevices } from "./androidDiscovery.js";
import { discoverIosDevices } from "./iosDiscovery.js";
import type { DiscoveryResult } from "./types.js";

export async function discoverDevices(options: { android: boolean; ios: boolean }): Promise<DiscoveryResult> {
  const results = await Promise.all([
    options.android ? discoverAndroidDevices() : Promise.resolve({ devices: [], warnings: [] }),
    options.ios ? discoverIosDevices() : Promise.resolve({ devices: [], warnings: [] })
  ]);

  return {
    devices: results.flatMap((result) => result.devices),
    warnings: results.flatMap((result) => result.warnings)
  };
}
