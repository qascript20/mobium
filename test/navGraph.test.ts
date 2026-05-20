import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MobiumConfig } from "../src/config.js";
import {
  captureNavGraph,
  createNavGraphState,
  exportNavGraph,
  fingerprintNodes,
  fingerprintScreen,
  resetNavGraph,
  resolveGraphRef,
  statusNavGraph
} from "../src/navGraph/navGraph.js";
import { parseAppiumSource } from "../src/snapshot/parseAppiumSource.js";
import type { SessionSummary } from "../src/webdriver/sessionRegistry.js";

const outputDirs: string[] = [];

afterEach(async () => {
  await Promise.all(outputDirs.map((dir) => rm(join(process.cwd(), dir), { recursive: true, force: true })));
  outputDirs.length = 0;
});

describe("Nav Graph", () => {
  it("keeps screen and element fingerprints stable across fresh snapshots", () => {
    const first = parseAppiumSource(`<hierarchy><button content-desc="Save" bounds="[8,16][80,48]" clickable="true" /></hierarchy>`);
    const second = parseAppiumSource(`<hierarchy><button content-desc="Save" bounds="[8,16][80,48]" clickable="true" /></hierarchy>`);

    const firstEntries = fingerprintNodes(first);
    const secondEntries = fingerprintNodes(second);

    expect(fingerprintScreen(firstEntries)).toBe(fingerprintScreen(secondEntries));
    expect(firstEntries.map((entry) => entry.fingerprint)).toEqual(secondEntries.map((entry) => entry.fingerprint));
  });

  it("changes element fingerprints when meaningful identity changes", () => {
    const first = fingerprintNodes(parseAppiumSource(`<hierarchy><button content-desc="Save" /></hierarchy>`));
    const second = fingerprintNodes(parseAppiumSource(`<hierarchy><button content-desc="Delete" /></hierarchy>`));

    expect(first.map((entry) => entry.fingerprint)).not.toEqual(second.map((entry) => entry.fingerprint));
  });

  it("persists observed screens and writes Mermaid transitions", async () => {
    const config = testConfig();
    const state = createNavGraphState(testSession());
    const firstScreen = parseAppiumSource(`<hierarchy><button content-desc="Login" clickable="true" /></hierarchy>`);
    const secondScreen = parseAppiumSource(`<hierarchy><text text="Home" /><button content-desc="Logout" clickable="true" /></hierarchy>`);

    const firstCapture = await captureNavGraph(config, state, firstScreen);
    const repeatCapture = await captureNavGraph(config, state, parseAppiumSource(`<hierarchy><button content-desc="Login" clickable="true" /></hierarchy>`));
    const secondCapture = await captureNavGraph(config, state, secondScreen, {
      fromScreenId: firstCapture?.screenId,
      action: "tap",
      target: "Login"
    });

    expect(firstCapture?.screenId).toBe(repeatCapture?.screenId);
    expect(secondCapture?.knownScreens).toBe(2);
    expect(firstScreen[0]?.graphRef).toBe("g1");

    const status = await statusNavGraph(config, state);
    expect(status.knownScreens).toBe(2);
    expect(status.knownElements).toBeGreaterThan(0);

    await exportNavGraph(config, state);
    const mermaid = await readFile(status.mermaidPath, "utf8");
    expect(mermaid).toContain("flowchart TD");
    expect(mermaid).toContain("-->|\"tap Login\"|");
    expect(mermaid).toContain("elements");

    const reset = await resetNavGraph(config, state);
    expect(reset.reset).toBe(true);
    expect(reset.knownScreens).toBe(0);
  });

  it("resolves graph refs only when the learned element is present on the current screen", async () => {
    const config = testConfig();
    const state = createNavGraphState(testSession());
    const learned = parseAppiumSource(`<hierarchy><button content-desc="Continue" clickable="true" /></hierarchy>`);
    const capture = await captureNavGraph(config, state, learned);
    const graphRef = capture?.refMap.m2;

    expect(graphRef).toBeDefined();
    await expect(resolveGraphRef(
      config,
      state,
      `<hierarchy><button content-desc="Continue" clickable="true" /></hierarchy>`,
      graphRef ?? ""
    )).resolves.toEqual(expect.objectContaining({
      selector: "~Continue"
    }));
    await expect(resolveGraphRef(
      config,
      state,
      `<hierarchy><button content-desc="Cancel" clickable="true" /></hierarchy>`,
      graphRef ?? ""
    )).resolves.toBeUndefined();
  });
});

function testConfig(): MobiumConfig {
  const outputDir = `.mobium-nav-graph-test-${Date.now()}-${outputDirs.length}`;
  outputDirs.push(outputDir);
  return {
    appium: {
      host: "127.0.0.1",
      port: 4723,
      basePath: "/",
      autoStart: false,
      command: "appium",
      args: {}
    },
    sessions: {
      defaultTimeoutMs: 10000,
      isolated: true,
      maxSessions: 1
    },
    app: {},
    artifacts: {
      outputDir: ".mobium",
      saveScreenshots: false,
      saveSnapshots: false
    },
    navGraph: {
      enabled: true,
      outputDir,
      autoCapture: true
    },
    capabilities: {
      vision: false,
      android: true,
      ios: true
    },
    tools: {
      enabledGroups: ["all"]
    }
  };
}

function testSession(): SessionSummary {
  return {
    name: "default",
    platform: "android",
    deviceId: "emulator-5554",
    createdAt: "2026-05-07T00:00:00.000Z",
    capabilities: {
      "appium:appPackage": "com.example"
    }
  };
}
