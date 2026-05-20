#!/usr/bin/env node
import { loadConfig } from "./config.js";
import { runDoctor } from "./appium/health.js";
import { parseAppArgs, runAppCommand } from "./cli/app.js";
import { parseBddArgs, runBddCommand } from "./cli/bdd.js";
import { parseConfigArgs, runConfigCommand } from "./cli/config.js";
import { parseDevicesArgs, runDevicesCommand } from "./cli/devices.js";
import { parseDeviceStateArgs, runDeviceStateCommand } from "./cli/deviceState.js";
import { parseInspectArgs, runInspectCommand } from "./cli/inspect.js";
import { parseInteractArgs, runInteractCommand } from "./cli/interact.js";
import { parseMcpConfigArgs, runMcpConfigCommand } from "./cli/mcpConfig.js";
import { parseMcpArgs, runMcpCommand } from "./cli/mcp.js";
import { parsePermissionsArgs, runPermissionsCommand } from "./cli/permissions.js";
import { parseStartSessionArgs, startMobileSession } from "./cli/startSession.js";

type Command = "doctor" | "devices" | "config" | "mcp-config" | "start-session" | "app" | "device-state" | "permissions" | "inspect" | "interact" | "bdd" | "mcp" | "help";

async function main(): Promise<void> {
  const command = parseCommand(process.argv[2]);

  switch (command) {
    case "doctor":
      printJson(await runDoctor(loadConfig()));
      break;
    case "devices": {
      printJson(await runDevicesCommand(loadConfig(), parseDevicesArgs(process.argv.slice(3))));
      break;
    }
    case "config": {
      const request = parseConfigArgs(process.argv.slice(3));
      printJson(await runConfigCommand(request, request.action === "print" ? loadConfig() : undefined));
      break;
    }
    case "mcp-config":
      printJson(runMcpConfigCommand(parseMcpConfigArgs(process.argv.slice(3))));
      break;
    case "start-session":
      printJson(await startMobileSession(loadConfig(), parseStartSessionArgs(process.argv.slice(3))));
      break;
    case "app":
      printJson(await runAppCommand(loadConfig(), parseAppArgs(process.argv.slice(3))));
      break;
    case "device-state":
      printJson(await runDeviceStateCommand(loadConfig(), parseDeviceStateArgs(process.argv.slice(3))));
      break;
    case "permissions":
      printJson(await runPermissionsCommand(loadConfig(), parsePermissionsArgs(process.argv.slice(3))));
      break;
    case "inspect":
      printJson(await runInspectCommand(loadConfig(), parseInspectArgs(process.argv.slice(3))));
      break;
    case "interact":
      printJson(await runInteractCommand(loadConfig(), parseInteractArgs(process.argv.slice(3))));
      break;
    case "bdd":
      printJson(runBddCommand(parseBddArgs(process.argv.slice(3))));
      break;
    case "mcp":
      await runMcpCommand(loadConfig(), parseMcpArgs(command === process.argv[2] ? process.argv.slice(3) : process.argv.slice(2)));
      break;
    case "help":
      printHelp();
      break;
  }
}

function parseCommand(value: string | undefined): Command {
  if (!value || value === "--help" || value === "-h") {
    return "help";
  }
  if (value === "--caps") {
    return "mcp";
  }
  if (value === "doctor" || value === "devices" || value === "config" || value === "mcp-config" || value === "start-session" || value === "app" || value === "device-state" || value === "permissions" || value === "inspect" || value === "interact" || value === "bdd" || value === "mcp") {
    return value;
  }

  throw new Error(`Unknown command: ${value}`);
}

function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp(): void {
  console.log(`Mobium

Usage:
  mobium doctor   Check local dependencies
  mobium devices [--platform android|ios|both]
                  Discover connected mobile devices
  mobium config [--action print|example|init]
                  Print or initialize Mobium configuration
  mobium mcp-config [--client generic|vscode|codex|claude] [--command mobium] [--args "mcp"] [--cwd .] [--env KEY=VALUE]
                  Print MCP client configuration snippets
  mobium start-session [--platform android|ios] [--device-id <id>]
                  Start a mobile Appium session
  mobium app --action <action> [--platform android|ios]
                  Manage apps through a mobile Appium session
  mobium device-state --action <action> [--platform android|ios]
                  Manage device state for a mobile Appium session
  mobium permissions --action <action> [--app-package <id>]
                  Get or change Android app permissions
  mobium inspect [--action snapshot|diff|screenshot|source|contexts|setContext]
                  Inspect the current mobile screen
  mobium interact --action <action> [--ref m1]
                  Tap, type, clear, wait, press keys, swipe, scroll, long press, or drag
  mobium bdd --feature <name> [--acceptance-criteria <text>] [--risk <text>]
                  Generate prioritized BDD scenarios with risk-based coverage
  mobium mcp      Run the MCP server over stdio
  mobium mcp --http --port 8931
                  Run the MCP server over streamable HTTP

Examples:
  mobium config --action init
  mobium config --action example
  mobium mcp-config --client vscode
  mobium mcp-config --client claude --transport http
  mobium mcp-config --command node --args "--import tsx src/cli.ts mcp"
  mobium mcp-config --client vscode --cwd . --env LOG_LEVEL=warn --env APPIUM_URL=http://127.0.0.1:4723
  mobium devices --platform android
  mobium devices --platform ios
  mobium start-session --platform android
  mobium start-session --platform android --device-id 46240DLAQ004VD
  mobium start-session --platform android --device-id 46240DLAQ004VD --app-package com.android.settings --app-activity .Settings
  mobium app --action state --platform android --app-package com.android.settings
  mobium app --action activate --platform android --app-package com.android.settings
  mobium device-state --action isLocked --platform android
  mobium device-state --action setClipboard --content SGVsbG8=
  mobium permissions --action get --app-package com.example.app
  mobium permissions --action grant --app-package com.example.app --permissions android.permission.CAMERA
  mobium inspect
  mobium inspect --action diff
  mobium inspect --action screenshot
  mobium inspect --action setContext --context WEBVIEW_com.example
  mobium interact --action tap --ref m3
  mobium interact --action type --ref m4 --text hello
  mobium interact --action longPress --ref m3
  mobium interact --action drag --from-ref m3 --to-x 200 --to-y 600
  mobium bdd --feature "Checkout" --acceptance-criteria "User can pay by card" --risk "Payment failure" --business-criticality high
  mobium mcp --http --port 8931
`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
