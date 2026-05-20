import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { MobiumConfig } from "../../config.js";
import { createMobiumServer } from "../mcpServer.js";

export async function runStdioTransport(config: MobiumConfig): Promise<void> {
  const server = createMobiumServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
