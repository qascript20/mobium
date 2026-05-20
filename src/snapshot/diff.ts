import type { SnapshotBounds, SnapshotNode } from "./parseAppiumSource.js";

export type SnapshotDiffEntry = {
  ref: string;
  role: string;
  label?: string;
  changes?: string[];
};

export type SnapshotDiff = {
  added: SnapshotDiffEntry[];
  removed: SnapshotDiffEntry[];
  changed: SnapshotDiffEntry[];
};

type FlatNode = SnapshotDiffEntry & {
  key: string;
  value?: string;
  bounds?: SnapshotBounds;
  enabled?: boolean;
  visible?: boolean;
  clickable?: boolean;
  selected?: boolean;
  checked?: boolean;
  focused?: boolean;
};

export function diffSnapshots(previous: SnapshotNode[], current: SnapshotNode[]): SnapshotDiff {
  const before = new Map(flattenSnapshot(previous).map((node) => [node.key, node]));
  const after = new Map(flattenSnapshot(current).map((node) => [node.key, node]));

  const added: SnapshotDiffEntry[] = [];
  const removed: SnapshotDiffEntry[] = [];
  const changed: SnapshotDiffEntry[] = [];

  for (const [key, node] of after) {
    const oldNode = before.get(key);
    if (!oldNode) {
      added.push(toEntry(node));
      continue;
    }

    const changes = describeChanges(oldNode, node);
    if (changes.length > 0) {
      changed.push({ ...toEntry(node), changes });
    }
  }

  for (const [key, node] of before) {
    if (!after.has(key)) {
      removed.push(toEntry(node));
    }
  }

  return { added, removed, changed };
}

export function formatSnapshotDiff(diff: SnapshotDiff): string {
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.changed.length === 0) {
    return "(no snapshot changes)";
  }

  return [
    ...diff.added.map((entry) => `+ ${formatEntry(entry)}`),
    ...diff.removed.map((entry) => `- ${formatEntry(entry)}`),
    ...diff.changed.map((entry) => `~ ${formatEntry(entry)} ${entry.changes?.join(", ") ?? ""}`.trim())
  ].join("\n");
}

function flattenSnapshot(nodes: SnapshotNode[]): FlatNode[] {
  return nodes.flatMap((node) => [
    {
      key: identityKey(node),
      ref: node.ref,
      role: node.role,
      label: node.label,
      value: node.value,
      bounds: node.bounds,
      enabled: node.enabled,
      visible: node.visible,
      clickable: node.clickable,
      selected: node.selected,
      checked: node.checked,
      focused: node.focused
    },
    ...flattenSnapshot(node.children)
  ]);
}

function identityKey(node: SnapshotNode): string {
  if (node.selector) {
    return `${node.selector.strategy}:${node.selector.value}`;
  }

  return [
    node.role,
    node.label ?? "",
    node.bounds ? `${node.bounds.x},${node.bounds.y},${node.bounds.width},${node.bounds.height}` : ""
  ].join("|");
}

function describeChanges(before: FlatNode, after: FlatNode): string[] {
  return [
    describeChange("label", before.label, after.label),
    describeChange("value", before.value, after.value),
    describeChange("bounds", formatBounds(before.bounds), formatBounds(after.bounds)),
    describeChange("enabled", before.enabled, after.enabled),
    describeChange("visible", before.visible, after.visible),
    describeChange("clickable", before.clickable, after.clickable),
    describeChange("selected", before.selected, after.selected),
    describeChange("checked", before.checked, after.checked),
    describeChange("focused", before.focused, after.focused)
  ].filter((change): change is string => Boolean(change));
}

function describeChange(field: string, before: unknown, after: unknown): string | undefined {
  return before === after ? undefined : `${field}: ${formatValue(before)} -> ${formatValue(after)}`;
}

function formatEntry(entry: SnapshotDiffEntry): string {
  return `${entry.role}${entry.label ? ` "${entry.label}"` : ""} [ref=${entry.ref}]`;
}

function toEntry(node: FlatNode): SnapshotDiffEntry {
  return {
    ref: node.ref,
    role: node.role,
    label: node.label
  };
}

function formatBounds(bounds: SnapshotBounds | undefined): string | undefined {
  return bounds ? `${bounds.x},${bounds.y},${bounds.width},${bounds.height}` : undefined;
}

function formatValue(value: unknown): string {
  return value === undefined ? "unset" : JSON.stringify(value);
}
