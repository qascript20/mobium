import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { MobiumConfig } from "../../config.js";
import { createMobiumServer } from "../mcpServer.js";

export type HttpTransportOptions = {
  host: string;
  port: number;
  path: string;
};

type TransportSession = {
  transport: StreamableHTTPServerTransport;
  close: () => Promise<void>;
};

export async function runHttpTransport(config: MobiumConfig, options: HttpTransportOptions): Promise<void> {
  const sessions = new Map<string, TransportSession>();
  const path = normalizePath(options.path);

  const server = createServer(async (request, response) => {
    setCorsHeaders(response);

    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `${options.host}:${options.port}`}`);
    if (url.pathname === "/health") {
      writeJson(response, 200, {
        status: "ok",
        transport: "streamable-http",
        endpoint: path
      });
      return;
    }

    if (url.pathname !== path) {
      writeJson(response, 404, {
        error: "not_found",
        message: `Use ${path} for MCP requests.`
      });
      return;
    }

    try {
      const sessionId = headerValue(request, "mcp-session-id");
      const session = sessionId ? sessions.get(sessionId) : undefined;
      if (sessionId && !session) {
        writeJson(response, 404, {
          error: "unknown_mcp_session",
          message: `No MCP session found for '${sessionId}'.`
        });
        return;
      }

      const activeSession = session ?? await createTransportSession(config, sessions);
      await activeSession.transport.handleRequest(request, response);
    } catch (error) {
      if (!response.headersSent) {
        writeJson(response, 500, {
          error: "mcp_transport_error",
          message: error instanceof Error ? error.message : String(error)
        });
      } else {
        response.end();
      }
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, options.host, resolve);
  });

  console.error(`Mobium MCP HTTP server listening at http://${options.host}:${options.port}${path}`);

  await new Promise<void>((resolve) => {
    const shutdown = async () => {
      process.off("SIGINT", shutdown);
      process.off("SIGTERM", shutdown);
      await Promise.all([...sessions.values()].map((session) => session.close()));
      server.close(() => resolve());
    };

    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
}

async function createTransportSession(
  config: MobiumConfig,
  sessions: Map<string, TransportSession>
): Promise<TransportSession> {
  let session: TransportSession | undefined;
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      if (session) {
        sessions.set(sessionId, session);
      }
    }
  });
  const server = createMobiumServer(config);
  session = {
    transport,
    close: async () => {
      await transport.close();
      await server.close();
    }
  };

  transport.onclose = () => {
    for (const [sessionId, candidate] of sessions) {
      if (candidate === session) {
        sessions.delete(sessionId);
      }
    }
  };

  await server.connect(transport);
  return session;
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed || trimmed === "/") {
    return "/mcp";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version");
  response.setHeader("Access-Control-Expose-Headers", "mcp-session-id, mcp-protocol-version");
}

function writeJson(response: ServerResponse, statusCode: number, value: unknown): void {
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(value));
}

function headerValue(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
