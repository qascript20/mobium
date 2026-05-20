import { describe, expect, it } from "vitest";
import { diffSnapshots, formatSnapshotDiff } from "../src/snapshot/diff.js";
import { parseAppiumSource } from "../src/snapshot/parseAppiumSource.js";

describe("snapshot diff", () => {
  it("reports added and removed nodes", () => {
    const before = parseAppiumSource(`<hierarchy><button text="Continue" /></hierarchy>`);
    const after = parseAppiumSource(`<hierarchy><button text="Done" /></hierarchy>`);

    expect(diffSnapshots(before, after)).toEqual({
      added: [expect.objectContaining({ label: "Done" })],
      removed: [expect.objectContaining({ label: "Continue" })],
      changed: []
    });
  });

  it("reports changed node state for stable selectors", () => {
    const before = parseAppiumSource(`<hierarchy><button content-desc="Save" enabled="false" /></hierarchy>`);
    const after = parseAppiumSource(`<hierarchy><button content-desc="Save" enabled="true" /></hierarchy>`);
    const diff = diffSnapshots(before, after);

    expect(diff.changed).toEqual([expect.objectContaining({
      label: "Save",
      changes: ["enabled: false -> true"]
    })]);
    expect(formatSnapshotDiff(diff)).toContain("~ button \"Save\"");
  });

  it("formats empty diffs compactly", () => {
    expect(formatSnapshotDiff({ added: [], removed: [], changed: [] })).toBe("(no snapshot changes)");
  });
});
