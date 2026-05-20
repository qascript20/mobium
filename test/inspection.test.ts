import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { performInspection } from "../src/webdriver/inspection.js";
import type { MobiumConfig } from "../src/config.js";

const config = {
  artifacts: {
    saveSnapshots: false,
    saveScreenshots: false
  }
} as MobiumConfig;

const outputDirs: string[] = [];

afterEach(async () => {
  await Promise.all(outputDirs.map((dir) => rm(join(process.cwd(), dir), { recursive: true, force: true })));
  outputDirs.length = 0;
});

describe("performInspection", () => {
  it("captures a snapshot baseline and diffs the next source", async () => {
    const state = {};
    const driver = {
      getPageSource: vi.fn()
        .mockResolvedValueOnce(`<hierarchy><button content-desc="Save" enabled="false" /></hierarchy>`)
        .mockResolvedValueOnce(`<hierarchy><button content-desc="Save" enabled="true" /></hierarchy>`),
      saveScreenshot: vi.fn()
    };

    await performInspection(config, driver, {
      action: "snapshot",
      sessionName: "default"
    }, state);

    await expect(performInspection(config, driver, {
      action: "diff",
      sessionName: "default",
      raw: true
    }, state)).resolves.toEqual(expect.objectContaining({
      action: "diff",
      text: expect.stringContaining("enabled: false -> true"),
      diff: expect.objectContaining({
        changed: [expect.objectContaining({ label: "Save" })]
      })
    }));
  });

  it("captures a baseline when diff has no previous snapshot", async () => {
    const driver = {
      getPageSource: vi.fn(async () => `<hierarchy><button text="OK" /></hierarchy>`),
      saveScreenshot: vi.fn()
    };

    await expect(performInspection(config, driver, {
      action: "diff",
      sessionName: "default"
    })).resolves.toEqual({
      action: "diff",
      text: "(no previous snapshot; baseline captured)"
    });
  });

  it("lists contexts with webview wait options", async () => {
    const driver = {
      getPageSource: vi.fn(),
      saveScreenshot: vi.fn(),
      getContexts: vi.fn(async () => ["NATIVE_APP", "WEBVIEW_com.example"]),
      getContext: vi.fn(async () => "NATIVE_APP")
    };

    await expect(performInspection(config, driver, {
      action: "contexts",
      sessionName: "default",
      waitForWebviewMs: 500
    })).resolves.toEqual({
      action: "contexts",
      contexts: ["NATIVE_APP", "WEBVIEW_com.example"],
      currentContext: "NATIVE_APP"
    });

    expect(driver.getContexts).toHaveBeenCalledWith({ waitForWebviewMs: 500 });
    expect(driver.getContext).toHaveBeenCalledWith({ waitForWebviewMs: 500 });
  });

  it("switches context and reports the current context", async () => {
    const driver = {
      getPageSource: vi.fn(),
      saveScreenshot: vi.fn(),
      switchContext: vi.fn(async () => undefined),
      getContext: vi.fn(async () => "WEBVIEW_com.example")
    };

    await expect(performInspection(config, driver, {
      action: "setContext",
      sessionName: "default",
      context: "WEBVIEW_com.example"
    })).resolves.toEqual({
      action: "setContext",
      context: "WEBVIEW_com.example",
      currentContext: "WEBVIEW_com.example"
    });

    expect(driver.switchContext).toHaveBeenCalledWith("WEBVIEW_com.example");
  });

  it("requires a context when switching", async () => {
    const driver = {
      getPageSource: vi.fn(),
      saveScreenshot: vi.fn(),
      switchContext: vi.fn()
    };

    await expect(performInspection(config, driver, {
      action: "setContext",
      sessionName: "default"
    })).rejects.toThrow("setContext requires context");
  });

  it("stores screenshots under the app key folder", async () => {
    const outputDir = `.mobium-inspection-test-${Date.now()}`;
    outputDirs.push(outputDir);
    const driver = {
      getPageSource: vi.fn(),
      saveScreenshot: vi.fn(async (path: string) => {
        await writeFile(path, "png");
      })
    };

    const result = await performInspection({
      artifacts: {
        outputDir,
        saveScreenshots: true,
        saveSnapshots: true
      }
    } as MobiumConfig, driver, {
      action: "screenshot",
      sessionName: "Checkout Session",
      artifactAppKey: "android-com.example.checkout"
    });

    expect(result).toEqual(expect.objectContaining({
      artifact: expect.objectContaining({
        path: expect.stringContaining(`${outputDir}/android-com.example.checkout/sessions/checkout-session/`),
        reportPath: expect.stringContaining(`${outputDir}/android-com.example.checkout/sessions/checkout-session/index.html`)
      })
    }));
    const report = await readFile((result.artifact as { reportPath: string }).reportPath, "utf8");
    expect(report).toContain("Mobium Report");
    expect(report).toContain("screenshot.png");
  });
});
