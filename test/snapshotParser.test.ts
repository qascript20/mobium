import { describe, expect, it } from "vitest";
import { findSnapshotNode, formatSnapshot, parseAppiumSource, toWebdriverSelector } from "../src/snapshot/parseAppiumSource.js";

describe("parseAppiumSource", () => {
  it("normalizes Appium XML into ref nodes", () => {
    const tree = parseAppiumSource(`<?xml version="1.0" encoding="UTF-8"?>
<hierarchy>
  <android.widget.FrameLayout bounds="[0,0][100,200]" displayed="true">
    <android.widget.Button text="Continue" clickable="true" enabled="true" bounds="[10,20][90,60]" />
  </android.widget.FrameLayout>
</hierarchy>`);

    expect(tree[0]).toEqual(expect.objectContaining({
      ref: "m1",
      role: "hierarchy"
    }));
    expect(tree[0]?.children[0]?.children[0]).toEqual(expect.objectContaining({
      ref: "m3",
      role: "android.widget.Button",
      label: "Continue",
      selector: {
        strategy: "androidUiAutomator",
        value: "new UiSelector().text(\"Continue\")"
      },
      clickable: true,
      bounds: {
        x: 10,
        y: 20,
        width: 80,
        height: 40
      }
    }));
  });

  it("formats compact snapshot text", () => {
    const text = formatSnapshot(parseAppiumSource(`<hierarchy><button text="OK" clickable="true" /></hierarchy>`));

    expect(text).toContain("- hierarchy [ref=m1]");
    expect(text).toContain("button \"OK\" [ref=m2] [clickable]");
  });

  it("finds refs and converts selectors for WebdriverIO", () => {
    const tree = parseAppiumSource(`<hierarchy><button content-desc="Save" clickable="true" /></hierarchy>`);
    const node = findSnapshotNode(tree, "m2");

    expect(node?.selector).toEqual({
      strategy: "accessibilityId",
      value: "Save"
    });
    expect(node?.selector ? toWebdriverSelector(node.selector) : undefined).toBe("~Save");
  });
});
