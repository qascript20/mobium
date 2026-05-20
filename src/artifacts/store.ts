import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { MobiumConfig } from "../config.js";

export type Artifact = {
  path: string;
  reportPath: string;
  kind: "annotation" | "screenshot" | "snapshot" | "snapshot-diff" | "source";
};

let artifactSequence = 0;

export async function createArtifactPath(
  config: MobiumConfig,
  sessionName: string,
  kind: Artifact["kind"],
  extension: string,
  appKey = sessionName
): Promise<Artifact> {
  const directory = join(process.cwd(), config.artifacts.outputDir, sanitizeKey(appKey), "sessions", sanitizeKey(sessionName));
  await mkdir(directory, { recursive: true });

  const sequence = artifactSequence++;
  const path = join(directory, `${Date.now()}-${sequence}-${kind}.${extension}`);
  return { path, reportPath: reportPath(config, sessionName, appKey), kind };
}

export async function writeArtifact(
  config: MobiumConfig,
  sessionName: string,
  kind: Artifact["kind"],
  extension: string,
  content: string | Buffer,
  appKey?: string
): Promise<Artifact> {
  const artifact = await createArtifactPath(config, sessionName, kind, extension, appKey);
  await writeFile(artifact.path, content);
  await updateHtmlReport(config, sessionName, appKey);
  return artifact;
}

export async function updateHtmlReport(
  config: MobiumConfig,
  sessionName: string,
  appKey = sessionName
): Promise<string> {
  const directory = sessionDirectory(config, sessionName, appKey);
  await mkdir(directory, { recursive: true });

  const entries = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name !== "index.html")
    .map((entry) => entry.name)
    .filter(isReportableArtifact)
    .sort();
  const html = await renderHtmlReport(directory, entries, sanitizeKey(appKey), sanitizeKey(sessionName));
  const path = reportPath(config, sessionName, appKey);
  await writeFile(path, html);
  return path;
}

function sessionDirectory(config: MobiumConfig, sessionName: string, appKey: string): string {
  return join(process.cwd(), config.artifacts.outputDir, sanitizeKey(appKey), "sessions", sanitizeKey(sessionName));
}

function reportPath(config: MobiumConfig, sessionName: string, appKey: string): string {
  return join(sessionDirectory(config, sessionName, appKey), "index.html");
}

function isReportableArtifact(name: string): boolean {
  return [".json", ".xml", ".png", ".svg"].includes(extname(name).toLowerCase());
}

async function renderHtmlReport(directory: string, entries: string[], appKey: string, sessionName: string): Promise<string> {
  const cards = await Promise.all(entries.map((entry) => renderArtifactCard(directory, entry)));
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Mobium Report - ${escapeHtml(appKey)} / ${escapeHtml(sessionName)}</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #111827; background: #f8fafc; }
    header { padding: 24px; background: #0f172a; color: #f8fafc; }
    main { max-width: 1120px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { margin: 0; color: #cbd5e1; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
    .card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
    .card h2 { margin: 0; padding: 12px 14px; font-size: 14px; border-bottom: 1px solid #e5e7eb; word-break: break-word; }
    .body { padding: 14px; }
    img { display: block; max-width: 100%; height: auto; border: 1px solid #e5e7eb; background: #ffffff; }
    pre { margin: 0; max-height: 360px; overflow: auto; white-space: pre-wrap; word-break: break-word; font-size: 12px; line-height: 1.45; }
    a { color: #2563eb; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .empty { color: #475569; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
  </style>
</head>
<body>
  <header>
    <h1>Mobium Report</h1>
    <p>${escapeHtml(appKey)} / ${escapeHtml(sessionName)} - generated ${escapeHtml(new Date().toISOString())}</p>
  </header>
  <main>
    ${cards.length > 0 ? `<section class="grid">${cards.join("\n")}</section>` : `<div class="empty">No artifacts saved yet.</div>`}
  </main>
</body>
</html>
`;
}

async function renderArtifactCard(directory: string, entry: string): Promise<string> {
  const extension = extname(entry).toLowerCase();
  const label = escapeHtml(entry);
  const href = escapeHtml(basename(entry));
  const body = extension === ".png" || extension === ".svg"
    ? `<a href="${href}"><img src="${href}" alt="${label}"></a>`
    : `<pre>${escapeHtml(await readTextPreview(join(directory, entry)))}</pre>`;

  return `<article class="card">
  <h2><a href="${href}">${label}</a></h2>
  <div class="body">${body}</div>
</article>`;
}

async function readTextPreview(path: string): Promise<string> {
  const content = await readFile(path, "utf8");
  return content.length > 20_000 ? `${content.slice(0, 20_000)}\n... truncated ...` : content;
}

function sanitizeKey(value: string): string {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "unknown-app";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
