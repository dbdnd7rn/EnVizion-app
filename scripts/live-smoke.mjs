import { hasHtmlFallback, isJavascriptContentType, resolveLocalScriptUrl } from "./liveSmokeHelpers.mjs";

const target =
  process.env.SMOKE_URL ||
  process.argv[2] ||
  "https://envizion-life-caregiver.onrender.com/";

function fail(message) {
  console.error("LIVE_SMOKE_FAIL:", message);
  process.exit(1);
}

const response = await fetch(target, {
  redirect: "follow",
  signal: AbortSignal.timeout(30000),
  headers: { "User-Agent": "EnVizion-Release-Smoke/1.0" },
});
if (!response.ok) fail(`Root returned HTTP ${response.status}.`);

const html = await response.text();
if (!/<html/i.test(html)) fail("Root response is not HTML.");

const scriptSources = [...html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi)]
  .map((match) => match[1])
  .filter(Boolean);

if (!scriptSources.length) fail("No JavaScript bundle was referenced.");

for (const source of scriptSources.slice(0, 3)) {
  let url;
  try {
    url = resolveLocalScriptUrl(source, response.url);
  } catch (error) {
    fail(error instanceof Error ? error.message : "Invalid script URL.");
  }
  const asset = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
    headers: { "User-Agent": "EnVizion-Release-Smoke/1.0" },
  });
  if (new URL(asset.url).origin !== new URL(response.url).origin) {
    fail(`Bundle ${url} redirected outside the application origin.`);
  }
  if (!asset.ok) fail(`Bundle ${url} returned HTTP ${asset.status}.`);
  if (!isJavascriptContentType(asset.headers.get("content-type"))) {
    fail(`Bundle ${url} returned a non-JavaScript content type; possible HTML fallback.`);
  }
  const body = Buffer.from(await asset.arrayBuffer());
  if (body.byteLength < 1_000) fail(`Bundle ${url} is unexpectedly small.`);
  if (hasHtmlFallback(body.toString("utf8", 0, 1024))) {
    fail(`Bundle ${url} contains an HTML fallback instead of JavaScript.`);
  }
}

console.log(
  JSON.stringify(
    {
      status: "ok",
      url: response.url,
      scriptsChecked: Math.min(3, scriptSources.length),
      htmlBytes: Buffer.byteLength(html),
    },
    null,
    2,
  ),
);
