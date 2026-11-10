import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const auditScript = fileURLToPath(new URL("../scripts/security-audit.mjs", import.meta.url));

function runAuditFixture(report: unknown, status = 0, exceptions: unknown[] = []) {
  const directory = mkdtempSync(path.join(os.tmpdir(), "envizion-audit-"));
  try {
    mkdirSync(path.join(directory, "security"));
    writeFileSync(path.join(directory, "security/advisory-exceptions.json"), JSON.stringify({ exceptions }));
    const npmCli = path.join(directory, "npm-cli.cjs");
    writeFileSync(npmCli, `
      require('node:assert/strict').deepEqual(process.argv.slice(2), ['audit', '--json', '--audit-level=moderate']);
      process.stdout.write(${JSON.stringify(JSON.stringify(report))});
      process.exit(${status});
    `);
    return spawnSync(process.execPath, [auditScript], {
      cwd: directory,
      env: { ...process.env, npm_execpath: npmCli },
      encoding: "utf8",
    });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const clean = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
const vulnerable = {
  auditReportVersion: 2,
  vulnerabilities: { example: { severity: "high", via: [{ url: "https://github.com/advisories/GHSA-test-test-test" }] } },
  metadata: { vulnerabilities: { total: 1 } },
};

test("audit invokes npm through Node and accepts a complete clean report", () => {
  const result = runAuditFixture(clean);
  assert.equal(result.status, 0, result.stderr);
});

test("audit fails closed on registry errors, empty reports and abnormal process exits", () => {
  for (const [report, status] of [[{}, 0], [{ error: { code: "ENETWORK" } }, 1], [clean, 2], [clean, 3]] as const) {
    const result = runAuditFixture(report, status);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /incomplete report/);
  }
});

test("audit still blocks unapproved advisories", () => {
  const result = runAuditFixture(vulnerable, 1);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unapproved npm audit vulnerabilities/);
});

test("audit accepts only an explicitly listed, unexpired advisory exception", () => {
  const result = runAuditFixture(vulnerable, 1, [{ id: "GHSA-test-test-test", expiresOn: "9999-12-31" }]);
  assert.equal(result.status, 0, result.stderr);
});

test("audit rejects expired exceptions even when the registry report is clean", () => {
  const result = runAuditFixture(clean, 0, [{ id: "GHSA-test-test-test", expiresOn: "2000-01-01" }]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /expired/);
});
