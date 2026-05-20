import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { buildAgentInstructions } from "../../agent/instructions.js";

export function registerAgentPrompts(server: McpServer): void {
  server.registerPrompt(
    "mobium_agent_workflow",
    {
      title: "Mobium Agent Workflow",
      description: "Snapshot-first mobile automation workflow and safety rules for agents using Mobium.",
      argsSchema: {
        sessionName: z.string().min(1).optional(),
        platform: z.enum(["android", "ios"]).optional(),
        appTarget: z.string().min(1).optional(),
        persistence: z.enum(["end", "reuse"]).optional(),
        vision: z.string().optional()
      }
    },
    ({ sessionName, platform, appTarget, persistence, vision }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: buildAgentInstructions({
              sessionName,
              platform,
              appTarget,
              persistence,
              vision: parseBooleanish(vision)
            })
          }
        }
      ]
    })
  );
}

function parseBooleanish(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes" || value === "on";
}
