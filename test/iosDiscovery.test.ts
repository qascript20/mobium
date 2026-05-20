import { describe, expect, it } from "vitest";
import { parseSimctlDevices } from "../src/devices/iosDiscovery.js";

describe("parseSimctlDevices", () => {
  it("normalizes available simulators", () => {
    const result = parseSimctlDevices(JSON.stringify({
      devices: {
        "com.apple.CoreSimulator.SimRuntime.iOS-18-5": [
          {
            name: "iPhone 16",
            udid: "ABC-123",
            state: "Booted",
            isAvailable: true
          },
          {
            name: "iPhone 12",
            udid: "OLD-123",
            state: "Shutdown",
            isAvailable: false
          }
        ]
      }
    }));

    expect(result.devices).toEqual([
      expect.objectContaining({
        id: "ABC-123",
        platform: "ios",
        kind: "simulator",
        state: "booted",
        osVersion: "18.5",
        appiumAutomationName: "XCUITest"
      })
    ]);
  });
});
