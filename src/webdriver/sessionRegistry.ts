import { remote } from "webdriverio";
import { ensureAppiumServer } from "../appium/processManager.js";
import type { MobiumConfig } from "../config.js";
import {
  captureNavGraph,
  createNavGraphState,
  exportNavGraph,
  graphRefForSnapshotRef,
  resetNavGraph,
  resolveGraphRef,
  statusNavGraph,
  type NavGraphState
} from "../navGraph/navGraph.js";
import { parseAppiumSource } from "../snapshot/parseAppiumSource.js";
import { performAppAction, type AppActionRequest } from "./appManagement.js";
import { buildCapabilities, type StartSessionInput, type StartSessionRequest } from "./capabilities.js";
import { performDeviceStateAction, type DeviceStateActionRequest } from "./deviceState.js";
import { performInspection, type InspectionState, type InspectRequest } from "./inspection.js";
import { performInteraction, type InteractionRequest } from "./interactions.js";
import { performPermissionsAction, type PermissionsActionRequest } from "./permissions.js";
import { resolveStartSessionInput } from "./resolveSession.js";
import { createVisionState, performVisionAction, type VisionRequest, type VisionState } from "./vision.js";

type WebdriverSession = Awaited<ReturnType<typeof remote>>;

export type SessionSummary = {
  name: string;
  sessionId?: string;
  platform: StartSessionInput["platform"];
  deviceId: string;
  capabilities: Record<string, unknown>;
  createdAt: string;
  device?: {
    id: string;
    platform: string;
    name: string;
    state: string;
    kind: string;
    osVersion?: string;
    apiLevel?: number;
    model?: string;
    manufacturer?: string;
  };
  warnings?: string[];
  appium?: {
    host: string;
    port: number;
    basePath: string;
    autoStarted: boolean;
    pid?: number;
  };
};

type StoredSession = SessionSummary & {
  driver: WebdriverSession;
  inspectionState: InspectionState;
  visionState: VisionState;
  navGraphState: NavGraphState;
};

export type NavGraphActionRequest = {
  action: "status" | "export" | "reset";
  sessionName: string;
};

export class SessionRegistry {
  private readonly sessions = new Map<string, StoredSession>();

  constructor(private readonly config: MobiumConfig) {}

  async start(request: StartSessionRequest): Promise<SessionSummary> {
    if (this.sessions.has(request.sessionName)) {
      throw new Error(`Session '${request.sessionName}' already exists. End it before starting a new one with the same name.`);
    }
    if (this.sessions.size >= this.config.sessions.maxSessions) {
      throw new Error(`Maximum session count reached (${this.config.sessions.maxSessions}).`);
    }

    const { input, device, warnings } = await resolveStartSessionInput(this.config, request);
    const appiumServer = await ensureAppiumServer(this.config);
    const capabilities = buildCapabilities(input);
    const driver = await remote({
      hostname: appiumServer.host,
      port: appiumServer.port,
      path: appiumServer.basePath,
      connectionRetryCount: 0,
      capabilities
    });

    const summary: SessionSummary = {
      name: input.sessionName,
      sessionId: driver.sessionId,
      platform: input.platform,
      deviceId: input.deviceId,
      capabilities,
      createdAt: new Date().toISOString(),
      device,
      warnings,
      appium: {
        host: appiumServer.host,
        port: appiumServer.port,
        basePath: appiumServer.basePath,
        autoStarted: appiumServer.started,
        pid: appiumServer.pid
      }
    };

    this.sessions.set(input.sessionName, {
      ...summary,
      driver,
      inspectionState: {},
      visionState: createVisionState(),
      navGraphState: createNavGraphState(summary)
    });

    return summary;
  }

  list(): SessionSummary[] {
    return [...this.sessions.values()].map((session) => this.summarize(session));
  }

  async app(request: AppActionRequest & StartSessionRequest): Promise<Record<string, unknown>> {
    const session = await this.getOrStart(request);

    return {
      session: this.summarize(session),
      app: await performAppAction(session.driver, request)
    };
  }

  async inspect(request: InspectRequest & StartSessionRequest): Promise<Record<string, unknown>> {
    const session = await this.getOrStart(request);
    const warnings: string[] = [];

    return {
      session: this.summarize(session),
      inspection: await performInspection(this.config, session.driver, {
        ...request,
        artifactAppKey: session.navGraphState.appKey
      }, session.inspectionState, {
        annotateSnapshot: async (tree) => {
          try {
            return await captureNavGraph(this.config, session.navGraphState, tree);
          } catch (error) {
            warnings.push(formatNavGraphWarning(error));
            return undefined;
          }
        }
      }),
      ...(warnings.length > 0 ? { warnings } : {})
    };
  }

