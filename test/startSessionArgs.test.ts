import { describe, expect, it } from "vitest";
import { parseStartSessionArgs } from "../src/cli/startSession.js";

describe("parseStartSessionArgs", () => {
  it("allows sessions without platform or device id", () => {
    expect(parseStartSessionArgs([])).toEqual(expect.objectContaining({
      platform: undefined,
      deviceId: undefined
    }));
  });

  it("allows Android sessions without a device id", () => {
    expect(parseStartSessionArgs(["--platform", "android"])).toEqual(expect.objectContaining({
      platform: "android",
      deviceId: undefined
    }));
  });

  it("accepts explicit app targets", () => {
    expect(parseStartSessionArgs([
      "--platform",
      "android",
      "--device-id",
      "device-1",
      "--app-package",
      "com.example",
      "--app-activity",
      ".MainActivity",
      "--no-reset"
    ])).toEqual(expect.objectContaining({
      appPackage: "com.example",
      appActivity: ".MainActivity",
      noReset: true
    }));
  });

  it("allows a device id without a platform", () => {
    expect(parseStartSessionArgs(["--device-id", "device-1"])).toEqual(expect.objectContaining({
      deviceId: "device-1",
      platform: undefined
    }));
  });
});
