import { describe, expect, it } from "vitest";
import { buildAgentInstructions } from "../src/agent/instructions.js";

describe("buildAgentInstructions", () => {
  it("emphasizes snapshot-first ref interactions", () => {
    const instructions = buildAgentInstructions();

    expect(instructions).toContain("mobile_inspect with action=snapshot");
    expect(instructions).toContain("Choose elements by snapshot ref");
    expect(instructions).toContain("Nav Graph refs");
    expect(instructions).toContain("mobile_nav_graph");
    expect(instructions).toContain("Do not tap coordinates blindly");
    expect(instructions).toContain("End the session");
  });

  it("includes optional session and platform context", () => {
    const instructions = buildAgentInstructions({
      sessionName: "checkout",
      platform: "android",
      appTarget: "com.example",
      persistence: "reuse",
      vision: true
    });

    expect(instructions).toContain("on android for com.example");
    expect(instructions).toContain("session \"checkout\"");
    expect(instructions).toContain("Reuse the named session");
    expect(instructions).toContain("Vision can be used");
  });
});
