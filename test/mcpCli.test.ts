import { describe, expect, it } from "vitest";
import { parseMcpArgs } from "../src/cli/mcp.js";

describe("parseMcpArgs", () => {
  it("defaults to stdio", () => {
    expect(parseMcpArgs([])).toEqual({
      transport: "stdio",
      host: "127.0.0.1",
      port: 8931,
      path: "/mcp"
    });
  });

  it("parses http transport options", () => {
    expect(parseMcpArgs([
      "--http",
      "--host",
      "0.0.0.0",
      "--port",
      "9000",
      "--path",
      "/mobile"
    ])).toEqual({
      transport: "http",
      host: "0.0.0.0",
      port: 9000,
      path: "/mobile"
    });
  });

  it("parses explicit transport", () => {
    expect(parseMcpArgs(["--transport", "http"])).toEqual(expect.objectContaining({
      transport: "http"
    }));
  });

  it("ignores client launch capability flags for stdio", () => {
    expect(parseMcpArgs(["--caps", "tools"])).toEqual({
      transport: "stdio",
      host: "127.0.0.1",
      port: 8931,
      path: "/mcp"
    });
  });

  it("rejects invalid ports", () => {
    expect(() => parseMcpArgs(["--http", "--port", "99999"])).toThrow("mcp --port");
  });
});
