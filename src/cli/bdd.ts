import { readFileSync } from "node:fs";
import { generateBddScenarios, type GenerateBddScenariosRequest } from "../bdd/generator.js";

export function parseBddArgs(args: string[]): GenerateBddScenariosRequest {
  const values = parseFlags(args);
  const feature = values.feature?.[0];
  const inputDocument = values.document?.[0] ?? readDocumentPath(values["document-path"]?.[0]);
  if (!feature && !inputDocument) {
    throw new Error("bdd requires --feature or --document/--document-path.");
  }

  return {
    feature,
    inputDocument,
    story: values.story?.[0],
    acceptanceCriteria: values["acceptance-criteria"] ?? values.ac,
    risks: values.risk,
    roles: values.role,
    platforms: values.platform,
    businessCriticality: parseLevel(values["business-criticality"]?.[0], "business-criticality"),
    changeRisk: parseLevel(values["change-risk"]?.[0], "change-risk"),
    dataSensitivity: parseLevel(values["data-sensitivity"]?.[0], "data-sensitivity"),
    includeAccessibility: parseBoolean(values["include-accessibility"]?.[0]),
    includeNegative: parseBoolean(values["include-negative"]?.[0]),
    maxScenarios: parseOptionalNumber(values["max-scenarios"]?.[0]),
    format: parseFormat(values.format?.[0])
  };
}

export function runBddCommand(request: GenerateBddScenariosRequest): unknown {
  const result = generateBddScenarios(request);
  switch (request.format) {
    case "gherkin":
      return result.gherkin;
    case "json":
      return result;
    case "markdown":
    default:
      return result.markdown;
  }
}

function parseFlags(args: string[]): Record<string, string[]> {
  const values: Record<string, string[]> = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument '${arg}'. Use --key value flags.`);
    }

    const key = arg.slice(2);
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      values[key] = [...(values[key] ?? []), ""];
      continue;
    }
    values[key] = [...(values[key] ?? []), next];
    index += 1;
  }

  return values;
}

function parseLevel(value: string | undefined, name: string): "low" | "medium" | "high" | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "low" || value === "medium" || value === "high") {
    return value;
  }
  throw new Error(`--${name} must be low, medium, or high.`);
}

function parseFormat(value: string | undefined): "json" | "gherkin" | "markdown" | undefined {
  if (!value) {
    return undefined;
  }
  if (value === "json" || value === "gherkin" || value === "markdown") {
    return value;
  }
  throw new Error("--format must be json, gherkin, or markdown.");
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === "" || value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  throw new Error("Boolean flags must be true or false.");
}

function parseOptionalNumber(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("--max-scenarios must be a positive integer.");
  }
  return parsed;
}

function readDocumentPath(path: string | undefined): string | undefined {
  if (!path) {
    return undefined;
  }
  return readFileSync(path, "utf8");
}
