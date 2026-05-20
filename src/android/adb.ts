import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type AdbResolution = {
  command: string;
  source: "env" | "android-home" | "path" | "common-location";
};

export function resolveAdb(): AdbResolution {
  const explicitPath = process.env.MOBIUM_ADB_PATH;
  if (explicitPath) {
    return { command: explicitPath, source: "env" };
  }

  for (const sdkRoot of [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT]) {
    if (!sdkRoot) {
      continue;
    }

    const adbPath = join(sdkRoot, "platform-tools", adbBinaryName());
    if (existsSync(adbPath)) {
      return { command: adbPath, source: "android-home" };
    }
  }

  for (const adbPath of commonAdbPaths()) {
    if (existsSync(adbPath)) {
      return { command: adbPath, source: "common-location" };
    }
  }

  return { command: "adb", source: "path" };
}

function commonAdbPaths(): string[] {
  const home = homedir();
  return [
    join(home, "Library", "Android", "sdk", "platform-tools", adbBinaryName()),
    join(home, "Android", "Sdk", "platform-tools", adbBinaryName())
  ];
}

function adbBinaryName(): string {
  return process.platform === "win32" ? "adb.exe" : "adb";
}
