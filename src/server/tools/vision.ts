import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionRegistry } from "../../webdriver/sessionRegistry.js";
import { asTextContent } from "./format.js";

export function registerVisionTools(server: McpServer, sessions: SessionRegistry): void {
  server.tool(
    "mobile_vision",
    "Vision fallback tools: find accessibility-backed visual candidates, tap candidates, and save annotated screenshots.",
    {
      action: z.enum(["find", "tap", "annotatedScreenshot"]),
      sessionName: z.string().min(1).default("default"),
      query: z.string().min(1).optional(),
      candidateRef: z.string().min(1).optional(),
      x: z.number().int().optional(),
      y: z.number().int().optional(),
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
    async (input) => asTextContent(await sessions.vision(input))
  );
}
