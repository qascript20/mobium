import { discoverDevices } from "./discover.js";
import type { DiscoveryResult, MobileDevice } from "./types.js";

export type DeviceInfoResult = {
  device: MobileDevice;
  warnings: string[];
};

export async function getDeviceInfo(options: { android: boolean; ios: boolean; deviceId: string }): Promise<DeviceInfoResult> {
  return selectDeviceInfo(await discoverDevices(options), options.deviceId);
}

export function selectDeviceInfo(result: DiscoveryResult, deviceId: string): DeviceInfoResult {
  const device = result.devices.find((candidate) => candidate.id === deviceId);
  if (!device) {
    const candidates = result.devices.map((candidate) => candidate.id).join(", ");
    throw new Error(candidates.length > 0
      ? `No device found with id '${deviceId}'. Candidates: ${candidates}`
      : `No device found with id '${deviceId}'.`);
  }

  return {
    device,
    warnings: result.warnings
  };
}
