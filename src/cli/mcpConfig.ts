export type McpConfigClient = "generic" | "vscode" | "codex" | "claude";

export type McpConfigRequest = {
  client: McpConfigClient;
  transport: "stdio" | "http";
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string>;
  url: string;
};

export function parseMcpConfigArgs(args: string[]): McpConfigRequest {
  const values = parseFlags(args);
  const client = parseClient(firstFlagValue(values.client));
  const transport = parseTransport(firstFlagValue(values.transport) ?? (values.http === "" ? "http" : undefined));

  return {
    client,
    transport,
    command: firstFlagValue(values.command) ?? "mobium",
    args: parseCommandArgs(values),
    cwd: firstFlagValue(values.cwd),
    env: parseEnv(values.env),
    url: firstFlagValue(values.url) ?? "http://127.0.0.1:8931/mcp"
  };
}

export function buildMcpClientConfig(request: McpConfigRequest): Record<string, unknown> {
  const serverConfig = request.transport === "http"
    ? { url: request.url }
    : pruneUndefined({
      command: request.command,
      args: request.args,
      cwd: request.cwd,
      env: request.env
    });

  switch (request.client) {
    case "vscode":
      return {
        servers: {
          mobium: serverConfig
        }
      };
    case "generic":
    case "codex":
    case "claude":
      return {
        mcpServers: {
          mobium: serverConfig
        }
      };
  }
}

export function runMcpConfigCommand(request: McpConfigRequest): Record<string, unknown> {
  return {
    client: request.client,
    transport: request.transport,
    config: buildMcpClientConfig(request)
  };
}

function parseFlags(args: string[]): Record<string, string | string[] | undefined> {
  const values: Record<string, string | string[] | undefined> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument '${arg}'. Use --key value flags.`);
    }

    const inlineFlag = parseInlineFlag(arg);
    const key = inlineFlag.key;
    const inlineValue = inlineFlag.value;
    if (inlineValue !== undefined) {
      addFlagValue(values, key, inlineValue);
      continue;
    }

    const next = args[index + 1];
    if (!next || (next.startsWith("--") && !canValueStartWithDash(key))) {
      addFlagValue(values, key, "");
      continue;
    }

    addFlagValue(values, key, next);
    index += 1;
  }

  return values;
}

function parseInlineFlag(arg: string): { key: string; value?: string } {
  const flag = arg.slice(2);
  const equalsIndex = flag.indexOf("=");
  if (equalsIndex === -1) {
    return { key: flag };
  }
  return {
    key: flag.slice(0, equalsIndex),
    value: flag.slice(equalsIndex + 1)
  };
}

function addFlagValue(values: Record<string, string | string[] | undefined>, key: string, value: string): void {
  const existing = values[key];
  if (existing === undefined) {
    values[key] = value;
    return;
  }
  values[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
}

function canValueStartWithDash(key: string): boolean {
  return ["arg", "args", "client", "command", "cwd", "env", "transport", "url"].includes(key);
}

function parseClient(value: string | undefined): McpConfigClient {
  if (value === undefined) {
    return "generic";
  }
  if (value === "generic" || value === "vscode" || value === "codex" || value === "claude") {
    return value;
  }
  throw new Error("mcp-config --client must be generic, vscode, codex, or claude");
}

function parseTransport(value: string | undefined): McpConfigRequest["transport"] {
  if (value === undefined) {
    return "stdio";
  }
  if (value === "stdio" || value === "http") {
    return value;
  }
  throw new Error("mcp-config --transport must be stdio or http");
}

function parseCommandArgs(values: Record<string, string | string[] | undefined>): string[] {
  if (values.arg !== undefined) {
    return ensureArray(values.arg).filter((value) => value.length > 0);
  }

  const argsValue = values.args;
  if (argsValue === undefined) {
    return ["mcp"];
  }
  if (Array.isArray(argsValue)) {
    throw new Error("mcp-config --args can only be provided once; use repeated --arg for separate values");
  }
  if (argsValue === "") {
    return [];
  }

  const trimmedValue = argsValue.trim();
  if (trimmedValue.startsWith("[")) {
    const parsedValue = JSON.parse(trimmedValue) as unknown;
    if (!Array.isArray(parsedValue) || !parsedValue.every((entry) => typeof entry === "string")) {
      throw new Error("mcp-config --args JSON value must be an array of strings");
    }
    return parsedValue;
  }

  return trimmedValue.split(/\s+/).filter(Boolean);
}

function ensureArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : [value];
}

function firstFlagValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseEnv(value: string | string[] | undefined): Record<string, string> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const entries = ensureArray(value).filter((entry) => entry.length > 0);
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries.map(parseEnvEntry));
}

function parseEnvEntry(value: string): [string, string] {
  const equalsIndex = value.indexOf("=");
  if (equalsIndex < 1) {
    throw new Error("mcp-config --env values must use KEY=VALUE");
  }
  return [value.slice(0, equalsIndex), value.slice(equalsIndex + 1)];
}

function pruneUndefined(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined)
  );
}
