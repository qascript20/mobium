export type BddPriority = "P0" | "P1" | "P2" | "P3";

export type GenerateBddScenariosRequest = {
  feature?: string;
  inputDocument?: string;
  story?: string;
  acceptanceCriteria?: string[];
  risks?: string[];
  roles?: string[];
  platforms?: string[];
  businessCriticality?: "low" | "medium" | "high";
  changeRisk?: "low" | "medium" | "high";
  dataSensitivity?: "low" | "medium" | "high";
  includeAccessibility?: boolean;
  includeNegative?: boolean;
  maxScenarios?: number;
  format?: "json" | "gherkin" | "markdown";
};

export type BddScenario = {
  id: string;
  title: string;
  priority: BddPriority;
  risk: "low" | "medium" | "high";
  type: "happy-path" | "negative" | "boundary" | "accessibility" | "regression" | "platform";
  tags: string[];
  rationale: string;
  given: string[];
  when: string[];
  then: string[];
  testData: string[];
  traceability: string[];
};

export type GenerateBddScenariosResult = {
  feature: string;
  story?: string;
  inferred: InferredBddContext;
  coverage: string[];
  scenarios: BddScenario[];
  gherkin: string;
  markdown: string;
};

export type InferredBddContext = {
  feature?: string;
  story?: string;
  acceptanceCriteria: string[];
  risks: string[];
  roles: string[];
  platforms: string[];
  businessCriticality?: "low" | "medium" | "high";
  changeRisk?: "low" | "medium" | "high";
  dataSensitivity?: "low" | "medium" | "high";
  format?: "json" | "gherkin" | "markdown";
};

type ScenarioSeed = Omit<BddScenario, "id" | "priority" | "risk" | "tags" | "traceability"> & {
  riskBoost: number;
  priorityBoost: number;
  traceability?: string[];
};

export function generateBddScenarios(request: GenerateBddScenariosRequest): GenerateBddScenariosResult {
  const inferred = inferBddContext(request.inputDocument);
  const merged = mergeInferredContext(request, inferred);
  if (!merged.feature?.trim()) {
    throw new Error("feature is required.");
  }

  const context = normalizeRequest(merged);
  const riskScore = calculateRiskScore(context);
  const seeds = buildScenarioSeeds(context);
  const maxScenarios = Math.max(1, context.maxScenarios ?? 12);
  const scenarios = seeds
    .map((seed, index) => toScenario(seed, index + 1, riskScore, context))
    .sort(compareScenarios)
    .slice(0, maxScenarios)
    .map((scenario, index) => ({ ...scenario, id: `BDD-${String(index + 1).padStart(3, "0")}` }));

  const result = {
    feature: context.feature,
    story: context.story,
    inferred,
    coverage: buildCoverageNotes(context, scenarios),
    scenarios,
    gherkin: "",
    markdown: ""
  };
  result.gherkin = renderGherkin(result);
  result.markdown = renderMarkdown(result);
  return result;
}

function mergeInferredContext(request: GenerateBddScenariosRequest, inferred: InferredBddContext): GenerateBddScenariosRequest {
  return {
    ...request,
    feature: request.feature ?? inferred.feature,
    story: request.story ?? inferred.story,
    acceptanceCriteria: mergeLists(request.acceptanceCriteria, inferred.acceptanceCriteria),
    risks: mergeLists(request.risks, inferred.risks),
    roles: mergeLists(request.roles, inferred.roles),
    platforms: mergeLists(request.platforms, inferred.platforms),
    businessCriticality: request.businessCriticality ?? inferred.businessCriticality,
    changeRisk: request.changeRisk ?? inferred.changeRisk,
    dataSensitivity: request.dataSensitivity ?? inferred.dataSensitivity,
    format: request.format ?? inferred.format
  };
}

function mergeLists(explicit: string[] | undefined, inferred: string[]): string[] | undefined {
  return explicit && explicit.length > 0 ? explicit : inferred;
}

