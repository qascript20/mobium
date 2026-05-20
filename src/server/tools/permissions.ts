import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { permissionsActionSchema } from "../../webdriver/permissions.js";
import type { SessionRegistry } from "../../webdriver/sessionRegistry.js";
import { asTextContent } from "./format.js";

export function registerPermissionsTools(server: McpServer, sessions: SessionRegistry): void {
  server.tool(
    "mobile_permissions",
    "Get or change Android app permissions through the active mobile session.",
    {
      ...permissionsActionSchema,
      platform: z.enum(["android", "ios"]).optional(),
      deviceId: z.string().min(1).optional(),
      app: z.string().min(1).optional(),
      appActivity: z.string().min(1).optional(),
      browserName: z.string().min(1).optional(),
      noReset: z.boolean().default(false),
      fullReset: z.boolean().default(false),
      capabilities: z.record(z.unknown()).default({})
    },
    async (input) => asTextContent(await sessions.permissions(input))
  );
}
