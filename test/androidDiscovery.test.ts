import { describe, expect, it } from "vitest";
import { enrichAndroidDevice, parseAdbDevices, parseAndroidGetprop } from "../src/devices/androidDiscovery.js";

describe("parseAdbDevices", () => {
  it("normalizes connected android devices", () => {
    const result = parseAdbDevices(`List of devices attached
emulator-5554 device product:sdk_gphone64_arm64 model:sdk_gphone64_arm64 device:emu64a transport_id:1
R5CT123456 device product:o1q model:SM_G991B device:o1q transport_id:2
`);

    expect(result.devices).toEqual([
      expect.objectContaining({
        id: "emulator-5554",
        platform: "android",
        kind: "emulator",
        state: "available",
        appiumAutomationName: "UiAutomator2"
      }),
      expect.objectContaining({
        id: "R5CT123456",
        platform: "android",
        kind: "real",
        state: "available"
      })
    ]);
  });

  it("reports unauthorized devices", () => {
    const result = parseAdbDevices(`List of devices attached
abc unauthorized usb:1-1
`);

    expect(result.devices[0]?.state).toBe("unknown");
    expect(result.warnings[0]).toContain("unauthorized");
  });

  it("parses and applies Android getprop metadata", () => {
    const props = parseAndroidGetprop(`[ro.build.version.release]: [15]
[ro.build.version.sdk]: [35]
[ro.product.manufacturer]: [Google]
[ro.product.model]: [Pixel 9]
`);

    const device = enrichAndroidDevice({
      id: "emulator-5554",
      platform: "android",
      name: "emulator-5554",
      state: "available",
      kind: "emulator",
      appiumAutomationName: "UiAutomator2"
    }, props);

    expect(device).toEqual(expect.objectContaining({
      name: "Google Pixel 9",
      manufacturer: "Google",
      model: "Pixel 9",
      osVersion: "15",
      apiLevel: 35
    }));
  });
});
