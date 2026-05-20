import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { generateBddScenarios } from "../../bdd/generator.js";
import { asTextContent } from "./format.js";

export function registerBddTools(server: McpServer): void {
  server.tool(
    "mobile_bdd_generate",
    "Generate prioritized BDD test scenarios using risk-based and priority-based testing best practices.",
    {
      feature: z.string().min(1).optional(),
      inputDocument: z.string().min(1).optional(),
      story: z.string().min(1).optional(),
      acceptanceCriteria: z.array(z.string().min(1)).default([]),
      risks: z.array(z.string().min(1)).default([]),
      roles: z.array(z.string().min(1)).default([]),
      platforms: z.array(z.string().min(1)).default([]),
      businessCriticality: z.enum(["low", "medium", "high"]).default("medium"),
      changeRisk: z.enum(["low", "medium", "high"]).default("medium"),
      dataSensitivity: z.enum(["low", "medium", "high"]).default("medium"),
      includeAccessibility: z.boolean().default(true),
      includeNegative: z.boolean().default(true),
      maxScenarios: z.number().int().positive().optional(),
      format: z.enum(["json", "gherkin", "markdown"]).default("markdown")
    },
    async (input) => {
      const result = generateBddScenarios(input);
      return asTextContent(input.format === "json" ? result : input.format === "gherkin" ? result.gherkin : result.markdown);
    }
  );
}
