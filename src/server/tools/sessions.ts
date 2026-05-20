import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionRegistry } from "../../webdriver/sessionRegistry.js";
import { asTextContent } from "./format.js";

export function registerSessionTools(server: McpServer, sessions: SessionRegistry): void {
  server.tool(
    "mobile_session",
    "Manage mobile automation sessions. Use action=start to create a session, status to list sessions, and end to close one.",
    {
      action: z.enum(["start", "status", "end"]),
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
    async ({ action, sessionName, platform, deviceId, app, appPackage, appActivity, bundleId, browserName, noReset, fullReset, capabilities }) => {
      if (action === "status") {
        return asTextContent({ sessions: sessions.list() });
      }
      if (action === "end") {
        return asTextContent(await sessions.end(sessionName));
      }

      return asTextContent(await sessions.start({
        sessionName,
        platform,
        deviceId,
        app,
        appPackage,
        appActivity,
        bundleId,
        browserName,
        noReset,
        fullReset,
        capabilities
      }));
    }
  );
}
