import { afterEach, describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";

describe("loadConfig", () => {
  afterEach(() => {
    delete process.env.MOBIUM_APP_PACKAGE;
    delete process.env.MOBIUM_APP_ACTIVITY;
    delete process.env.MOBIUM_BUNDLE_ID;
    delete process.env.MOBIUM_TOOL_GROUPS;
    delete process.env.MOBIUM_NAV_GRAPH;
    delete process.env.MOBIUM_NAV_GRAPH_OUTPUT_DIR;
    delete process.env.MOBIUM_NAV_GRAPH_AUTO_CAPTURE;
  });

  it("loads app target defaults from environment", () => {
    process.env.MOBIUM_APP_PACKAGE = "com.example.app";
    process.env.MOBIUM_APP_ACTIVITY = ".MainActivity";

    expect(loadConfig("missing.config.json").app).toEqual(expect.objectContaining({
      appPackage: "com.example.app",
      appActivity: ".MainActivity"
    }));
  });

  it("loads enabled tool groups from environment", () => {
    process.env.MOBIUM_TOOL_GROUPS = "doctor, devices, inspect";

    expect(loadConfig("missing.config.json").tools.enabledGroups).toEqual([
      "doctor",
      "devices",
      "inspect"
    ]);
  });

  it("loads nav graph defaults and environment overrides", () => {
    process.env.MOBIUM_NAV_GRAPH = "false";
    process.env.MOBIUM_NAV_GRAPH_OUTPUT_DIR = ".custom-graphs";
    process.env.MOBIUM_NAV_GRAPH_AUTO_CAPTURE = "false";

    expect(loadConfig("missing.config.json").navGraph).toEqual({
      enabled: false,
      outputDir: ".custom-graphs",
      autoCapture: false
    });
  });
});
