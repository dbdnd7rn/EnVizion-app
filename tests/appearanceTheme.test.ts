import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  activeAppearance, appearanceColor, darkPalette, setActiveAppearance,
  themeAction, themeBackground, themeForeground, themeIconSurface, themeSurface, themedStyles, artworkColor, artworkBackdrop,
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

test("dark mode has readable low-glare copy and soft ivory action labels", () => {
  try {
    setActiveAppearance("dark");
    assert.ok(contrast(darkPalette.ink, darkPalette.paper) >= 7);
    assert.ok(contrast(darkPalette.muted, darkPalette.paper) >= 4.5);
    assert.ok(contrast(themeForeground("#FFFFFF"), themeAction("#74328F")) >= 4.5);
    assert.notEqual(themeBackground("#FFFFFF"), "#FFFFFF");
    assert.notEqual(themeForeground("#FFFFFF"), "#FFFFFF");
    assert.ok(contrast(themeForeground("#FFFFFF"), themeBackground("#FFFFFF")) >= 7);
    assert.equal(appearanceColor("rgba(255, 255, 255, 0.85)", "background"), "rgba(37, 33, 46, 0.85)");
    assert.equal(appearanceColor("rgba(0, 0, 0, 0.45)", "background"), "rgba(0, 0, 0, 0.45)");
  } finally {
    setActiveAppearance("light");
  }
});

test("dark mode preserves informative, warning, success, and urgent status colors", () => {
  try {
    setActiveAppearance("dark");
    const examples = [
      { lightText: "#C34A67", lightBg: "#FFF0F1", darkBg: "#35262F" },
      { lightText: "#24986E", lightBg: "#E6F8EF", darkBg: "#25372F" },
      { lightText: "#2763AC", lightBg: "#E2E6FF", darkBg: "#253449" },
      { lightText: "#C78B25", lightBg: "#FFF4E6", darkBg: "#3D3328" },
    ];
    const surfaces = examples.map(({ lightText, lightBg, darkBg }) => {
      const surface = themeBackground(lightBg);
      assert.equal(surface, darkBg);
      assert.ok(contrast(themeForeground(lightText), surface) >= 4.5);
      return surface;
    });
    assert.equal(themeBackground("#FBE8E3"), "#35262F");
    assert.equal(themeBackground("#FFF1EC"), "#35262F");
    assert.equal(themeBackground("#ECF6F0"), "#25372F");
    assert.equal(new Set(surfaces).size, surfaces.length);
    assert.equal(themeBackground("#FFFFFFD4"), "#25212ED4");
  } finally {
    setActiveAppearance("light");
  }
});

test("dark quick actions, topic icons, and care-team badges never use near-white surfaces", () => {
  setActiveAppearance("light");
  assert.equal(themeIconSurface("#F1E5FA"), "#F1E5FA");
  assert.equal(themeBackground("#FFF1F5"), "#FFF1F5");
  try {
    setActiveAppearance("dark");
    const surfaces = [
      themeBackground("#F6F0FB"),
      themeBackground("#FFF1F5"),
      themeBackground("#FFFFFFE8").slice(0, 7),
      themeIconSurface("#F1E5FA"),
      themeIconSurface("#FFE4EC"),
      themeIconSurface("#E9EEFF"),
      themeIconSurface("#E4F3EC"),
    ];
    for (const background of surfaces) {
      assert.ok(luminance(background) < 0.13, `Unexpected bright dark-mode surface: ${background}`);
    }
    assert.notEqual(themeIconSurface("#F1E5FA"), themeIconSurface("#FFE4EC"));
    assert.notEqual(themeIconSurface("#E9EEFF"), themeIconSurface("#E4F3EC"));
    assert.ok(contrast(themeForeground("#70338F"), themeIconSurface("#F1E5FA")) >= 4.5);
    assert.ok(contrast(themeForeground("#15966B"), themeIconSurface("#E4F3EC")) >= 4.5);
  } finally {
    setActiveAppearance("light");
  }
});

