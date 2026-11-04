import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  hasHtmlFallback,
  isJavascriptContentType,
  resolveLocalScriptUrl,
} from "../scripts/liveSmokeHelpers.mjs";

test("release smoke verifies only script references from the deployment origin", () => {
  const origin = "https://envizion-life-caregiver.onrender.com/";
  assert.equal(
    resolveLocalScriptUrl("/_expo/static/js/web/index-abcd1234.js", origin),
    "https://envizion-life-caregiver.onrender.com/_expo/static/js/web/index-abcd1234.js",
  );
  assert.throws(() => resolveLocalScriptUrl("https://other.example/steal.js", origin), /outside/);
  assert.throws(() => resolveLocalScriptUrl("/index.html", origin), /unexpected script asset type/);
});

test("HTTP 200 HTML or JSON must never pass as a production JavaScript bundle", () => {
  for (const type of [
    "application/javascript",
    "text/javascript; charset=UTF-8",
    "application/ecmascript",
    "text/ecmascript",
  ]) assert.equal(isJavascriptContentType(type), true, type);

  for (const type of [
    "text/html; charset=utf-8", "application/json", "", "text/plain", null,
  ]) assert.equal(isJavascriptContentType(type), false, String(type));

  assert.equal(hasHtmlFallback("<!doctype html><html><body>App shell</body></html>"), true);
  assert.equal(hasHtmlFallback("  <html lang='en'>App</html>"), true);
  assert.equal(hasHtmlFallback("<head><title>Offline</title></head>"), true);
  assert.equal(hasHtmlFallback("(()=>{console.log('real bundle')})()"), false);
});

test("live release smoke checks MIME, redirect origin and HTML fallback after HTTP success", () => {
  const source = readFileSync(new URL("../scripts/live-smoke.mjs",import.meta.url),"utf8");
  assert.match(source, /resolveLocalScriptUrl\(source, response\.url\)/);
  assert.match(source, /isJavascriptContentType\(asset\.headers\.get\("content-type"\)\)/);
  assert.match(source, /hasHtmlFallback\(body\.toString/);
  assert.match(source, /new URL\(asset\.url\)\.origin !== new URL\(response\.url\)\.origin/);
  assert.match(source, /signal: AbortSignal\.timeout\(30000\)/);
  assert.match(source, /if \(!asset\.ok\) fail/);
});
