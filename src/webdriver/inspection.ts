import type { MobiumConfig } from "../config.js";
import { createArtifactPath, updateHtmlReport, writeArtifact } from "../artifacts/store.js";
import { diffSnapshots, formatSnapshotDiff } from "../snapshot/diff.js";
import { formatSnapshot, parseAppiumSource, type SnapshotNode } from "../snapshot/parseAppiumSource.js";

export type InspectAction = "snapshot" | "diff" | "screenshot" | "source" | "contexts" | "setContext";

export type InspectRequest = {
  action: InspectAction;
  sessionName: string;
  artifactAppKey?: string;
  raw?: boolean;
  context?: string;
  waitForWebviewMs?: number;
};

export type InspectionState = {
  lastSnapshot?: SnapshotNode[];
};

export type InspectionOptions = {
  annotateSnapshot?: (tree: SnapshotNode[]) => Promise<Record<string, unknown> | undefined>;
};

type InspectDriver = {
  getPageSource: () => Promise<string>;
  saveScreenshot: (path: string) => Promise<unknown>;
  getContexts?: (options?: { waitForWebviewMs?: number }) => Promise<unknown>;
  getContext?: (options?: { waitForWebviewMs?: number }) => Promise<unknown>;
  switchContext?: (context: string) => Promise<unknown>;
};

export async function performInspection(
  config: MobiumConfig,
  driver: InspectDriver,
  request: InspectRequest,
  state: InspectionState = {},
  options: InspectionOptions = {}
): Promise<Record<string, unknown>> {
  switch (request.action) {
    case "snapshot": {
      const source = await driver.getPageSource();
      const tree = parseAppiumSource(source);
      const navGraph = await options.annotateSnapshot?.(tree);
      const text = formatSnapshot(tree);
      state.lastSnapshot = tree;
      const artifact = config.artifacts.saveSnapshots
        ? await writeArtifact(config, request.sessionName, "snapshot", "json", JSON.stringify({ tree, text }, null, 2), request.artifactAppKey)
        : undefined;

      return request.raw
        ? withNavGraph({ action: request.action, text, tree, artifact }, navGraph)
        : withNavGraph({ action: request.action, text, artifact }, navGraph);
    }
    case "diff": {
      const source = await driver.getPageSource();
      const tree = parseAppiumSource(source);
      const previous = state.lastSnapshot;
      const navGraph = await options.annotateSnapshot?.(tree);
      state.lastSnapshot = tree;

      if (!previous) {
        const text = "(no previous snapshot; baseline captured)";
        return request.raw
          ? withNavGraph({ action: request.action, text, diff: { added: [], removed: [], changed: [] }, tree }, navGraph)
          : withNavGraph({ action: request.action, text }, navGraph);
      }

      const diff = diffSnapshots(previous, tree);
      const text = formatSnapshotDiff(diff);
      const artifact = config.artifacts.saveSnapshots
        ? await writeArtifact(config, request.sessionName, "snapshot-diff", "json", JSON.stringify({ diff, text }, null, 2), request.artifactAppKey)
        : undefined;

      return request.raw
        ? withNavGraph({ action: request.action, text, diff, tree, artifact }, navGraph)
        : withNavGraph({ action: request.action, text, artifact }, navGraph);
    }
    case "source": {
      const source = await driver.getPageSource();
      const artifact = config.artifacts.saveSnapshots
        ? await writeArtifact(config, request.sessionName, "source", "xml", source, request.artifactAppKey)
        : undefined;

      return { action: request.action, source, artifact };
    }
    case "screenshot": {
      const artifact = await createArtifactPath(config, request.sessionName, "screenshot", "png", request.artifactAppKey);
      await driver.saveScreenshot(artifact.path);
      await updateHtmlReport(config, request.sessionName, request.artifactAppKey);
      return { action: request.action, artifact };
    }
    case "contexts": {
      const options = buildContextOptions(request);
      const contexts = driver.getContexts ? await driver.getContexts(options) : [];
      const currentContext = driver.getContext ? await driver.getContext(options) : undefined;
      return { action: request.action, contexts, currentContext };
    }
    case "setContext": {
      if (!request.context) {
        throw new Error("setContext requires context.");
      }
      if (!driver.switchContext) {
        throw new Error("setContext requires driver.switchContext.");
      }

      await driver.switchContext(request.context);
      const options = buildContextOptions(request);
      const currentContext = driver.getContext ? await driver.getContext(options) : request.context;
      return { action: request.action, context: request.context, currentContext };
    }
  }
}

function withNavGraph<T extends Record<string, unknown>>(result: T, navGraph: Record<string, unknown> | undefined): T {
  return navGraph ? { ...result, navGraph } : result;
}

function buildContextOptions(request: InspectRequest): { waitForWebviewMs?: number } | undefined {
  return request.waitForWebviewMs === undefined ? undefined : { waitForWebviewMs: request.waitForWebviewMs };
}
