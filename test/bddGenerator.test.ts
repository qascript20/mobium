import { describe, expect, it } from "vitest";
import { generateBddScenarios, inferBddContext } from "../src/bdd/generator.js";

describe("generateBddScenarios", () => {
  it("generates prioritized risk-based BDD scenarios", () => {
    const result = generateBddScenarios({
      feature: "Checkout",
      story: "As a shopper I want to pay for my basket so that I can complete an order.",
      acceptanceCriteria: ["User can pay by card", "User sees an order confirmation"],
      risks: ["Payment authorization fails", "Duplicate order is created"],
      businessCriticality: "high",
      changeRisk: "high",
      dataSensitivity: "high",
      platforms: ["android"],
      maxScenarios: 5
    });

    expect(result.scenarios).toHaveLength(5);
    expect(result.scenarios[0]).toEqual(expect.objectContaining({
      priority: "P0",
      risk: "high"
    }));
    expect(result.gherkin).toContain("Feature: Checkout");
    expect(result.gherkin).toContain("@p0");
    expect(result.markdown).toContain("## Coverage Strategy");
    expect(result.coverage).toEqual(expect.arrayContaining([
      expect.stringContaining("Prioritized by business criticality=high")
    ]));
  });

  it("can omit negative and accessibility scenarios", () => {
    const result = generateBddScenarios({
      feature: "Login",
      includeNegative: false,
      includeAccessibility: false,
      platforms: ["ios"]
    });

    expect(result.scenarios.some((scenario) => scenario.type === "negative")).toBe(false);
    expect(result.scenarios.some((scenario) => scenario.type === "accessibility")).toBe(false);
  });

  it("infers criteria, risks, criticality, platforms, and format from an input document", () => {
    const document = `# Checkout Payment

As a shopper, I want to pay by saved card so that I can complete an order.

Acceptance Criteria:
- User can pay with a saved card
- User sees an order confirmation

Risks:
- Payment authorization fails
- Duplicate order is created

Notes: This is P0 revenue-critical mobile work on Android and iOS. It handles card data.
Format: gherkin`;

    const inferred = inferBddContext(document);
    expect(inferred).toEqual(expect.objectContaining({
      feature: "Checkout Payment",
      businessCriticality: "high",
      dataSensitivity: "high",
      format: "gherkin"
    }));
    expect(inferred.acceptanceCriteria).toEqual([
      "User can pay with a saved card",
      "User sees an order confirmation"
    ]);
    expect(inferred.risks).toEqual(expect.arrayContaining(["Payment authorization fails"]));
    expect(inferred.platforms).toEqual(["android", "ios"]);

    const result = generateBddScenarios({ inputDocument: document });
    expect(result.feature).toBe("Checkout Payment");
    expect(result.inferred.format).toBe("gherkin");
    expect(result.scenarios[0].priority).toBe("P0");
  });
});
