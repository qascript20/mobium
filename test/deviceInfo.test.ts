import { describe, expect, it } from "vitest";
import { selectDeviceInfo } from "../src/devices/info.js";

describe("selectDeviceInfo", () => {
  it("returns the requested device with discovery warnings", () => {
    expect(selectDeviceInfo({
      devices: [
        {
          id: "emulator-5554",
          platform: "android",
          name: "Pixel",
          state: "available",
          kind: "emulator",
          appiumAutomationName: "UiAutomator2"
        }
      ],
      warnings: ["xcrun unavailable"]
    }, "emulator-5554")).toEqual({
      device: {
        id: "emulator-5554",
        platform: "android",
        name: "Pixel",
        state: "available",
        kind: "emulator",
        appiumAutomationName: "UiAutomator2"
      },
      warnings: ["xcrun unavailable"]
    });
  });

  it("reports candidate ids when a device is missing", () => {
    expect(() => selectDeviceInfo({
      devices: [
        {
          id: "sim-1",
          platform: "ios",
          name: "iPhone",
          state: "booted",
          kind: "simulator",
          appiumAutomationName: "XCUITest"
        }
      ],
      warnings: []
    }, "missing")).toThrow("Candidates: sim-1");
  });
});