function normalizeRequest(request: GenerateBddScenariosRequest): Required<Omit<GenerateBddScenariosRequest, "inputDocument" | "story" | "format" | "maxScenarios">> & Pick<GenerateBddScenariosRequest, "story" | "format" | "maxScenarios"> {
  return {
    feature: request.feature?.trim() ?? "",
    story: request.story?.trim(),
    acceptanceCriteria: cleanList(request.acceptanceCriteria),
    risks: cleanList(request.risks),
    roles: cleanList(request.roles).length > 0 ? cleanList(request.roles) : ["user"],
    platforms: cleanList(request.platforms).length > 0 ? cleanList(request.platforms) : ["android", "ios"],
    businessCriticality: request.businessCriticality ?? "medium",
    changeRisk: request.changeRisk ?? "medium",
    dataSensitivity: request.dataSensitivity ?? "medium",
    includeAccessibility: request.includeAccessibility ?? true,
    includeNegative: request.includeNegative ?? true,
    maxScenarios: request.maxScenarios,
    format: request.format ?? "markdown"
  };
}

export function inferBddContext(document: string | undefined): InferredBddContext {
  if (!document?.trim()) {
    return {
      acceptanceCriteria: [],
      risks: [],
      roles: [],
      platforms: []
    };
  }

  const lines = document.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const sections = collectSections(lines);
  const text = document.toLowerCase();
  const story = findStory(lines);

  return {
    feature: findFeature(lines, sections),
    story,
    acceptanceCriteria: inferListFromSections(sections, ["acceptance criteria", "criteria", "requirements", "expected behavior", "success criteria"], document),
    risks: inferRisks(sections, lines),
    roles: inferRoles(document, story),
    platforms: inferPlatforms(text),
    businessCriticality: inferBusinessCriticality(text),
    changeRisk: inferChangeRisk(text),
    dataSensitivity: inferDataSensitivity(text),
    format: inferFormat(text)
  };
}

function collectSections(lines: string[]): Map<string, string[]> {
  const sections = new Map<string, string[]>();
  let current = "summary";
  sections.set(current, []);

  for (const line of lines) {
    const heading = parseHeading(line);
    if (heading) {
      current = heading;
      sections.set(current, []);
      continue;
    }
    sections.get(current)?.push(cleanBullet(line));
  }

  return sections;
}

function parseHeading(line: string): string | undefined {
  const markdown = line.match(/^#{1,6}\s+(.+)$/);
  const colon = line.match(/^([A-Za-z][A-Za-z\s/()-]{2,40}):$/);
  const raw = markdown?.[1] ?? colon?.[1];
  return raw?.trim().toLowerCase();
}

function cleanBullet(line: string): string {
  return line.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim();
}

function findFeature(lines: string[], sections: Map<string, string[]>): string | undefined {
  const explicit = lines.find((line) => /^feature\s*:/i.test(line))?.replace(/^feature\s*:/i, "").trim();
  if (explicit) {
    return explicit;
  }
  const title = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, "").trim();
  if (title) {
    return title;
  }
  return firstUseful(sections.get("summary"));
}

function findStory(lines: string[]): string | undefined {
  return lines.find((line) => /^as an?\s+/i.test(cleanBullet(line)) || /^as a\s+/i.test(cleanBullet(line)))?.replace(/^story\s*:/i, "").trim();
}

function inferListFromSections(sections: Map<string, string[]>, names: string[], document: string): string[] {
  const sectionEntries = [...sections.entries()];
  const matched = sectionEntries
    .filter(([name]) => names.some((candidate) => name.includes(candidate)))
    .flatMap(([, values]) => values)
    .map(cleanRequirement)
    .filter(Boolean);
  if (matched.length > 0) {
    return unique(matched);
  }

  return unique([...document.matchAll(/\b(?:must|should|shall|can|allows?|supports?|validates?)\b[^.\n]+/gi)]
    .map((match) => cleanRequirement(match[0]))
    .filter(Boolean)
    .slice(0, 8));
}

function inferRisks(sections: Map<string, string[]>, lines: string[]): string[] {
  const sectionRisks = [...sections.entries()]
    .filter(([name]) => name.includes("risk") || name.includes("failure") || name.includes("edge case"))
    .flatMap(([, values]) => values)
    .map(cleanRequirement)
    .filter(Boolean);
  const inlineRisks = lines
    .map(cleanBullet)
    .filter((line) => /\b(risk|failure|fails|error|fraud|timeout|duplicate|security|privacy|loss|crash|offline)\b/i.test(line))
    .map(cleanRequirement);
  return unique([...sectionRisks, ...inlineRisks]).slice(0, 8);
}

