import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MobiumConfig } from "../config.js";
import { SessionRegistry } from "../webdriver/sessionRegistry.js";
import { registerAgentPrompts } from "./prompts/agent.js";
import { registerAppTools } from "./tools/apps.js";
import { registerBddTools } from "./tools/bdd.js";
import { registerDeviceTools } from "./tools/devices.js";
import { registerDeviceStateTools } from "./tools/deviceState.js";
import { registerDoctorTools } from "./tools/doctor.js";
import { registerInspectTools } from "./tools/inspect.js";
import { registerInteractionTools } from "./tools/interactions.js";
import { registerNavGraphTools } from "./tools/navGraph.js";
import { registerPermissionsTools } from "./tools/permissions.js";
import { registerSessionTools } from "./tools/sessions.js";
import { registerVisionTools } from "./tools/vision.js";

type ToolGroup = Exclude<MobiumConfig["tools"]["enabledGroups"][number], "all">;

export function createMobiumServer(config: MobiumConfig): McpServer {
  const server = new McpServer({
    name: "mobium",
    version: "0.1.0"
  });
  const sessions = new SessionRegistry(config);

  registerAgentPrompts(server);
  if (isToolGroupEnabled(config, "doctor")) {
    registerDoctorTools(server, config);
  }
  if (isToolGroupEnabled(config, "devices")) {
    registerDeviceTools(server, config);
  }
  if (isToolGroupEnabled(config, "sessions")) {
    registerSessionTools(server, sessions);
  }
  if (isToolGroupEnabled(config, "deviceState")) {
    registerDeviceStateTools(server, sessions);
  }
  if (isToolGroupEnabled(config, "apps")) {
    registerAppTools(server, sessions);
  }
  if (isToolGroupEnabled(config, "inspect")) {
    registerInspectTools(server, sessions);
  }
  if (isToolGroupEnabled(config, "interactions")) {
    registerInteractionTools(server, sessions);
  }
  if (isToolGroupEnabled(config, "navGraph")) {
    registerNavGraphTools(server, sessions);
  }
  if (isToolGroupEnabled(config, "bdd")) {
    registerBddTools(server);
  }
  if (config.capabilities.vision && isToolGroupEnabled(config, "vision")) {
    registerVisionTools(server, sessions);
  }
  if (isToolGroupEnabled(config, "permissions")) {
    registerPermissionsTools(server, sessions);
  }

  return server;
}

export function isToolGroupEnabled(config: MobiumConfig, group: ToolGroup): boolean {
  return config.tools.enabledGroups.includes("all") || config.tools.enabledGroups.includes(group);
}
