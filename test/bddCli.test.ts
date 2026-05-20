import { describe, expect, it } from "vitest";
import { parseBddArgs, runBddCommand } from "../src/cli/bdd.js";

describe("BDD CLI", () => {
  it("parses repeated criteria, risks, and roles", () => {
    expect(parseBddArgs([
      "--feature",
      "Checkout",
      "--acceptance-criteria",
      "User can pay",
      "--acceptance-criteria",
      "User gets receipt",
      "--risk",
      "Payment timeout",
      "--role",
      "shopper",
      "--business-criticality",
      "high",
      "--format",
      "gherkin"
    ])).toEqual(expect.objectContaining({
      feature: "Checkout",
      acceptanceCriteria: ["User can pay", "User gets receipt"],
      risks: ["Payment timeout"],
      roles: ["shopper"],
      businessCriticality: "high",
      format: "gherkin"
    }));
  });

  it("renders gherkin output", () => {
    expect(runBddCommand({
      feature: "Search",
      acceptanceCriteria: ["User can find a product"],
      format: "gherkin"
    })).toContain("Feature: Search");
  });

  it("requires a feature", () => {
    expect(() => parseBddArgs([])).toThrow("bdd requires --feature or --document/--document-path");
  });

  it("accepts document-only generation", () => {
    expect(parseBddArgs([
      "--document",
      "# Login\nAcceptance Criteria:\n- User can sign in\nRisk: Account lockout\nFormat: json"
    ])).toEqual(expect.objectContaining({
      inputDocument: expect.stringContaining("Acceptance Criteria")
    }));
  });
});