  async interact(request: InteractionRequest & StartSessionRequest): Promise<Record<string, unknown>> {
    const session = await this.getOrStart(request);
    const warnings: string[] = [];
    const fromScreenId = session.navGraphState.currentScreenId;

    const interaction = await performInteraction(session.driver, request, {
      resolveGraphRef: async (graphRef) => {
        const source = await session.driver.getPageSource();
        const resolved = await resolveGraphRef(this.config, session.navGraphState, source, graphRef);
        return resolved ? { selector: resolved.selector, bounds: resolved.node.bounds } : undefined;
      },
      resolveStaleRef: async (ref) => {
        const graphRef = graphRefForSnapshotRef(session.navGraphState, ref);
        if (!graphRef) {
          return undefined;
        }
        const source = await session.driver.getPageSource();
        const resolved = await resolveGraphRef(this.config, session.navGraphState, source, graphRef);
        return resolved ? { selector: resolved.selector, bounds: resolved.node.bounds } : undefined;
      }
    });

    let navGraph: Record<string, unknown> | undefined;
    try {
      const source = await session.driver.getPageSource();
      navGraph = await captureNavGraph(this.config, session.navGraphState, parseAppiumSource(source), {
        fromScreenId,
        action: request.action,
        target: request.graphRef ?? request.ref ?? request.accessibilityId ?? request.text
      });
    } catch (error) {
      warnings.push(formatNavGraphWarning(error));
    }

    return {
      session: this.summarize(session),
      interaction,
      ...(navGraph ? { navGraph } : {}),
      ...(warnings.length > 0 ? { warnings } : {})
    };
  }

  async deviceState(request: DeviceStateActionRequest & StartSessionRequest): Promise<Record<string, unknown>> {
    const session = await this.getOrStart(request);

    return {
      session: this.summarize(session),
      device: await performDeviceStateAction(session.driver, request)
    };
  }

  async permissions(request: PermissionsActionRequest & StartSessionRequest): Promise<Record<string, unknown>> {
    const session = await this.getOrStart(request);

    return {
      session: this.summarize(session),
      permissions: await performPermissionsAction(session.driver, request)
    };
  }

  async vision(request: VisionRequest & StartSessionRequest): Promise<Record<string, unknown>> {
    const session = await this.getOrStart(request);

    return {
      session: this.summarize(session),
      vision: await performVisionAction(this.config, session.driver, {
        ...request,
        artifactAppKey: session.navGraphState.appKey
      }, session.visionState)
    };
  }

  async navGraph(request: NavGraphActionRequest & StartSessionRequest): Promise<Record<string, unknown>> {
    const session = await this.getOrStart(request);
    const navGraph = request.action === "status"
      ? await statusNavGraph(this.config, session.navGraphState)
      : request.action === "export"
        ? await exportNavGraph(this.config, session.navGraphState)
        : await resetNavGraph(this.config, session.navGraphState);

    return {
      session: this.summarize(session),
      navGraph
    };
  }

  private async getOrStart(request: StartSessionRequest): Promise<StoredSession> {
    let session = this.sessions.get(request.sessionName);
    if (!session) {
      await this.start(request);
      session = this.sessions.get(request.sessionName);
    }
    if (!session) {
      throw new Error(`Session '${request.sessionName}' was not started.`);
    }

    return session;
  }

  async end(sessionName: string): Promise<{ ended: boolean; session?: SessionSummary }> {
    const session = this.sessions.get(sessionName);
    if (!session) {
      return { ended: false };
    }

    this.sessions.delete(sessionName);
    await session.driver.deleteSession();
    const { driver: _driver, inspectionState: _inspectionState, visionState: _visionState, navGraphState: _navGraphState, ...summary } = session;
    return { ended: true, session: summary };
  }

  async endAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map((name) => this.end(name)));
  }

  private summarize(session: StoredSession): SessionSummary {
    const { driver: _driver, inspectionState: _inspectionState, visionState: _visionState, navGraphState: _navGraphState, ...summary } = session;
    return summary;
  }
}

function formatNavGraphWarning(error: unknown): string {
  return `Nav Graph capture failed: ${error instanceof Error ? error.message : String(error)}`;
}
