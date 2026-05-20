import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MobiumConfig } from "../config.js";

export type ConfigCommandRequest = {
  action: "print" | "example" | "init";
  path: string;
  force: boolean;
};

export function parseConfigArgs(args: string[]): ConfigCommandRequest {
  const values = parseFlags(args);
  const action = values.action ?? "print";

  if (!isConfigAction(action)) {
    throw new Error("config --action must be print, example, or init");
  }

  return {
    action,
    path: values.path ?? "mobium.config.json",
    force: values.force === "" || values.force === "true"
  };
}

export async function runConfigCommand(request: ConfigCommandRequest, resolvedConfig?: MobiumConfig): Promise<Record<string, unknown>> {
  switch (request.action) {
    case "print":
      if (!resolvedConfig) {
        throw new Error("config print requires resolved config.");
      }
      return {
        action: request.action,
        config: resolvedConfig
      };
    case "example":
      return {
        action: request.action,
        config: buildExampleConfig()
      };
    case "init": {
      if (existsSync(request.path) && !request.force) {
        throw new Error(`${request.path} already exists. Pass --force to overwrite it.`);
      }

      const directory = dirname(request.path);
      if (directory && directory !== ".") {
        await mkdir(directory, { recursive: true });
      }
      await writeFile(request.path, `${JSON.stringify(buildExampleConfig(), null, 2)}\n`);
      return {
        action: request.action,
        path: request.path,
        created: true,
        overwritten: request.force
      };
    }
  }
}

export function buildExampleConfig(): Record<string, unknown> {
  return {
    appium: {
      host: "127.0.0.1",
      port: 4723,
      basePath: "/",
      autoStart: true,
      command: "appium",
      args: {}
    },
    app: {
      appPackage: "com.example.app",
      appActivity: ".MainActivity"
    },
    sessions: {
      defaultTimeoutMs: 10000,
      isolated: true,
      maxSessions: 1
    },
    artifacts: {
      outputDir: "testing",
      saveScreenshots: true,
      saveSnapshots: true
    },
    navGraph: {
      enabled: true,
      outputDir: "testing/graphs",
      autoCapture: true
    },
    capabilities: {
      vision: false,
      android: true,
      ios: true
    },
    tools: {
      enabledGroups: ["all"]
    }
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

function isConfigAction(value: string): value is ConfigCommandRequest["action"] {
  return value === "print" || value === "example" || value === "init";
}
