import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  activeAppearance, darkPalette, setActiveAppearance,
  themeAction, themeBackground, themeForeground, themedStyles,
} from "../src/themeColors.ts";

function luminance(color: string) {
  const rgb = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16) / 255);
  const linear = rgb.map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(left: string, right: string) {
  const a = luminance(left), b = luminance(right);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("light mode leaves the original care colors untouched", () => {
  setActiveAppearance("light");
  assert.equal(activeAppearance(), "light");
  assert.equal(themeBackground("#FFFFFF"), "#FFFFFF");
  assert.equal(themeForeground("#15113C"), "#15113C");
  assert.equal(themeAction("#74328F"), "#74328F");
});

test("dark mode has readable primary copy, muted copy and white action labels", () => {
  try {
    setActiveAppearance("dark");
    assert.ok(contrast(darkPalette.ink, darkPalette.paper) >= 7);
    assert.ok(contrast(darkPalette.muted, darkPalette.paper) >= 4.5);
    assert.ok(contrast("#FFFFFF", themeAction("#74328F")) >= 4.5);
    assert.notEqual(themeBackground("#FFFFFF"), "#FFFFFF");
    assert.equal(themeForeground("#FFFFFF"), "#FFFFFF");
  } finally {
    setActiveAppearance("light");
  }
});

test("legacy styles respond to theme changes and are never mutated", () => {
  setActiveAppearance("light");
  const original = { panel: { backgroundColor: "#FFFFFF", borderColor: "#EEE8F0", padding: 12 } };
  const styles = themedStyles(original);
  assert.deepEqual(styles.panel, original.panel);
  try {
    setActiveAppearance("dark");
    assert.notEqual(styles.panel.backgroundColor, "#FFFFFF");
    assert.notEqual(styles.panel.borderColor, "#EEE8F0");
    assert.equal(styles.panel.padding, 12);
    assert.equal(original.panel.backgroundColor, "#FFFFFF");
  } finally {
    setActiveAppearance("light");
  }
  assert.equal(styles.panel.backgroundColor, "#FFFFFF");
});

test("appearance is accessible from settings and subscribed across navigation", () => {
  const screen = readFileSync(new URL("../src/screens/AccessibilityScreen.tsx", import.meta.url), "utf8");
  const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const provider = readFileSync(new URL("../src/appearance.tsx", import.meta.url), "utf8");
  assert.match(screen, /accessibilityRole="radiogroup"/);
  assert.match(screen, /accessibilityLabel=\{isDarkPreview \? "Dark theme" : "Light theme"\}/);
  assert.match(screen, /setMode\(choice\)/);
  assert.match(app, /AppearanceProvider/);
  assert.match(app, /component=\{themedScreen\(/);
  assert.match(provider, /AsyncStorage\.setItem\(STORAGE_KEY, next\)/);
});
