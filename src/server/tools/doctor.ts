import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MobiumConfig } from "../../config.js";
import { runDoctor } from "../../appium/health.js";
import { asTextContent } from "./format.js";

export function registerDoctorTools(server: McpServer, config: MobiumConfig): void {
  server.tool(
    "mobile_doctor",
    "Check local Mobium/Appium/Android/iOS dependencies.",
    {},
    async () => asTextContent(await runDoctor(config))
  );
}
