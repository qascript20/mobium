import { describe, expect, it } from "vitest";
import { isToolGroupEnabled } from "../src/server/mcpServer.js";
import type { MobiumConfig } from "../src/config.js";

const baseConfig = {
  tools: {
    enabledGroups: ["all"]
  }
} as MobiumConfig;

describe("MCP server tool groups", () => {
  it("enables all groups by default", () => {
    expect(isToolGroupEnabled(baseConfig, "permissions")).toBe(true);
    expect(isToolGroupEnabled(baseConfig, "interactions")).toBe(true);
    expect(isToolGroupEnabled(baseConfig, "vision")).toBe(true);
    expect(isToolGroupEnabled(baseConfig, "navGraph")).toBe(true);
    expect(isToolGroupEnabled(baseConfig, "bdd")).toBe(true);
  });

  it("allows narrow group selection", () => {
    const config = {
      tools: {
        enabledGroups: ["doctor", "devices"]
      }
    } as MobiumConfig;

    expect(isToolGroupEnabled(config, "doctor")).toBe(true);
    expect(isToolGroupEnabled(config, "devices")).toBe(true);
    expect(isToolGroupEnabled(config, "navGraph")).toBe(false);
    expect(isToolGroupEnabled(config, "bdd")).toBe(false);
    expect(isToolGroupEnabled(config, "permissions")).toBe(false);
  });
});
