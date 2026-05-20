import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { deviceStateActionSchema } from "../../webdriver/deviceState.js";
import type { SessionRegistry } from "../../webdriver/sessionRegistry.js";
import { asTextContent } from "./format.js";

export function registerDeviceStateTools(server: McpServer, sessions: SessionRegistry): void {
  server.tool(
    "mobile_device_state",
    "Manage mobile device state for an active session: lock, unlock, clipboard, and supported network toggles.",
    {
      ...deviceStateActionSchema,
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
    async (input) => asTextContent(await sessions.deviceState(input))
  );
}
