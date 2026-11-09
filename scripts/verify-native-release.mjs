#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  inspectNativeReleaseConfiguration,
  validateNativeBuildEnvironment,
} from "./nativeReleasePreflight.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = name => JSON.parse(readFileSync(path.join(projectRoot, name), "utf8"));
const app = readJson("app.json");
const eas = readJson("eas.json");
const pkg = readJson("package.json");
const advisory = readJson("security/advisory-exceptions.json");
const report = inspectNativeReleaseConfiguration({
  app,
  eas,
  pkg,
  advisory,
  exists: asset => {
    if (typeof asset !== "string" || !asset.startsWith("./")) return false;
    const resolved = path.resolve(projectRoot, asset);
    return resolved.startsWith(projectRoot + path.sep) && existsSync(resolved);
  },
});

if (process.argv.includes("--require-env")) {
  report.errors.push(...validateNativeBuildEnvironment(process.env));
}
if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log("EnVizion Life native release preflight");
  console.log("Version:", report.configuration.appVersion,
    "iOS:", report.configuration.iosBundleId,
    "Android:", report.configuration.androidPackage);
  console.log("\nConfiguration errors (" + report.errors.length + "):");
  for (const problem of report.errors) console.error("  ERROR:", problem);
  console.log("\nRelease warnings (" + report.warnings.length + "):");
  for (const warning of report.warnings) console.warn("  WARNING:", warning);
  console.log("\nHuman approval / physical-device checks (" + report.manual.length + "):");
  for (const task of report.manual) console.log("  PENDING:", task);
  console.log("\nPreflight:", report.errors.length ? "FAILED" : "CONFIGURATION PASSED");
  console.log("This does not create an installable app or authorize a pilot/store release.");
}
if (report.errors.length) process.exitCode = 1;
