import { XMLParser } from "fast-xml-parser";

export type SnapshotBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SnapshotNode = {
  ref: string;
  graphRef?: string;
  role: string;
  label?: string;
  value?: string;
  selector?: SnapshotSelector;
  bounds?: SnapshotBounds;
  enabled?: boolean;
  visible?: boolean;
  clickable?: boolean;
  selected?: boolean;
  checked?: boolean;
  focused?: boolean;
  children: SnapshotNode[];
};

export type SnapshotSelector = {
  strategy: "accessibilityId" | "androidUiAutomator" | "iosPredicate" | "xpath";
  value: string;
};

type OrderedXmlNode = Record<string, unknown>;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  preserveOrder: true,
  parseAttributeValue: false,
  trimValues: true
});

export function parseAppiumSource(source: string): SnapshotNode[] {
  const parsed = parser.parse(source) as OrderedXmlNode[];
  const refs = { next: 1 };
  return parsed.flatMap((entry) => normalizeEntry(entry, refs));
}

export function formatSnapshot(nodes: SnapshotNode[]): string {
  if (nodes.length === 0) {
    return "(empty snapshot)";
  }

  return nodes.map((node) => formatNode(node, 0)).join("\n");
}

function normalizeEntry(entry: OrderedXmlNode, refs: { next: number }): SnapshotNode[] {
  const tagName = Object.keys(entry).find((key) => key !== ":@" && !key.startsWith("?"));
  if (!tagName) {
    return [];
  }

  const attrs = isRecord(entry[":@"]) ? entry[":@"] : {};
  const label = firstNonEmpty(attrs.text, attrs["content-desc"], attrs.label, attrs.name, attrs.value);
  const role = firstNonEmpty(attrs.class, attrs.type, tagName) ?? tagName;
  const ref = `m${refs.next++}`;
  const children = Array.isArray(entry[tagName])
    ? (entry[tagName] as OrderedXmlNode[]).flatMap((child) => normalizeEntry(child, refs))
    : [];

  return [{
    ref,
    role,
    label,
    value: stringAttr(attrs.value),
    selector: buildSelector(tagName, attrs),
    bounds: parseBounds(stringAttr(attrs.bounds)),
    enabled: boolAttr(attrs.enabled),
    visible: boolAttr(attrs.displayed ?? attrs.visible),
    clickable: boolAttr(attrs.clickable),
    selected: boolAttr(attrs.selected),
    checked: boolAttr(attrs.checked),
    focused: boolAttr(attrs.focused),
    children
  }];
}

export function findSnapshotNode(nodes: SnapshotNode[], ref: string): SnapshotNode | undefined {
  for (const node of nodes) {
    if (node.ref === ref) {
      return node;
    }
    const child = findSnapshotNode(node.children, ref);
    if (child) {
      return child;
    }
  }
  return undefined;
}

export function toWebdriverSelector(selector: SnapshotSelector): string {
  switch (selector.strategy) {
    case "accessibilityId":
      return `~${selector.value}`;
    case "androidUiAutomator":
      return `android=${selector.value}`;
    case "iosPredicate":
      return `-ios predicate string:${selector.value}`;
    case "xpath":
      return selector.value;
  }
}

function formatNode(node: SnapshotNode, depth: number): string {
  const indent = "  ".repeat(depth);
  const parts = [`${indent}- ${node.role}`];
  if (node.label) {
    parts.push(`"${node.label}"`);
  }
  parts.push(`[ref=${node.ref}]`);
  if (node.graphRef) {
    parts.push(`[graph=${node.graphRef}]`);
  }
  if (node.clickable) {
    parts.push("[clickable]");
  }
  if (node.enabled === false) {
    parts.push("[disabled]");
  }

  const line = parts.join(" ");
  const children = node.children.map((child) => formatNode(child, depth + 1));
  return [line, ...children].join("\n");
}

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const value of values) {
    const stringValue = stringAttr(value);
    if (stringValue) {
      return stringValue;
    }
  }
  return undefined;
}

function buildSelector(tagName: string, attrs: Record<string, unknown>): SnapshotSelector | undefined {
  const accessibilityId = firstNonEmpty(attrs["content-desc"], attrs.name, attrs.label);
  if (accessibilityId) {
    return { strategy: "accessibilityId", value: accessibilityId };
  }

  const text = stringAttr(attrs.text);
  if (text) {
    return { strategy: "androidUiAutomator", value: `new UiSelector().text(${quoteJavaString(text)})` };
  }

  const value = stringAttr(attrs.value);
  if (value) {
    return { strategy: "iosPredicate", value: `value == ${quotePredicateString(value)}` };
  }

  const role = firstNonEmpty(attrs.class, attrs.type, tagName);
  if (role) {
    return { strategy: "xpath", value: `//*[@class=${quoteXPathString(role)} or @type=${quoteXPathString(role)}]` };
  }

  return undefined;
}

function stringAttr(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function boolAttr(value: unknown): boolean | undefined {
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return undefined;
}

function quoteJavaString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function quotePredicateString(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function quoteXPathString(value: string): string {
  if (!value.includes("'")) {
    return `'${value}'`;
  }
  if (!value.includes('"')) {
    return `"${value}"`;
  }
  return `concat('${value.replace(/'/g, `', "'", '`)}')`;
}

function parseBounds(value: string | undefined): SnapshotBounds | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^\[(\d+),(\d+)]\[(\d+),(\d+)]$/);
  if (!match) {
    return undefined;
  }

  const [, left, top, right, bottom] = match.map(Number);
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
