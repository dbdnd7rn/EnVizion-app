import { spawnSync } from "node:child_process";
import fs from "node:fs";

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

const result = spawnSync(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["audit", "--json", "--audit-level=moderate"],
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

const vulnerabilities = report.vulnerabilities ?? {};
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
    console.error(
      `- ${name}: ${vulnerability.severity ?? "unknown"} · ${String(
        vulnerability.range ?? "",
      )}`,
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
