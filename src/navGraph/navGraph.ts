import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { MobiumConfig } from "../config.js";
import type { SnapshotBounds, SnapshotNode, SnapshotSelector } from "../snapshot/parseAppiumSource.js";
import { parseAppiumSource, toWebdriverSelector } from "../snapshot/parseAppiumSource.js";
import type { SessionSummary } from "../webdriver/sessionRegistry.js";

export type NavGraph = {
  version: 1;
  appKey: string;
  nextElementIndex: number;
  screens: Record<string, NavGraphScreen>;
  transitions: NavGraphTransition[];
  updatedAt: string;
};

export type NavGraphScreen = {
  id: string;
  fingerprint: string;
  title?: string;
  observations: number;
  firstSeenAt: string;
  lastSeenAt: string;
  elements: Record<string, NavGraphElement>;
};

export type NavGraphElement = {
  graphRef: string;
  fingerprint: string;
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
  observations: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type NavGraphTransition = {
  id: string;
  from: string;
  to: string;
  action: string;
  target?: string;
  observations: number;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type NavGraphCaptureResult = {
  appKey: string;
  screenId: string;
  graphPath: string;
  mermaidPath: string;
  knownScreens: number;
  knownElements: number;
  refMap: Record<string, string>;
};

export type NavGraphStatus = {
  enabled: boolean;
  appKey: string;
  currentScreenId?: string;
  knownScreens: number;
  knownElements: number;
  graphPath: string;
  mermaidPath: string;
};

export type NavGraphState = {
  appKey: string;
  currentScreenId?: string;
  refMap: Map<string, string>;
};

export type NavGraphTransitionInput = {
  fromScreenId?: string;
  action: string;
  target?: string;
};

type FingerprintedNode = {
  node: SnapshotNode;
  fingerprint: string;
};

export function createNavGraphState(session: SessionSummary): NavGraphState {
  return {
    appKey: buildAppKey(session),
    refMap: new Map()
  };
}

export async function captureNavGraph(
  config: MobiumConfig,
  state: NavGraphState,
  tree: SnapshotNode[],
  transition?: NavGraphTransitionInput
): Promise<NavGraphCaptureResult | undefined> {
  if (!config.navGraph.enabled || !config.navGraph.autoCapture) {
    return undefined;
  }

  const now = new Date().toISOString();
  const graph = await loadNavGraph(config, state.appKey);
  const flattened = fingerprintNodes(tree);
  const screenFingerprint = fingerprintScreen(flattened);
  const screenId = `s_${screenFingerprint.slice(0, 10)}`;
  const existing = graph.screens[screenId];
  const screen: NavGraphScreen = existing ?? {
    id: screenId,
    fingerprint: screenFingerprint,
    title: inferScreenTitle(tree),
    observations: 0,
    firstSeenAt: now,
    lastSeenAt: now,
    elements: {}
  };

  screen.observations += 1;
  screen.lastSeenAt = now;
  screen.title = screen.title ?? inferScreenTitle(tree);

  const refMap: Record<string, string> = {};
  for (const entry of flattened) {
    const existingElement = screen.elements[entry.fingerprint];
    const element: NavGraphElement = existingElement ?? {
      graphRef: `g${graph.nextElementIndex++}`,
      fingerprint: entry.fingerprint,
      role: entry.node.role,
      label: entry.node.label,
      value: entry.node.value,
      selector: entry.node.selector,
      bounds: entry.node.bounds,
      enabled: entry.node.enabled,
      visible: entry.node.visible,
      clickable: entry.node.clickable,
      selected: entry.node.selected,
      checked: entry.node.checked,
      focused: entry.node.focused,
      observations: 0,
      firstSeenAt: now,
      lastSeenAt: now
    };
    element.observations += 1;
    element.lastSeenAt = now;
    element.selector = preferSelector(element.selector, entry.node.selector);
    element.bounds = entry.node.bounds ?? element.bounds;
    screen.elements[entry.fingerprint] = element;
    entry.node.graphRef = element.graphRef;
    refMap[entry.node.ref] = element.graphRef;
  }

  graph.screens[screenId] = screen;
  graph.updatedAt = now;
  if (transition?.fromScreenId && transition.fromScreenId !== screenId) {
    upsertTransition(graph, transition.fromScreenId, screenId, transition.action, transition.target, now);
  }

  state.currentScreenId = screenId;
  state.refMap = new Map(Object.entries(refMap));
  await saveNavGraph(config, graph);

  return {
    appKey: state.appKey,
    screenId,
    graphPath: graphJsonPath(config, state.appKey),
    mermaidPath: graphMermaidPath(config, state.appKey),
    knownScreens: Object.keys(graph.screens).length,
    knownElements: countElements(graph),
    refMap
  };
}

export async function statusNavGraph(config: MobiumConfig, state: NavGraphState): Promise<NavGraphStatus> {
  const graph = await loadNavGraph(config, state.appKey);
  return {
    enabled: config.navGraph.enabled,
    appKey: state.appKey,
    currentScreenId: state.currentScreenId,
    knownScreens: Object.keys(graph.screens).length,
    knownElements: countElements(graph),
    graphPath: graphJsonPath(config, state.appKey),
    mermaidPath: graphMermaidPath(config, state.appKey)
  };
}

export async function exportNavGraph(config: MobiumConfig, state: NavGraphState): Promise<NavGraphStatus> {
  const graph = await loadNavGraph(config, state.appKey);
  await saveNavGraph(config, graph);
  return statusNavGraph(config, state);
}

export async function resetNavGraph(config: MobiumConfig, state: NavGraphState): Promise<NavGraphStatus & { reset: true }> {
  await rm(graphDirectory(config, state.appKey), { recursive: true, force: true });
  state.currentScreenId = undefined;
  state.refMap.clear();
  return {
    ...(await statusNavGraph(config, state)),
    reset: true
  };
}

export async function resolveGraphRef(
  config: MobiumConfig,
  state: NavGraphState,
  source: string,
  graphRef: string
): Promise<{ node: SnapshotNode; selector: string } | undefined> {
  if (!config.navGraph.enabled) {
    return undefined;
  }

  const graph = await loadNavGraph(config, state.appKey);
  const known = findElementByGraphRef(graph, graphRef);
  if (!known?.selector) {
    return undefined;
  }

  const tree = parseAppiumSource(source);
  const current = fingerprintNodes(tree).find((entry) => entry.fingerprint === known.fingerprint);
  if (current?.node.selector) {
    return { node: current.node, selector: toWebdriverSelector(current.node.selector) };
  }
  if (current && known.selector) {
    return { node: current.node, selector: toWebdriverSelector(known.selector) };
  }

  return undefined;
}

export function graphRefForSnapshotRef(state: NavGraphState, ref: string): string | undefined {
  return state.refMap.get(ref);
}

export function buildAppKey(session: SessionSummary): string {
  const capabilities = session.capabilities;
  const appTarget = firstString(
    capabilities["appium:appPackage"],
    capabilities["appium:bundleId"],
    capabilities["appium:app"],
    capabilities.browserName,
    session.deviceId
  );
  return sanitizeKey(`${session.platform}-${appTarget ?? session.deviceId}`);
}

export function fingerprintNodes(nodes: SnapshotNode[]): FingerprintedNode[] {
  const entries: FingerprintedNode[] = [];
  visit(nodes, [], entries);
  return entries.filter((entry) => entry.node.visible !== false);
}

export function fingerprintScreen(entries: FingerprintedNode[]): string {
  const elementFingerprints = entries
    .map((entry) => entry.fingerprint)
    .sort()
    .join("|");
  return hash(`screen:${elementFingerprints}`);
}

function visit(nodes: SnapshotNode[], path: number[], entries: FingerprintedNode[]): void {
  nodes.forEach((node, index) => {
    const currentPath = [...path, index];
    entries.push({
      node,
      fingerprint: fingerprintElement(node, currentPath)
    });
    visit(node.children, currentPath, entries);
  });
}

function fingerprintElement(node: SnapshotNode, path: number[]): string {
  return hash(JSON.stringify({
    role: normalize(node.role),
    label: normalize(node.label),
    value: normalize(node.value),
    selector: node.selector,
    enabled: node.enabled,
    visible: node.visible,
    clickable: node.clickable,
    selected: node.selected,
    checked: node.checked,
    focused: node.focused,
    bounds: bucketBounds(node.bounds),
    path: path.join(".")
  }));
}

async function loadNavGraph(config: MobiumConfig, appKey: string): Promise<NavGraph> {
  const path = graphJsonPath(config, appKey);
  if (!existsSync(path)) {
    return {
      version: 1,
      appKey,
      nextElementIndex: 1,
      screens: {},
      transitions: [],
      updatedAt: new Date().toISOString()
    };
  }

  return JSON.parse(await readFile(path, "utf8")) as NavGraph;
}

async function saveNavGraph(config: MobiumConfig, graph: NavGraph): Promise<void> {
  await mkdir(graphDirectory(config, graph.appKey), { recursive: true });
  await writeFile(graphJsonPath(config, graph.appKey), `${JSON.stringify(graph, null, 2)}\n`);
  await writeFile(graphMermaidPath(config, graph.appKey), renderMermaid(graph));
}

function upsertTransition(graph: NavGraph, from: string, to: string, action: string, target: string | undefined, now: string): void {
  const id = hash(`${from}:${to}:${action}:${target ?? ""}`).slice(0, 12);
  const existing = graph.transitions.find((transition) => transition.id === id);
  if (existing) {
    existing.observations += 1;
    existing.lastSeenAt = now;
    return;
  }

  graph.transitions.push({
    id,
    from,
    to,
    action,
    target,
    observations: 1,
    firstSeenAt: now,
    lastSeenAt: now
  });
}

function renderMermaid(graph: NavGraph): string {
  const lines = ["flowchart TD"];
  const screens = Object.values(graph.screens);
  if (screens.length === 0) {
    lines.push("  empty[\"No screens observed yet\"]");
    return `${lines.join("\n")}\n`;
  }

  for (const screen of screens) {
    lines.push(`  ${screen.id}["${escapeMermaid(screen.title ?? screen.id)}<br/>${Object.keys(screen.elements).length} elements"]`);
  }
  for (const transition of graph.transitions) {
    lines.push(`  ${transition.from} -->|"${escapeMermaid(formatTransitionLabel(transition))}"| ${transition.to}`);
  }
  return `${lines.join("\n")}\n`;
}

function formatTransitionLabel(transition: NavGraphTransition): string {
  return transition.target ? `${transition.action} ${transition.target}` : transition.action;
}

function inferScreenTitle(nodes: SnapshotNode[]): string | undefined {
  const firstLabel = flatten(nodes).find((node) => node.label && isLikelyTitle(node));
  return firstLabel?.label ?? flatten(nodes).find((node) => node.label)?.label;
}

function isLikelyTitle(node: SnapshotNode): boolean {
  const role = node.role.toLowerCase();
  return role.includes("text") || role.includes("label") || role.includes("navigation") || role.includes("toolbar");
}

function flatten(nodes: SnapshotNode[]): SnapshotNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)]);
}

