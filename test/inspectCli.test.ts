import { describe, expect, it } from "vitest";
import { parseInspectArgs } from "../src/cli/inspect.js";

describe("parseInspectArgs", () => {
  it("defaults to snapshot", () => {
    expect(parseInspectArgs([])).toEqual(expect.objectContaining({
      action: "snapshot",
      sessionName: "default"
    }));
  });

  it("parses screenshot action and platform", () => {
    expect(parseInspectArgs(["--action", "screenshot", "--platform", "android"])).toEqual(expect.objectContaining({
      action: "screenshot",
      platform: "android"
    }));
  });

  it("parses diff action", () => {
    expect(parseInspectArgs(["--action", "diff"])).toEqual(expect.objectContaining({
      action: "diff"
    }));
  });

  it("parses context switching options", () => {
    expect(parseInspectArgs([
      "--action",
      "setContext",
      "--context",
      "WEBVIEW_com.example",
      "--wait-for-webview-ms",
      "750"
    ])).toEqual(expect.objectContaining({
      action: "setContext",
      context: "WEBVIEW_com.example",
      waitForWebviewMs: 750
    }));
  });

  it("rejects unknown actions", () => {
    expect(() => parseInspectArgs(["--action", "dance"])).toThrow("inspect --action");
  });
});
