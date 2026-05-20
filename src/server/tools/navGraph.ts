import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionRegistry } from "../../webdriver/sessionRegistry.js";
import { asTextContent } from "./format.js";

export function registerNavGraphTools(server: McpServer, sessions: SessionRegistry): void {
  server.tool(
    "mobile_nav_graph",
    "Inspect, export, or reset Mobium's persistent per-app Nav Graph of observed screens, elements, and transitions.",
    {
      action: z.enum(["status", "export", "reset"]),
      sessionName: z.string().min(1).default("default"),
      platform: z.enum(["android", "ios"]).optional(),
      deviceId: z.string().min(1).optional(),
      app: z.string().min(1).optional(),
      appPackage: z.string().min(1).optional(),
      appActivity: z.string().min(1).optional(),
      bundleId: z.string().min(1).optional(),
      browserName: z.string().min(1).optional(),
      noReset: z.boolean().default(false),
      fullReset: z.boolean().default(false),
      capabilities: z.record(z.unknown()).default({})
    },
    async (input) => asTextContent(await sessions.navGraph(input))
  );
}
