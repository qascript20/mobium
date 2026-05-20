import { describe, expect, it, vi } from "vitest";
import { buildAnnotatedSvg, createVisionState, findVisualCandidates, performVisionAction } from "../src/webdriver/vision.js";
import { parseAppiumSource } from "../src/snapshot/parseAppiumSource.js";
import type { MobiumConfig } from "../src/config.js";

const enabledConfig = {
  capabilities: { vision: true },
  artifacts: {
    outputDir: ".mobium-test",
    saveScreenshots: true,
    saveSnapshots: true
  }
} as MobiumConfig;

const disabledConfig = {
  capabilities: { vision: false }
} as MobiumConfig;

describe("vision tools", () => {
  it("finds visual candidates from snapshot labels and bounds", () => {
    const tree = parseAppiumSource(`<hierarchy><button text="Continue" bounds="[10,20][110,60]" /></hierarchy>`);

    expect(findVisualCandidates(tree, "continue")).toEqual([
      expect.objectContaining({
        ref: "v1",
        sourceRef: "m2",
        label: "Continue",
        bounds: { x: 10, y: 20, width: 100, height: 40 }
      })
    ]);
  });

  it("builds an SVG annotation overlay", () => {
    const svg = buildAnnotatedSvg([
      {
        ref: "v1",
        sourceRef: "m2",
        label: "Continue",
        role: "button",
        bounds: { x: 10, y: 20, width: 100, height: 40 },
        score: 1
      }
    ], "/tmp/screen.png");

    expect(svg).toContain("<svg");
    expect(svg).toContain("href=\"/tmp/screen.png\"");
    expect(svg).toContain("v1 Continue");
  });

  it("rejects actions when vision is disabled", async () => {
    await expect(performVisionAction(disabledConfig, {
      getPageSource: vi.fn(),
      saveScreenshot: vi.fn()
    }, {
      action: "find",
      sessionName: "default",
      query: "Continue"
    }, createVisionState())).rejects.toThrow("Vision tools are disabled");
  });

  it("taps remembered visual candidates", async () => {
    const state = createVisionState();
    await performVisionAction(enabledConfig, {
      getPageSource: vi.fn(async () => `<hierarchy><button text="Continue" bounds="[10,20][110,60]" /></hierarchy>`),
      saveScreenshot: vi.fn()
    }, {
      action: "find",
      sessionName: "default",
      query: "Continue"
    }, state);

    const perform = vi.fn(async () => undefined);
    const action = {
      move: vi.fn(() => action),
      down: vi.fn(() => action),
      pause: vi.fn(() => action),
      up: vi.fn(() => action),
      perform
    };

    await performVisionAction(enabledConfig, {
      getPageSource: vi.fn(),
      saveScreenshot: vi.fn(),
      action: vi.fn(() => action)
    }, {
      action: "tap",
      sessionName: "default",
      candidateRef: "v1"
    }, state);

    expect(action.move).toHaveBeenCalledWith({ x: 60, y: 40 });
    expect(perform).toHaveBeenCalledOnce();
  });
});
