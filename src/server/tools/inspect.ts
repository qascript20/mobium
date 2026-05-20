import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionRegistry } from "../../webdriver/sessionRegistry.js";
import { asTextContent } from "./format.js";

export function registerInspectTools(server: McpServer, sessions: SessionRegistry): void {
  server.tool(
    "mobile_inspect",
    "Inspect the current mobile screen. Starts a session automatically if the named session does not exist.",
    {
      action: z.enum(["snapshot", "diff", "screenshot", "source", "contexts", "setContext"]),
      sessionName: z.string().min(1).default("default"),
      raw: z.boolean().default(false),
      context: z.string().min(1).optional(),
      waitForWebviewMs: z.number().int().nonnegative().optional(),
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
    async (input) => asTextContent(await sessions.inspect(input))
  );
}
