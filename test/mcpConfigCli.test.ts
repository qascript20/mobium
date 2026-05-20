import { describe, expect, it } from "vitest";
import { buildMcpClientConfig, parseMcpConfigArgs, runMcpConfigCommand } from "../src/cli/mcpConfig.js";

describe("mcp-config CLI", () => {
  it("defaults to generic stdio config", () => {
    expect(parseMcpConfigArgs([])).toEqual({
      client: "generic",
      transport: "stdio",
      command: "mobium",
      args: ["mcp"],
      cwd: undefined,
      env: undefined,
      url: "http://127.0.0.1:8931/mcp"
    });

    expect(buildMcpClientConfig(parseMcpConfigArgs([]))).toEqual({
      mcpServers: {
        mobium: {
          command: "mobium",
          args: ["mcp"]
        }
      }
    });
  });

  it("builds VS Code config shape", () => {
    expect(runMcpConfigCommand(parseMcpConfigArgs(["--client", "vscode"]))).toEqual({
      client: "vscode",
      transport: "stdio",
      config: {
        servers: {
          mobium: {
            command: "mobium",
            args: ["mcp"]
          }
        }
      }
    });
  });

  it("builds HTTP config", () => {
    expect(buildMcpClientConfig(parseMcpConfigArgs([
      "--transport",
      "http",
      "--url",
      "http://localhost:9000/mobile"
    ]))).toEqual({
      mcpServers: {
        mobium: {
          url: "http://localhost:9000/mobile"
        }
      }
    });
  });

  it("builds stdio config with custom command args", () => {
    expect(buildMcpClientConfig(parseMcpConfigArgs([
      "--command",
      "node",
      "--args",
      "--import tsx src/cli.ts mcp"
    ]))).toEqual({
      mcpServers: {
        mobium: {
          command: "node",
          args: ["--import", "tsx", "src/cli.ts", "mcp"]
        }
      }
    });
  });

  it("builds stdio config with repeated custom args", () => {
    expect(buildMcpClientConfig(parseMcpConfigArgs([
      "--command",
      "node",
      "--arg=--import",
      "--arg",
      "tsx",
      "--arg",
      "src/cli.ts",
      "--arg",
      "mcp"
    ]))).toEqual({
      mcpServers: {
        mobium: {
          command: "node",
          args: ["--import", "tsx", "src/cli.ts", "mcp"]
        }
      }
    });
  });

  it("builds stdio config with cwd and env", () => {
    expect(buildMcpClientConfig(parseMcpConfigArgs([
      "--client",
      "vscode",
      "--command",
      "mobium",
      "--cwd",
      ".",
      "--env",
      "LOG_LEVEL=warn",
      "--env=APPIUM_URL=http://127.0.0.1:4723"
    ]))).toEqual({
      servers: {
        mobium: {
          command: "mobium",
          args: ["mcp"],
          cwd: ".",
          env: {
            LOG_LEVEL: "warn",
            APPIUM_URL: "http://127.0.0.1:4723"
          }
        }
      }
    });
  });

  it("rejects invalid clients", () => {
    expect(() => parseMcpConfigArgs(["--client", "other"])).toThrow("mcp-config --client");
  });

  it("rejects invalid env values", () => {
    expect(() => parseMcpConfigArgs(["--env", "LOG_LEVEL"])).toThrow("mcp-config --env");
  });
});