function countElements(graph: NavGraph): number {
  return Object.values(graph.screens).reduce((total, screen) => total + Object.keys(screen.elements).length, 0);
}

function findElementByGraphRef(graph: NavGraph, graphRef: string): NavGraphElement | undefined {
  for (const screen of Object.values(graph.screens)) {
    const element = Object.values(screen.elements).find((entry) => entry.graphRef === graphRef);
    if (element) {
      return element;
    }
  }
  return undefined;
}

function preferSelector(previous: SnapshotSelector | undefined, next: SnapshotSelector | undefined): SnapshotSelector | undefined {
  if (!previous || selectorRank(next) < selectorRank(previous)) {
    return next ?? previous;
  }
  return previous;
}

function selectorRank(selector: SnapshotSelector | undefined): number {
  switch (selector?.strategy) {
    case "accessibilityId":
      return 1;
    case "androidUiAutomator":
    case "iosPredicate":
      return 2;
    case "xpath":
      return 3;
    default:
      return 99;
  }
}

function bucketBounds(bounds: SnapshotBounds | undefined): string | undefined {
  if (!bounds) {
    return undefined;
  }
  const bucket = (value: number) => Math.round(value / 8) * 8;
  return [bucket(bounds.x), bucket(bounds.y), bucket(bounds.width), bucket(bounds.height)].join(",");
}

function graphDirectory(config: MobiumConfig, appKey: string): string {
  return join(process.cwd(), config.navGraph.outputDir, appKey);
}

function graphJsonPath(config: MobiumConfig, appKey: string): string {
  return join(graphDirectory(config, appKey), "nav-graph.json");
}

function graphMermaidPath(config: MobiumConfig, appKey: string): string {
  return join(graphDirectory(config, appKey), "nav-graph.mmd");
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function sanitizeKey(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "unknown-app";
}

function normalize(value: string | undefined): string | undefined {
  return value?.trim().toLowerCase() || undefined;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function escapeMermaid(value: string): string {
  return value.replace(/"/g, "'").replace(/\|/g, "/").replace(/\n/g, " ");
}
