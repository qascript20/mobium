import type { MobiumConfig } from "../config.js";
import { runHttpTransport, type HttpTransportOptions } from "../server/transport/httpTransport.js";
import { runStdioTransport } from "../server/transport/stdioTransport.js";

export type McpTransportRequest = {
  transport: "stdio" | "http";
  host: string;
  port: number;
  path: string;
};

export function parseMcpArgs(args: string[]): McpTransportRequest {
  const values = parseFlags(args);
  const useHttp = values.http === "" || values.transport === "http";

  if (values.transport !== undefined && values.transport !== "stdio" && values.transport !== "http") {
    throw new Error("mcp --transport must be stdio or http");
  }

  return {
    transport: useHttp ? "http" : "stdio",
    host: values.host ?? "127.0.0.1",
    port: parsePort(values.port),
    path: values.path ?? "/mcp"
  };
}

export async function runMcpCommand(config: MobiumConfig, request: McpTransportRequest): Promise<void> {
  if (request.transport === "http") {
    await runHttpTransport(config, toHttpOptions(request));
    return;
  }

  await runStdioTransport(config);
}

function toHttpOptions(request: McpTransportRequest): HttpTransportOptions {
  return {
    host: request.host,
    port: request.port,
    path: request.path
  };
}

function parseFlags(args: string[]): Record<string, string | undefined> {
  const values: Record<string, string | undefined> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument '${arg}'. Use --key value flags.`);
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = "";
      continue;
    }

    values[key] = next;
    index += 1;
  }

  return values;
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === "") {
    return 8931;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("mcp --port must be an integer from 1 to 65535");
  }
  return port;
}
