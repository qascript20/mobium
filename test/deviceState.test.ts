import { describe, expect, it, vi } from "vitest";
import { performDeviceStateAction } from "../src/webdriver/deviceState.js";

describe("device state actions", () => {
  it("checks locked state", async () => {
    const isLocked = vi.fn(async () => true);

    await expect(performDeviceStateAction({ isLocked }, {
      action: "isLocked",
      sessionName: "default",
      contentType: "plaintext"
    })).resolves.toEqual({
      action: "isLocked",
      locked: true
    });
  });

  it("sets clipboard content", async () => {
    const setClipboard = vi.fn(async () => "ok");

    await expect(performDeviceStateAction({ setClipboard }, {
      action: "setClipboard",
      sessionName: "default",
      content: "SGVsbG8=",
      contentType: "plaintext",
      label: "greeting"
    })).resolves.toEqual({
      action: "setClipboard",
      contentType: "plaintext",
      label: "greeting",
      result: "ok"
    });

    expect(setClipboard).toHaveBeenCalledWith("SGVsbG8=", "plaintext", "greeting");
  });

  it("requires content for setClipboard", async () => {
    await expect(performDeviceStateAction({ setClipboard: vi.fn() }, {
      action: "setClipboard",
      sessionName: "default",
      contentType: "plaintext"
    })).rejects.toThrow("requires content");
  });

  it("toggles wifi with explicit enabled state", async () => {
    const toggleWiFi = vi.fn(async () => true);

    await expect(performDeviceStateAction({ toggleWiFi }, {
      action: "toggleWiFi",
      sessionName: "default",
      enabled: false,
      contentType: "plaintext"
    })).resolves.toEqual({
      action: "toggleWiFi",
      enabled: false,
      result: true
    });

    expect(toggleWiFi).toHaveBeenCalledWith(false);
  });
});
