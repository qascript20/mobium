import { afterEach, describe, expect, it, vi } from "vitest";

const existsSync = vi.hoisted(() => vi.fn());
const runCommand = vi.hoisted(() => vi.fn());

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync
  };
});
vi.mock("../src/util/command.js", () => ({ runCommand }));

describe("ensureAppiumServer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    existsSync.mockReset();
    runCommand.mockReset();
    delete process.env.ANDROID_HOME;
    delete process.env.ANDROID_SDK_ROOT;
  });

  it("uses a reachable configured Appium server when auto-start is disabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({ ok: true } as Response);
    const { ensureAppiumServer } = await import("../src/appium/processManager.js");

    await expect(ensureAppiumServer({
      appium: {
        host: "127.0.0.1",
        port: 4723,
        basePath: "/",
        autoStart: false,
        command: "appium",
        args: {}
      },
      sessions: {
        defaultTimeoutMs: 10,
        isolated: true,
        maxSessions: 1
      },
      artifacts: {
        outputDir: ".mobium",
        saveScreenshots: true,
        saveSnapshots: true
      },
      capabilities: {
        vision: false,
        android: true,
        ios: true
      }
    })).resolves.toEqual({
      started: false,
      host: "127.0.0.1",
      port: 4723,
      basePath: "/",
      url: "http://127.0.0.1:4723/status"
    });
  });

  it("stops only ports that respond like Appium", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
      if (String(url) === "http://127.0.0.1:4723/status") {
        return {
          ok: true,
          json: async () => ({ value: { ready: true, build: { version: "3.3.1" } } })
        } as Response;
      }
      return {
        ok: false,
        json: async () => ({})
      } as Response;
    });
    runCommand.mockResolvedValue({ ok: true, stdout: "12345\n", stderr: "" });
    const kill = vi.spyOn(process, "kill").mockImplementation(() => true);
    const { stopRunningAppiumServers } = await import("../src/appium/processManager.js");

    const stopped = await stopRunningAppiumServers({
      appium: {
        host: "127.0.0.1",
        port: 4723,
        basePath: "/",
        autoStart: true,
        command: "appium",
        args: {}
      },
      sessions: {
        defaultTimeoutMs: 10,
        isolated: true,
        maxSessions: 1
      },
      artifacts: {
        outputDir: ".mobium",
        saveScreenshots: true,
        saveSnapshots: true
      },
      capabilities: {
        vision: false,
        android: true,
        ios: true
      }
    });

    expect(stopped).toEqual([12345]);
    expect(kill).toHaveBeenCalledWith(12345, "SIGINT");
    expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:4723/status");
  });
});
