import { describe, expect, it, vi } from "vitest";
import { performAppAction, resolveAppId } from "../src/webdriver/appManagement.js";

describe("app management", () => {
  it("resolves app ids from generic or platform-specific fields", () => {
    expect(resolveAppId({ appId: "com.example" })).toBe("com.example");
    expect(resolveAppId({ appPackage: "com.android.settings" })).toBe("com.android.settings");
    expect(resolveAppId({ bundleId: "com.example.ios" })).toBe("com.example.ios");
  });

  it("dispatches activate through mobile execute", async () => {
    const execute = vi.fn().mockResolvedValue(true);

    await expect(performAppAction({ execute }, {
      action: "activate",
      sessionName: "default",
      appPackage: "com.android.settings",
      seconds: 0
    })).resolves.toEqual({
      action: "activate",
      appId: "com.android.settings",
      result: true
    });

    expect(execute).toHaveBeenCalledWith("mobile: activateApp", { appId: "com.android.settings" });
  });

  it("requires an app id for state actions", async () => {
    await expect(performAppAction({ execute: vi.fn() }, {
      action: "state",
      sessionName: "default",
      seconds: 0
    })).rejects.toThrow("requires appId");
  });
});
