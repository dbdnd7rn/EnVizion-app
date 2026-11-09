import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const config = JSON.parse(
  fs.readFileSync("security/advisory-exceptions.json", "utf8"),
);

const today = new Date().toISOString().slice(0, 10);
const exceptions = new Map(
  (config.exceptions ?? []).map((item) => [String(item.id), item]),
);

for (const item of exceptions.values()) {
  if (!item.expiresOn || item.expiresOn < today) {
    console.error(
      `Security exception ${item.id} is expired or missing an expiry date.`,
    );
    process.exit(1);
  }
}

// Windows cannot execute npm.cmd with shell-free spawnSync. Invoke npm's JS
// entry point through Node instead; keep shell interpolation out of this gate.
const npmCli = process.env.npm_execpath || (process.platform === "win32"
  ? path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js")
  : null);
const auditArgs = ["audit", "--json", "--audit-level=moderate"];
const result = spawnSync(
  npmCli ? process.execPath : "npm",
  npmCli ? [npmCli, ...auditArgs] : auditArgs,
  {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  },
);

if (result.error) throw result.error;

let report;
try {
  report = JSON.parse(result.stdout || "{}");
} catch {
  console.error(result.stdout);
  console.error(result.stderr);
  throw new Error("npm audit did not return valid JSON.");
}

// A registry/network error or empty report must never look like a clean audit.
if (![0, 1].includes(result.status) || report.error ||
    report.auditReportVersion !== 2 || !report.vulnerabilities ||
    typeof report.vulnerabilities !== "object" || Array.isArray(report.vulnerabilities) ||
    !Number.isInteger(report.metadata?.vulnerabilities?.total)) {
  console.error("npm audit failed or returned an incomplete report; dependency safety is unverified.");
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities;

function advisoryId(value) {
  const text = [value?.url, value?.name, value?.title]
    .filter(Boolean)
    .join(" ");
  return [...exceptions.keys()].find((id) => text.includes(id)) ?? null;
}

function collectAdvisoryIds(name, trail = new Set()) {
  if (trail.has(name)) return new Set();

  const vulnerability = vulnerabilities[name];
  if (!vulnerability) return new Set();

  const nextTrail = new Set(trail);
  nextTrail.add(name);
  const ids = new Set();

  for (const entry of Array.isArray(vulnerability.via) ? vulnerability.via : []) {
    if (typeof entry === "string") {
      for (const id of collectAdvisoryIds(entry, nextTrail)) ids.add(id);
      continue;
    }

    const id = advisoryId(entry);
    if (id) {
      ids.add(id);
      continue;
    }

    const externalId =
      [entry?.url, entry?.name, entry?.title]
        .filter(Boolean)
        .join(" ")
        .match(/GHSA-[a-z0-9-]+/i)?.[0] ?? "UNIDENTIFIED-ADVISORY";
    ids.add(externalId);
  }

  return ids;
}

function vulnerabilityIsExcepted(name) {
  const ids = collectAdvisoryIds(name);
  return ids.size > 0 && [...ids].every((id) => exceptions.has(id));
}

const unapproved = Object.keys(vulnerabilities).filter(
  (name) => !vulnerabilityIsExcepted(name),
);

const activeExceptions = [...exceptions.values()].filter((item) =>
  Object.values(vulnerabilities).some((vulnerability) =>
    (vulnerability.via ?? []).some(
      (entry) =>
        typeof entry !== "string" &&
        [entry?.url, entry?.name, entry?.title]
          .filter(Boolean)
          .join(" ")
          .includes(item.id),
    ),
  ),
);

if (activeExceptions.length) {
  console.warn("Known temporary security exceptions:");
  for (const item of activeExceptions) {
    console.warn(
      `- ${item.id} (${item.package}, ${item.severity}) expires ${item.expiresOn}: ${item.reason}`,
    );
  }
}

if (unapproved.length) {
  console.error("\nUnapproved npm audit vulnerabilities remain:");
  for (const name of unapproved) {
    const vulnerability = vulnerabilities[name];
    const ids = [...collectAdvisoryIds(name)];
    console.error(
      `- ${name}: ${vulnerability.severity ?? "unknown"} · ${String(
        vulnerability.range ?? "",
      )} · advisory IDs: ${ids.join(", ") || "unidentified"}`,
    );
  }
  process.exit(1);
}

const total = report.metadata?.vulnerabilities?.total ?? 0;
if (total > 0) {
  console.warn(
    `npm audit reported ${total} vulnerable dependency paths, all traced to explicitly reviewed, unpatched advisories above.`,
  );
} else {
  console.log("npm audit reports no vulnerabilities at moderate severity or above.");
}
