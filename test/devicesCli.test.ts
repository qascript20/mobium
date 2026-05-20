import { describe, expect, it } from "vitest";
import { parseDevicesArgs } from "../src/cli/devices.js";

describe("parseDevicesArgs", () => {
  it("defaults to discovering both platforms", () => {
    expect(parseDevicesArgs([])).toEqual({
      platform: "both"
    });
  });

  it("parses platform filters", () => {
    expect(parseDevicesArgs(["--platform", "android"])).toEqual({
      platform: "android"
    });
    expect(parseDevicesArgs(["--platform", "ios"])).toEqual({
      platform: "ios"
    });
  });

  it("rejects invalid platform filters", () => {
    expect(() => parseDevicesArgs(["--platform", "windows"])).toThrow("devices --platform");
  });
});
