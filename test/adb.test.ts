import { afterEach, describe, expect, it, vi } from "vitest";

const existsSync = vi.hoisted(() => vi.fn());
const homedir = vi.hoisted(() => vi.fn(() => "/Users/tester"));

vi.mock("node:fs", () => ({ existsSync }));
vi.mock("node:os", () => ({ homedir }));

describe("resolveAdb", () => {
  afterEach(() => {
    vi.resetModules();
    existsSync.mockReset();
    homedir.mockReturnValue("/Users/tester");
    delete process.env.MOBIUM_ADB_PATH;
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
  });

  it("uses an explicit MOBIUM_ADB_PATH first", async () => {
    process.env.MOBIUM_ADB_PATH = "/custom/adb";
    const { resolveAdb } = await import("../src/android/adb.js");

    expect(resolveAdb()).toEqual({
      command: "/custom/adb",
      source: "env"
    });
  });

  it("uses ANDROID_HOME platform-tools when present", async () => {
    process.env.ANDROID_HOME = "/android/sdk";
    existsSync.mockImplementation((path: string) => path === "/android/sdk/platform-tools/adb");
    const { resolveAdb } = await import("../src/android/adb.js");

    expect(resolveAdb()).toEqual({
      command: "/android/sdk/platform-tools/adb",
      source: "android-home"
    });
  });

  it("falls back to adb on PATH", async () => {
    existsSync.mockReturnValue(false);
    const { resolveAdb } = await import("../src/android/adb.js");

    expect(resolveAdb()).toEqual({
      command: "adb",
      source: "path"
    });
  });
});
