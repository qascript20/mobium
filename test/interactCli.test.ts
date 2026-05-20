import { describe, expect, it } from "vitest";
import { parseInteractArgs } from "../src/cli/interact.js";

describe("parseInteractArgs", () => {
  it("parses tap by ref", () => {
    expect(parseInteractArgs(["--action", "tap", "--ref", "m3", "--platform", "android"])).toEqual(expect.objectContaining({
      action: "tap",
      ref: "m3",
      platform: "android",
      sessionName: "default"
    }));
  });

  it("parses type text and timeout", () => {
    expect(parseInteractArgs(["--action", "type", "--ref", "m4", "--text", "hello", "--timeout", "2500"])).toEqual(expect.objectContaining({
      action: "type",
      ref: "m4",
      text: "hello",
      timeoutMs: 2500
    }));
  });

  it("parses drag and wait selector options", () => {
    expect(parseInteractArgs([
      "--action",
      "drag",
      "--from-ref",
      "m3",
      "--to-x",
      "200",
      "--to-y",
      "600",
      "--duration",
      "300"
    ])).toEqual(expect.objectContaining({
      action: "drag",
      fromRef: "m3",
      toX: 200,
      toY: 600,
      durationMs: 300
    }));

    expect(parseInteractArgs([
      "--action",
      "wait",
      "--accessibility-id",
      "Continue"
    ])).toEqual(expect.objectContaining({
      action: "wait",
      accessibilityId: "Continue"
    }));
  });

  it("rejects unknown actions", () => {
    expect(() => parseInteractArgs(["--action", "dance"])).toThrow("interact requires --action");
  });
});
