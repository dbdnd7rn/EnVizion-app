import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");
const indexPath = path.join(dist, "index.html");

function fail(message) {
  console.error("PRODUCTION_ARTIFACT_FAIL:", message);
  process.exit(1);
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

if (!fs.existsSync(indexPath)) fail("dist/index.html is missing.");

const html = fs.readFileSync(indexPath, "utf8");
if (!/<html/i.test(html)) fail("dist/index.html is not valid HTML.");
if (!/_expo\/static\/js\/web\//.test(html)) {
  fail("Expo web JavaScript bundle reference is missing.");
}
if (/localhost:\d+/i.test(html)) {
  fail("Production HTML contains a localhost origin.");
}

const files = walk(dist);
const jsFiles = files.filter((file) => file.endsWith(".js"));
if (!jsFiles.length) fail("No production JavaScript bundles were exported.");

const totalJsBytes = jsFiles.reduce(
  (total, file) => total + fs.statSync(file).size,
  0,
);
if (totalJsBytes < 100_000) {
  fail("Production JavaScript output is unexpectedly small.");
}

for (const file of [indexPath, ...jsFiles]) {
  const content = fs.readFileSync(file, "utf8");
  if (
    content.includes("SUPABASE_SERVICE_ROLE_KEY") ||
    content.includes("SERVICE_ROLE_KEY=")
  ) {
    fail(`Privileged server credential marker found in ${path.relative(root, file)}.`);
  }
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      index: path.relative(root, indexPath),
      jsBundles: jsFiles.length,
      totalJsBytes,
      files: files.length,
    },
    null,
    2,
  ),
);
