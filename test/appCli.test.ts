import { describe, expect, it } from "vitest";
import { parseAppArgs } from "../src/cli/app.js";

describe("parseAppArgs", () => {
  it("allows app actions without platform so discovery can infer it", () => {
    expect(parseAppArgs([
      "--action",
      "state",
      "--app-package",
      "com.android.settings"
    ])).toEqual(expect.objectContaining({
      action: "state",
      platform: undefined,
      appPackage: "com.android.settings"
    }));
  });

  it("parses app action flags", () => {
    expect(parseAppArgs([
      "--action",
      "state",
      "--platform",
      "android",
      "--app-package",
      "com.android.settings"
    ])).toEqual(expect.objectContaining({
      action: "state",
      platform: "android",
      appPackage: "com.android.settings",
      sessionName: "default"
    }));
  });

  it("requires a valid action", () => {
    expect(() => parseAppArgs(["--platform", "android"])).toThrow("--action");
    expect(() => parseAppArgs(["--action", "dance"])).toThrow("--action");
  });
});