function inferRoles(document: string, story: string | undefined): string[] {
  const roleText = story ?? document;
  const roles = [...roleText.matchAll(/\bas an?\s+([^,.\n]+)|\bas a\s+([^,.\n]+)/gi)]
    .map((match) => (match[1] ?? match[2] ?? "").trim())
    .filter(Boolean);
  return unique(roles);
}

function inferPlatforms(text: string): string[] {
  const platforms: string[] = [];
  if (/\bandroid\b/.test(text)) {
    platforms.push("android");
  }
  if (/\bios\b|\biphone\b|\bipad\b/.test(text)) {
    platforms.push("ios");
  }
  if (/\bmobile\b/.test(text) && platforms.length === 0) {
    platforms.push("android", "ios");
  }
  return platforms;
}

function inferBusinessCriticality(text: string): "low" | "medium" | "high" | undefined {
  if (/\b(p0|critical|revenue|payment|checkout|legal|compliance|production|must not fail|high business)\b/.test(text)) {
    return "high";
  }
  if (/\b(p2|low priority|nice to have|cosmetic|minor)\b/.test(text)) {
    return "low";
  }
  if (/\b(p1|important|customer impact|business critical|medium business)\b/.test(text)) {
    return "medium";
  }
  return undefined;
}

function inferChangeRisk(text: string): "low" | "medium" | "high" | undefined {
  if (/\b(migration|refactor|new flow|major change|complex|integration|payment gateway|auth|authentication)\b/.test(text)) {
    return "high";
  }
  if (/\b(copy change|content only|low change|small tweak|cosmetic)\b/.test(text)) {
    return "low";
  }
  if (/\b(update|change|enhancement|new field)\b/.test(text)) {
    return "medium";
  }
  return undefined;
}

function inferDataSensitivity(text: string): "low" | "medium" | "high" | undefined {
  if (/\b(pii|personal data|password|token|payment|card|bank|ssn|health|medical|privacy)\b/.test(text)) {
    return "high";
  }
  if (/\b(email|phone|address|profile)\b/.test(text)) {
    return "medium";
  }
  if (new RegExp("\\b(public|anonymous|no personal data)\\b").test(text)) {
    return "low";
  }
  return undefined;
}

function inferFormat(text: string): "json" | "gherkin" | "markdown" | undefined {
  if (/\bformat\s*:\s*json\b|\bjson output\b/.test(text)) {
    return "json";
  }
  if (/\bformat\s*:\s*gherkin\b|\bgherkin\b|\bfeature file\b/.test(text)) {
    return "gherkin";
  }
  if (/\bformat\s*:\s*markdown\b|\bmarkdown\b/.test(text)) {
    return "markdown";
  }
  return undefined;
}

function cleanRequirement(value: string): string {
  return value.replace(/^(acceptance criteria|criteria|risk|requirement)\s*:\s*/i, "").trim();
}

