import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionRegistry } from "../../webdriver/sessionRegistry.js";
import { appActionSchema } from "../../webdriver/appManagement.js";
import { asTextContent } from "./format.js";

export function registerAppTools(server: McpServer, sessions: SessionRegistry): void {
  server.tool(
    "mobile_app",
    "Manage apps on the active mobile session. Starts a session automatically if the named session does not exist.",
    {
      ...appActionSchema,
      platform: z.enum(["android", "ios"]).optional(),
      deviceId: z.string().min(1).optional(),
      noReset: z.boolean().default(false),
      fullReset: z.boolean().default(false),
      capabilities: z.record(z.unknown()).default({})
    },
    async (input) => asTextContent(await sessions.app(input))
  );
}
