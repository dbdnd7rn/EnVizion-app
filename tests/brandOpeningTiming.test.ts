import test from "node:test";
import assert from "node:assert/strict";
import {
  brandOpeningHoldMs,
  BRAND_OPENING_FADE_MS,
  BRAND_OPENING_NATIVE_MS,
  BRAND_OPENING_WEB_MS,
} from "../src/brandOpeningTiming.ts";

test("native app shows the branded opening long enough to enjoy it", () => {
  assert.equal(brandOpeningHoldMs("android", false), BRAND_OPENING_NATIVE_MS);
  assert.equal(brandOpeningHoldMs("ios", false), BRAND_OPENING_NATIVE_MS);
  assert.ok(BRAND_OPENING_NATIVE_MS >= 2200 && BRAND_OPENING_NATIVE_MS <= 3000);
});

test("web opener remains shorter than native opener", () => {
  assert.equal(brandOpeningHoldMs("web", false), BRAND_OPENING_WEB_MS);
  assert.ok(BRAND_OPENING_WEB_MS < BRAND_OPENING_NATIVE_MS);
});

test("reduced-motion setting removes the decorative opening delay", () => {
  for (const platform of ["android", "ios", "web"]) {
    assert.equal(brandOpeningHoldMs(platform, true), 0);
  }
});

test("fade duration stays short enough for a responsive transition", () => {
  assert.ok(BRAND_OPENING_FADE_MS > 0 && BRAND_OPENING_FADE_MS <= 500);
});
