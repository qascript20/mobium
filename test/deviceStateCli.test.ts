import { describe, expect, it } from "vitest";
import { parseDeviceStateArgs } from "../src/cli/deviceState.js";

describe("parseDeviceStateArgs", () => {
  it("parses lock state checks", () => {
    expect(parseDeviceStateArgs(["--action", "isLocked", "--platform", "android"])).toEqual(expect.objectContaining({
      action: "isLocked",
      platform: "android",
      sessionName: "default",
      contentType: "plaintext"
    }));
  });

  it("parses clipboard and network flags", () => {
    expect(parseDeviceStateArgs([
      "--action",
      "setClipboard",
      "--content",
      "SGVsbG8=",
      "--content-type",
      "plaintext",
      "--label",
      "greeting"
    ])).toEqual(expect.objectContaining({
      action: "setClipboard",
      content: "SGVsbG8=",
      contentType: "plaintext",
      label: "greeting"
    }));

    expect(parseDeviceStateArgs([
      "--action",
      "toggleWiFi",
      "--enabled",
      "false"
    ])).toEqual(expect.objectContaining({
      action: "toggleWiFi",
      enabled: false
    }));
  });

  it("rejects unknown actions", () => {
    expect(() => parseDeviceStateArgs(["--action", "dance"])).toThrow("device-state requires --action");
  });
});