test("reported pale card regressions are routed through dark-mode tokens", () => {
  const home = readFileSync(new URL("../src/screens/MainScreens.tsx", import.meta.url), "utf8");
  const team = readFileSync(new URL("../src/screens/CareTeamScreen.tsx", import.meta.url), "utf8");
  const schedule = readFileSync(new URL("../src/screens/CareScheduleDesign.tsx", import.meta.url), "utf8");
  assert.match(home, /backgroundColor: themeBackground\(background\)/);
  assert.match(home, /backgroundColor: themeIconSurface\(iconBackground\)/);
  assert.match(home, /backgroundColor: themeIconSurface\(item\.bg\)/);
  assert.match(team, /backgroundColor:themeIconSurface\(tint\)/);
  assert.match(team, /backgroundColor:themeIconSurface\(active\?/);
  assert.match(schedule, /backgroundColor: themeBackground\(tint\)/);
  assert.match(schedule, /const glass = \(\) =>/);
});

test("dark appearance preserves SVG paint colors without restoring pale UI cards", () => {
  setActiveAppearance("light");
  assert.equal(artworkColor("#F0C8B5"), "#F0C8B5");
  assert.equal(artworkBackdrop("#F7F1FC", "#3D2D50"), "#F7F1FC");
  try {
    setActiveAppearance("dark");
    for (const color of ["#F0C8B5", "#EDC0AC", "#51375F", "#75408F", "#FFFFFF", "#C7AFE3"]) {
      assert.equal(artworkColor(color), color, `Artwork must retain authored paint ${color}`);
    }
    assert.equal(artworkBackdrop("#F7F1FC", "#3D2D50"), "#3D2D50");
    assert.ok(contrast(artworkColor("#F0C8B5"), artworkColor("#51375F")) >= 5);
    assert.ok(contrast(artworkColor("#F0C8B5"), artworkBackdrop("#F7F1FC", "#3D2D50")) >= 5);
    assert.equal(themeBackground("#FFFFFF"), "#25212E");
    assert.equal(themeIconSurface("#F1E5FA"), "#40324F");
  } finally {
    setActiveAppearance("light");
  }
});

test("hero and shared SVG artwork use artwork colors, not UI background tint", () => {
  const files = [
    "screens/CareScreens.tsx", "screens/CarePlanScreen.tsx",
    "screens/CareCalendarScreen.tsx", "screens/CareShiftBoardScreen.tsx",
    "screens/HospitalToHomeScreen.tsx", "screens/SupportScreens.tsx",
    "components/SpiritualLandscapeArt.tsx",
    "components/OnboardingWelcomeStep.tsx", "ui.tsx",
  ];
  for (const file of files) {
    const content = readFileSync(new URL("../src/" + file, import.meta.url), "utf8");
    assert.match(content, /artworkColor\(/, file);
    assert.doesNotMatch(content, /themeTint\(/, file);
  }
  const home = readFileSync(new URL("../src/screens/MainScreens.tsx", import.meta.url), "utf8");
  const reader = home.split("function LearnHeroGraphic()")[1]?.split("function LearnFeaturedGraphic()")[0] ?? "";
  assert.match(reader, /artworkColor\("#F0C8B5"\)/);
  assert.doesNotMatch(reader, /themeTint\(/);
  for (const [path, begin, end] of [
    ["screens/CareAnalyticsScreen.tsx", "function CalendarGraphic(", "function formatWeekLabel("],
    ["screens/MedicationManagementScreen.tsx", "function MedicationHeroGraphic()", "function FloatingMedicationHero("],
    ["screens/SummaryScreen.tsx", "function FolderGraphic()", "function FloatingFolder("],
  ]) {
    const content = readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
    const artwork = content.split(begin)[1]?.split(end)[0] ?? "";
    assert.match(artwork, /artworkColor\(/, path);
    assert.doesNotMatch(artwork, /themeTint\(/, path);
  }
  assert.match(reader, /artworkColor\("#7A45A0"\)/);
  assert.match(reader, /artworkBackdrop\("#F7F1FC", "#3D2D50"\)/);
  const patient = readFileSync(new URL("../src/screens/PatientExperience.tsx", import.meta.url), "utf8");
  assert.match(patient, /backgroundColor: themeTint\(tint\)/);
  assert.match(patient, /fill=\{artworkColor\(accent\)\}/);
});

test("dark surfaces dim the previously white emergency, clinical, family and admin tiles", () => {
  setActiveAppearance("light");
  const original = ["#FCFAFF", "#F4ECFF", "#EEF7FF", "#FFF0F4", "#EEF9F5", "#FFF9F2", "#EFE9F4"];
  for (const color of original) assert.equal(themeSurface(color), color);
  try {
    setActiveAppearance("dark");
    for (const color of original) {
      const surface = themeSurface(color);
      assert.ok(luminance(surface) < 0.13, `Pale background leaked into dark mode: ${color} => ${surface}`);
    }
    assert.notEqual(themeSurface("#F4ECFF"), themeSurface("#EEF7FF"));
    assert.notEqual(themeSurface("#EEF7FF"), themeSurface("#EEF9F5"));
    assert.notEqual(themeSurface("#EEF9F5"), themeSurface("#FFF9F2"));
    assert.ok(contrast(themeForeground("#7D35B5"), themeSurface("#FCFAFF")) >= 4.5);
    assert.ok(contrast(themeForeground("#238ED0"), themeSurface("#EEF7FF")) >= 4.5);
    assert.equal(themeSurface("#7B35A8"), "#7B35A8", "Saturated actions keep their paint");
    assert.equal(artworkColor("#FFFFFF"), "#FFFFFF", "Illustrations stay independent of UI surfaces");
    assert.equal(themeSurface("rgba(255,255,255,0.8)"), "rgba(37, 33, 46, 0.8)");
  } finally {
    setActiveAppearance("light");
  }
});

test("emergency center contact/profile tiles convert dynamic backgrounds and icon colors", () => {
  const source = readFileSync(new URL("../src/screens/EmergencyCenterScreen.tsx", import.meta.url), "utf8");
  assert.equal((source.match(/backgroundColor: themeSurface\(background\)/g) ?? []).length, 3);
  assert.match(source, /backgroundColor: themeIconSurface\(background\)/);
  assert.match(source, /backgroundColor: themeIconSurface\(bg\)/);
  assert.match(source, /color=\{themeForeground\(accent\)\}/);
  for (const label of ["Add primary contact", "Care team", "Family", "Medication & transition"]) {
    assert.ok(source.includes(label), `Keep emergency action ${label}`);
  }
});

test("screen backgrounds never use direct opaque pastel literals", () => {
  const directory = new URL("../src/screens/", import.meta.url);
  const failures: string[] = [];
  for (const name of readdirSync(directory).filter(file => file.endsWith(".tsx"))) {
    const content = readFileSync(new URL(name, directory), "utf8");
    const hexMatches = content.matchAll(/backgroundColor\s*:\s*["'](#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?)["']/g);
    for (const match of hexMatches) {
      const value = match[1];
      const alpha = value.length === 9 ? parseInt(value.slice(7), 16) / 255 : 1;
      if (alpha > 0.3 && luminance(value.slice(0, 7)) > 0.66)
        failures.push(`${name}: ${value}`);
    }
    const rgbaMatches = content.matchAll(/backgroundColor\s*:\s*["']rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(0?\.\d+|1(?:\.0+)?)\s*\)["']/g);
    for (const match of rgbaMatches) {
      const rgb = match.slice(1,4).map(Number);
      const brightness = (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) / 255;
      if (Number(match[4]) > 0.3 && brightness > 0.7)
        failures.push(`${name}: ${match[0]}`);
    }
  }
  assert.deepEqual(failures, [], "Bright unthemed screen backgrounds should be routed through themeSurface");
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
