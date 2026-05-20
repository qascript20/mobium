import type { MobiumConfig } from "../config.js";
import { createArtifactPath, updateHtmlReport, writeArtifact } from "../artifacts/store.js";
import { parseAppiumSource, type SnapshotBounds, type SnapshotNode } from "../snapshot/parseAppiumSource.js";

export type VisionAction = "find" | "tap" | "annotatedScreenshot";

export type VisionRequest = {
  action: VisionAction;
  sessionName: string;
  artifactAppKey?: string;
  query?: string;
  candidateRef?: string;
  x?: number;
  y?: number;
};

export type VisualCandidate = {
  ref: string;
  sourceRef: string;
  label?: string;
  role: string;
  bounds: SnapshotBounds;
  score: number;
};

export type VisionState = {
  candidates: Map<string, VisualCandidate>;
};

type VisionDriver = {
  getPageSource: () => Promise<string>;
  saveScreenshot: (path: string) => Promise<unknown>;
  action?: (type: "pointer") => PointerActionBuilder;
};

type PointerActionBuilder = {
  move: (options: { x: number; y: number; duration?: number }) => PointerActionBuilder;
  down: () => PointerActionBuilder;
  up: () => PointerActionBuilder;
  pause: (duration: number) => PointerActionBuilder;
  perform: () => Promise<unknown>;
};

export async function performVisionAction(
  config: MobiumConfig,
  driver: VisionDriver,
  request: VisionRequest,
  state: VisionState
): Promise<Record<string, unknown>> {
  if (!config.capabilities.vision) {
    throw new Error("Vision tools are disabled. Set capabilities.vision=true to enable them.");
  }

  switch (request.action) {
    case "find": {
      if (!request.query) {
        throw new Error("visual find requires query.");
      }
      const tree = parseAppiumSource(await driver.getPageSource());
      const candidates = findVisualCandidates(tree, request.query);
      rememberCandidates(state, candidates);
      return {
        action: request.action,
        query: request.query,
        candidates
      };
    }
    case "annotatedScreenshot": {
      const screenshot = await createArtifactPath(config, request.sessionName, "screenshot", "png", request.artifactAppKey);
      await driver.saveScreenshot(screenshot.path);
      await updateHtmlReport(config, request.sessionName, request.artifactAppKey);
      const tree = parseAppiumSource(await driver.getPageSource());
      const candidates = flattenNodes(tree)
        .filter((node) => node.bounds)
        .map((node, index) => toCandidate(node, index + 1, 1));
      rememberCandidates(state, candidates);
      const overlay = buildAnnotatedSvg(candidates, screenshot.path);
      const annotation = await writeArtifact(config, request.sessionName, "annotation", "svg", overlay, request.artifactAppKey);
      return {
        action: request.action,
        screenshot,
        annotation,
        candidates
      };
    }
    case "tap": {
      const point = request.candidateRef
        ? centerOf(requireCandidate(state, request.candidateRef).bounds)
        : requirePoint(request);
      await tapPoint(driver, point.x, point.y);
      return {
        action: request.action,
        candidateRef: request.candidateRef,
        point
      };
    }
  }
}

export function createVisionState(): VisionState {
  return {
    candidates: new Map()
  };
}

export function findVisualCandidates(nodes: SnapshotNode[], query: string): VisualCandidate[] {
  const normalizedQuery = normalize(query);
  return flattenNodes(nodes)
    .filter((node) => node.bounds)
    .map((node, index) => ({ node, index, score: scoreNode(node, normalizedQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((entry, index) => toCandidate(entry.node, index + 1, entry.score));
}

export function buildAnnotatedSvg(candidates: VisualCandidate[], screenshotPath: string): string {
  const bounds = candidates.reduce((screen, candidate) => ({
    width: Math.max(screen.width, candidate.bounds.x + candidate.bounds.width),
    height: Math.max(screen.height, candidate.bounds.y + candidate.bounds.height)
  }), { width: 1, height: 1 });

  const boxes = candidates.map((candidate) => {
    const label = `${candidate.ref}${candidate.label ? ` ${candidate.label}` : ""}`;
    return [
      `<rect x="${candidate.bounds.x}" y="${candidate.bounds.y}" width="${candidate.bounds.width}" height="${candidate.bounds.height}" fill="none" stroke="#ff2f5f" stroke-width="2" />`,
      `<text x="${candidate.bounds.x + 4}" y="${candidate.bounds.y + 16}" font-family="monospace" font-size="14" fill="#ff2f5f">${escapeXml(label)}</text>`
    ].join("\n");
  }).join("\n");

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}">`,
    `<image href="${escapeXml(screenshotPath)}" x="0" y="0" width="${bounds.width}" height="${bounds.height}" opacity="0.72" />`,
    boxes,
    "</svg>"
  ].join("\n");
}

function flattenNodes(nodes: SnapshotNode[]): SnapshotNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function scoreNode(node: SnapshotNode, normalizedQuery: string): number {
  const haystack = normalize([node.label, node.value, node.role].filter(Boolean).join(" "));
  if (!haystack) {
    return 0;
  }
  if (haystack === normalizedQuery) {
    return 1;
  }
  if (haystack.includes(normalizedQuery)) {
    return 0.8;
  }
  return normalizedQuery.split(/\s+/).some((word) => haystack.includes(word)) ? 0.4 : 0;
}

function toCandidate(node: SnapshotNode, index: number, score: number): VisualCandidate {
  if (!node.bounds) {
    throw new Error("Visual candidate requires bounds.");
  }
  return {
    ref: `v${index}`,
    sourceRef: node.ref,
    label: node.label,
    role: node.role,
    bounds: node.bounds,
    score
  };
}

function rememberCandidates(state: VisionState, candidates: VisualCandidate[]): void {
  state.candidates.clear();
  for (const candidate of candidates) {
    state.candidates.set(candidate.ref, candidate);
  }
}

function requireCandidate(state: VisionState, candidateRef: string): VisualCandidate {
  const candidate = state.candidates.get(candidateRef);
  if (!candidate) {
    throw new Error(`Unknown visual candidate '${candidateRef}'. Run visual find or annotatedScreenshot first.`);
  }
  return candidate;
}

function requirePoint(request: VisionRequest): { x: number; y: number } {
  if (request.x === undefined || request.y === undefined) {
    throw new Error("visual tap requires candidateRef or x/y coordinates.");
  }
  return { x: request.x, y: request.y };
}

function centerOf(bounds: SnapshotBounds): { x: number; y: number } {
  return {
    x: Math.round(bounds.x + bounds.width / 2),
    y: Math.round(bounds.y + bounds.height / 2)
  };
}

async function tapPoint(driver: VisionDriver, x: number, y: number): Promise<void> {
  if (!driver.action) {
    throw new Error("visual tap requires driver.action.");
  }
  await driver.action("pointer").move({ x, y }).down().pause(50).up().perform();
}

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
