import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveAppiumCommand(command: string): string {
  if (command !== "appium") {
    return command;
  }

  const localAppium = join(packageRoot(), "node_modules", ".bin", appiumBinaryName());
  return existsSync(localAppium) ? localAppium : command;
}

function packageRoot(): string {
  return dirname(dirname(dirname(fileURLToPath(import.meta.url))));
}

function appiumBinaryName(): string {
  return process.platform === "win32" ? "appium.cmd" : "appium";
}
