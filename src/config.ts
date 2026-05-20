import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

export const toolGroupSchema = z.enum([
  "all",
  "doctor",
  "devices",
  "sessions",
  "apps",
  "inspect",
  "interactions",
  "vision",
  "navGraph",
  "bdd",
  "deviceState",
  "permissions"
]);

export const mobiumConfigSchema = z.object({
  appium: z
    .object({
      host: z.string().default("127.0.0.1"),
      port: z.number().int().positive().default(4723),
      basePath: z.string().default("/"),
      autoStart: z.boolean().default(true),
      command: z.string().default("appium"),
      args: z.record(z.unknown()).default({})
    })
    .default({}),
  sessions: z
    .object({
      defaultTimeoutMs: z.number().int().positive().default(10_000),
      isolated: z.boolean().default(true),
      maxSessions: z.number().int().positive().default(1)
    })
    .default({}),
  app: z
    .object({
      app: z.string().optional(),
      appPackage: z.string().optional(),
      appActivity: z.string().optional(),
      bundleId: z.string().optional(),
      browserName: z.string().optional()
    })
    .default({}),
  artifacts: z
    .object({
      outputDir: z.string().default("testing"),
      saveScreenshots: z.boolean().default(true),
      saveSnapshots: z.boolean().default(true)
    })
    .default({}),
  navGraph: z
    .object({
      enabled: z.boolean().default(true),
      outputDir: z.string().default("testing/graphs"),
      autoCapture: z.boolean().default(true)
    })
    .default({}),
  capabilities: z
    .object({
      vision: z.boolean().default(false),
      android: z.boolean().default(true),
      ios: z.boolean().default(true)
    })
    .default({}),
  tools: z
    .object({
      enabledGroups: z.array(toolGroupSchema).default(["all"])
    })
    .default({})
});

export type MobiumConfig = z.infer<typeof mobiumConfigSchema>;

export function loadConfig(configPath = "mobium.config.json"): MobiumConfig {
  const absolutePath = resolve(process.cwd(), configPath);
  const fileConfig = existsSync(absolutePath)
    ? JSON.parse(readFileSync(absolutePath, "utf8")) as unknown
    : {};

  const envConfig = {
    appium: {
      host: process.env.MOBIUM_APPIUM_HOST,
      port: process.env.MOBIUM_APPIUM_PORT ? Number(process.env.MOBIUM_APPIUM_PORT) : undefined,
      basePath: process.env.MOBIUM_APPIUM_BASE_PATH,
      command: process.env.MOBIUM_APPIUM_COMMAND,
      autoStart: parseBooleanEnv(process.env.MOBIUM_APPIUM_AUTO_START)
    },
    artifacts: {
      outputDir: process.env.MOBIUM_OUTPUT_DIR
    },
    navGraph: {
      enabled: parseBooleanEnv(process.env.MOBIUM_NAV_GRAPH),
      outputDir: process.env.MOBIUM_NAV_GRAPH_OUTPUT_DIR,
      autoCapture: parseBooleanEnv(process.env.MOBIUM_NAV_GRAPH_AUTO_CAPTURE)
    },
    app: {
      app: process.env.MOBIUM_APP,
      appPackage: process.env.MOBIUM_APP_PACKAGE,
      appActivity: process.env.MOBIUM_APP_ACTIVITY,
      bundleId: process.env.MOBIUM_BUNDLE_ID,
      browserName: process.env.MOBIUM_BROWSER_NAME
    },
    capabilities: {
      vision: parseBooleanEnv(process.env.MOBIUM_VISION),
      android: parseBooleanEnv(process.env.MOBIUM_ANDROID),
      ios: parseBooleanEnv(process.env.MOBIUM_IOS)
    },
    tools: {
      enabledGroups: parseListEnv(process.env.MOBIUM_TOOL_GROUPS)
    }
  };

  return mobiumConfigSchema.parse(deepMerge(fileConfig, pruneUndefined(envConfig)));
}

function parseListEnv(value: string | undefined): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }
  return value.split(",").map((entry) => entry.trim()).filter(Boolean);
}

function parseBooleanEnv(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function pruneUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(pruneUndefined);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .map(([key, entryValue]) => [key, pruneUndefined(entryValue)])
  );
}

function deepMerge(base: unknown, override: unknown): unknown {
  if (!isRecord(base) || !isRecord(override)) {
    return override ?? base;
  }

  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    merged[key] = key in merged ? deepMerge(merged[key], value) : value;
  }
  return merged;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