function firstUseful(values: string[] | undefined): string | undefined {
  return values?.find((value) => value.length > 2 && value.length < 120);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function cleanList(values: string[] | undefined): string[] {
  return [...new Set((values ?? []).map((value) => value.trim()).filter(Boolean))];
}

function calculateRiskScore(request: ReturnType<typeof normalizeRequest>): number {
  return scoreLevel(request.businessCriticality) + scoreLevel(request.changeRisk) + scoreLevel(request.dataSensitivity) + Math.min(request.risks.length, 3);
}

function scoreLevel(value: "low" | "medium" | "high"): number {
  return value === "high" ? 3 : value === "medium" ? 2 : 1;
}

function buildScenarioSeeds(request: ReturnType<typeof normalizeRequest>): ScenarioSeed[] {
  const primaryRole = request.roles[0] ?? "user";
  const criteria = request.acceptanceCriteria.length > 0
    ? request.acceptanceCriteria
    : [`${primaryRole} can complete ${request.feature}`];
  const explicitRisks = request.risks.length > 0 ? request.risks : [`Incorrect ${request.feature} behavior impacts the user journey`];

  const seeds: ScenarioSeed[] = criteria.map((criterion) => ({
    title: criterion,
    type: "happy-path",
    riskBoost: 2,
    priorityBoost: 3,
    rationale: "Validates an explicit acceptance criterion through the highest-value user path.",
    given: [`${primaryRole} is eligible to use ${request.feature}`, "the app is installed and reachable"],
    when: [criterionToAction(criterion, request.feature)],
    then: [criterionToOutcome(criterion), "the result is visible and persisted where applicable"],
    testData: ["representative valid account", "nominal network conditions"],
    traceability: [criterion]
  }));

  if (request.includeNegative) {
    seeds.push(...explicitRisks.slice(0, 4).map((risk) => ({
      title: `${request.feature} handles ${risk.toLowerCase()}`,
      type: "negative" as const,
      riskBoost: 3,
      priorityBoost: 2,
      rationale: "Risk-based negative coverage prevents high-impact failures from being hidden by happy-path tests.",
      given: [`${primaryRole} is using ${request.feature}`, `a risk condition exists: ${risk}`],
      when: [`${primaryRole} attempts to continue through ${request.feature}`],
      then: ["a clear recovery path or validation message is shown", "no partial or corrupt state is saved"],
      testData: ["invalid input", "missing required data", "interrupted connection"],
      traceability: [risk]
    })));
  }

  seeds.push({
    title: `${request.feature} validates boundary input values`,
    type: "boundary",
    riskBoost: 2,
    priorityBoost: 1,
    rationale: "Boundary tests catch off-by-one, formatting, and validation defects around accepted limits.",
    given: [`${primaryRole} is entering data for ${request.feature}`],
    when: ["minimum, maximum, empty, duplicate, and unusually long values are submitted"],
    then: ["valid boundary values are accepted", "invalid boundary values are rejected with actionable feedback"],
    testData: ["minimum valid value", "maximum valid value", "empty value", "duplicate value", "long unicode-like value"],
    traceability: ["boundary value analysis"]
  });

  seeds.push({
    title: `${request.feature} remains stable after repeated use`,
    type: "regression",
    riskBoost: 1,
    priorityBoost: 1,
    rationale: "Regression coverage checks idempotency, state cleanup, and repeat-use reliability.",
    given: [`${primaryRole} has already completed ${request.feature} once`],
    when: [`${primaryRole} repeats, cancels, and retries ${request.feature}`],
    then: ["state remains consistent", "duplicate records or actions are not created"],
    testData: ["existing user state", "fresh user state"],
    traceability: ["regression"]
  });

  if (request.includeAccessibility) {
    seeds.push({
      title: `${request.feature} is accessible to assistive technology users`,
      type: "accessibility",
      riskBoost: request.businessCriticality === "high" ? 2 : 1,
      priorityBoost: 1,
      rationale: "Accessibility coverage verifies labels, focus order, error announcement, and usable alternatives.",
      given: [`${primaryRole} uses screen reader or keyboard-like navigation`],
      when: [`${primaryRole} navigates and completes ${request.feature}`],
      then: ["interactive controls have meaningful accessible names", "focus order is logical", "errors are announced and actionable"],
      testData: ["screen reader enabled", "large text enabled"],
      traceability: ["accessibility"]
    });
  }

  seeds.push(...request.platforms.map((platform) => ({
    title: `${request.feature} behaves consistently on ${platform}`,
    type: "platform" as const,
    riskBoost: 1,
    priorityBoost: 0,
    rationale: "Platform coverage catches device-specific permissions, navigation, keyboard, and rendering differences.",
    given: [`${primaryRole} is on ${platform}`],
    when: [`${primaryRole} completes the primary ${request.feature} flow`],
    then: ["the same business outcome is achieved", "platform-specific UI conventions still work"],
    testData: [`${platform} device or simulator`, "supported OS version"],
    traceability: [platform]
  })));

  return seeds;
}

function toScenario(
  seed: ScenarioSeed,
  index: number,
  baseRiskScore: number,
  request: ReturnType<typeof normalizeRequest>
): BddScenario {
  const scenarioRiskScore = baseRiskScore + seed.riskBoost;
  const priorityScore = scenarioRiskScore + seed.priorityBoost;
  const priority: BddPriority = priorityScore >= 10 ? "P0" : priorityScore >= 8 ? "P1" : priorityScore >= 6 ? "P2" : "P3";
  const risk = scenarioRiskScore >= 9 ? "high" : scenarioRiskScore >= 6 ? "medium" : "low";

  return {
    id: `BDD-${String(index).padStart(3, "0")}`,
    title: seed.title,
    priority,
    risk,
    type: seed.type,
    tags: [
      `@${priority.toLowerCase()}`,
      `@risk-${risk}`,
      `@${seed.type}`,
      ...request.platforms.map((platform) => `@${sanitizeTag(platform)}`)
    ],
    rationale: seed.rationale,
    given: seed.given,
    when: seed.when,
    then: seed.then,
    testData: seed.testData,
    traceability: seed.traceability ?? []
  };
}

function compareScenarios(left: BddScenario, right: BddScenario): number {
  const priority = priorityRank(left.priority) - priorityRank(right.priority);
  if (priority !== 0) {
    return priority;
  }
  return riskRank(right.risk) - riskRank(left.risk);
}

function priorityRank(priority: BddPriority): number {
  return { P0: 0, P1: 1, P2: 2, P3: 3 }[priority];
}

function riskRank(risk: BddScenario["risk"]): number {
  return { high: 3, medium: 2, low: 1 }[risk];
}

function criterionToAction(criterion: string, feature: string): string {
  const lower = criterion.toLowerCase();
  if (lower.startsWith("given ") || lower.startsWith("when ") || lower.startsWith("then ")) {
    return criterion;
  }
  return `the user performs the behavior: ${criterion || feature}`;
}

function criterionToOutcome(criterion: string): string {
  return criterion.toLowerCase().includes("error") || criterion.toLowerCase().includes("invalid")
    ? "the expected validation behavior is shown"
    : "the acceptance criterion is satisfied";
}

function buildCoverageNotes(request: ReturnType<typeof normalizeRequest>, scenarios: BddScenario[]): string[] {
  return [
    `Prioritized by business criticality=${request.businessCriticality}, change risk=${request.changeRisk}, data sensitivity=${request.dataSensitivity}.`,
    "Includes happy path, negative, boundary, regression, accessibility, and platform coverage where enabled.",
    "Each scenario includes traceability, risk tags, priority tags, and test data guidance.",
    `Generated ${scenarios.length} scenario(s) for ${request.platforms.join(", ")}.`
  ];
}

export function renderGherkin(result: Pick<GenerateBddScenariosResult, "feature" | "story" | "scenarios">): string {
  const lines = [`Feature: ${result.feature}`];
  if (result.story) {
    lines.push(`  ${result.story}`);
  }

  for (const scenario of result.scenarios) {
    lines.push("", `  ${scenario.tags.join(" ")}`, `  Scenario: ${scenario.id} ${scenario.title}`);
    appendSteps(lines, "Given", scenario.given);
    appendSteps(lines, "When", scenario.when);
    appendSteps(lines, "Then", scenario.then);
  }

  return `${lines.join("\n")}\n`;
}

function appendSteps(lines: string[], keyword: "Given" | "When" | "Then", steps: string[]): void {
  steps.forEach((step, index) => {
    lines.push(`    ${index === 0 ? keyword : "And"} ${step}`);
  });
}

export function renderMarkdown(result: Pick<GenerateBddScenariosResult, "feature" | "story" | "coverage" | "scenarios" | "gherkin">): string {
  const lines = [`# ${result.feature}`, ""];
  if (result.story) {
    lines.push(result.story, "");
  }
  lines.push("## Coverage Strategy", "");
  lines.push(...result.coverage.map((note) => `- ${note}`), "", "## Scenario Inventory", "");
  for (const scenario of result.scenarios) {
    lines.push(`- ${scenario.id} [${scenario.priority}, ${scenario.risk} risk] ${scenario.title}`);
  }
  lines.push("", "## Gherkin", "", "```gherkin", result.gherkin.trimEnd(), "```", "");
  return lines.join("\n");
}

function sanitizeTag(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "platform";
}
