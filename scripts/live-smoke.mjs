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
  const url = new URL(source, response.url).toString();
  const asset = await fetch(url, {
    redirect: "follow",
    headers: { "User-Agent": "EnVizion-Release-Smoke/1.0" },
  });
  if (!asset.ok) fail(`Bundle ${url} returned HTTP ${asset.status}.`);
  const body = await asset.arrayBuffer();
  if (body.byteLength < 1_000) fail(`Bundle ${url} is unexpectedly small.`);
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
