import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { buildExampleConfig, parseConfigArgs, runConfigCommand } from "../src/cli/config.js";

let tempDir: string | undefined;

describe("config CLI", () => {
  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it("defaults to printing resolved config", () => {
    expect(parseConfigArgs([])).toEqual({
      action: "print",
      path: "mobium.config.json",
      force: false
    });
  });

  it("parses init options", () => {
    expect(parseConfigArgs(["--action", "init", "--path", "custom.json", "--force"])).toEqual({
      action: "init",
      path: "custom.json",
      force: true
    });
  });

  it("builds a complete example config", () => {
    expect(buildExampleConfig()).toEqual(expect.objectContaining({
      appium: expect.objectContaining({ port: 4723 }),
      sessions: expect.objectContaining({ maxSessions: 1 }),
      artifacts: expect.objectContaining({ outputDir: "testing" }),
      navGraph: expect.objectContaining({ enabled: true, outputDir: "testing/graphs", autoCapture: true }),
      capabilities: expect.objectContaining({ android: true, ios: true }),
      tools: expect.objectContaining({ enabledGroups: ["all"] })
    }));
  });

  it("initializes a config file without overwriting by default", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "mobium-config-"));
    const path = join(tempDir, "mobium.config.json");

    await expect(runConfigCommand({ action: "init", path, force: false })).resolves.toEqual({
      action: "init",
      path,
      created: true,
      overwritten: false
    });
    await expect(runConfigCommand({ action: "init", path, force: false })).rejects.toThrow("already exists");

    const config = JSON.parse(await readFile(path, "utf8")) as unknown;
    expect(config).toEqual(expect.objectContaining({
      appium: expect.objectContaining({ command: "appium" })
    }));
  });
});
