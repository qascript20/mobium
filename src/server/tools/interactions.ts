import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { SessionRegistry } from "../../webdriver/sessionRegistry.js";
import { asTextContent } from "./format.js";

export function registerInteractionTools(server: McpServer, sessions: SessionRegistry): void {
  server.tool(
    "mobile_interact",
    "Interact with the current mobile screen by accessibility snapshot ref or explicit mobile gesture input.",
    {
      action: z.enum(["tap", "type", "clear", "wait", "pressKey", "swipe", "scroll", "longPress", "drag"]),
      sessionName: z.string().min(1).default("default"),
      ref: z.string().min(1).optional(),
      graphRef: z.string().min(1).optional(),
      fromRef: z.string().min(1).optional(),
      toRef: z.string().min(1).optional(),
      text: z.string().optional(),
      accessibilityId: z.string().min(1).optional(),
      x: z.number().int().optional(),
      y: z.number().int().optional(),
      toX: z.number().int().optional(),
      toY: z.number().int().optional(),
      key: z.string().min(1).optional(),
      keycode: z.number().int().optional(),
      timeoutMs: z.number().int().positive().optional(),
      durationMs: z.number().int().positive().optional(),
      direction: z.enum(["up", "down", "left", "right"]).optional(),
      percent: z.number().positive().max(1).optional(),
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
    async (input) => asTextContent(await sessions.interact(input))
  );
}
