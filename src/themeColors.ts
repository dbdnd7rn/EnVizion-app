// Shared appearance tokens. Dark colors preserve the light design's lavender identity.
export type AppearanceMode = "light" | "dark";
type ColorRole = "background" | "foreground" | "border" | "tint" | "shadow";
let activeMode: AppearanceMode = "light";

export function setActiveAppearance(mode: AppearanceMode) { activeMode = mode; }
export function activeAppearance() { return activeMode; }

export const darkPalette: Record<string, string> = {
  ink: "#E0D9E8", muted: "#ACA3BB", purple: "#CBA6E7",
  deep: "#C5A4DF", lavender: "#30293C", paper: "#191720",
  line: "#403749", rose: "#F0A5B7", redBg: "#35242E",
  green: "#86D6B4", white: "#EFE9F4",
};

function parseHex(source: string) {
  if (!/^#[0-9a-f]{3,4}([0-9a-f]{3,4})?$/i.test(source)) return null;
  const h = source.slice(1);
  const full = h.length === 3 || h.length === 4
    ? h.split("").map((x) => x + x).join("") : h;
  const rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  const alpha = full.length === 8 ? full.slice(6) : "";
  return { r: rgb[0], g: rgb[1], b: rgb[2], alpha, brightness:
    (rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722) / 255 };
}

function withAlpha(hex: string, suffix: string) { return suffix ? hex + suffix : hex; }
// Recognize both saturated accents and pastel status surfaces. In particular,
// very pale pink/green cards must not collapse into the default purple surface.
function isRose(r: number, g: number, b: number) {
  return (r > g * 1.16 && r > b * 1.1) ||
    (r - g >= 12 && r - b >= 7 && b >= g) ||
    // Coral/salmon warning backgrounds have a little more green than blue.
    (r - g >= 12 && g - b >= 2 && g - b <= 12 && r - b >= 16);
}
function isGreen(r: number, g: number, b: number) {
  return (g > r * 1.17 && g > b * 1.08) ||
    (g - r >= 8 && g - b >= 4 && b >= r);
}
function isBlue(r: number, g: number, b: number) {
  return b - r >= 12 && b - g >= 7 && g >= r + 4;
}
function isAmber(r: number, g: number, b: number) {
  return r - b >= 12 && g - b >= 5 && r >= g * 1.02;
}
function isPurple(r: number, g: number, b: number) { return b > g * 1.09 && r > g * 1.08; }

/** Semantic mapping for existing legacy inline colors. No colors change in light mode. */
export function appearanceColor(source: string, role: ColorRole = "foreground") {
  if (activeMode !== "dark") return source;
  // Legacy translucent white glass surfaces used rgba() rather than hex.
  // Recolor the bright ones as well; keep dark overlays and shadow rgba intact.
  const rgba = source.match(/^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?|\.\d+))?\s*\)$/i);
  if (rgba) {
    const channels = rgba.slice(1, 4).map(Number);
    if (channels.some((c) => c > 255)) return source;
    const brightness = (channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722) / 255;
    if (brightness < 0.7 || role === "shadow") return source;
    const hex = "#" + channels.map((c) => c.toString(16).padStart(2, "0")).join("");
    const mapped = appearanceColor(hex, role);
    const changed = parseHex(mapped);
    if (!changed) return source;
    return `rgba(${changed.r}, ${changed.g}, ${changed.b}, ${rgba[4] ?? "1"})`;
  }
  const p = parseHex(source);
  if (!p) return source;
  const { r, g, b, alpha, brightness: v } = p;
  const result = (() => {
    if (role === "shadow") return "#000000";
    if (role === "border") {
      if (isRose(r, g, b)) return "#704457";
      if (isGreen(r, g, b)) return "#3F6B57";
      if (isBlue(r, g, b)) return "#48627D";
      if (isAmber(r, g, b)) return "#705B41";
      return v > 0.70 ? "#44394D" : "#584769";
    }
    if (role === "foreground") {
      // Soft ivory on actions prevents pure-white glare but still meets AA.
      if (isRose(r, g, b)) return "#EFA6B8";
      if (isGreen(r, g, b)) return "#89D6B5";
      if (isBlue(r, g, b)) return "#A3CAFA";
      if (isAmber(r, g, b)) return "#F1CD8D";
      if (v > 0.86) return "#EFE9F4";
      if (isPurple(r, g, b) && v < 0.73) return "#CBA6E7";
      return v < 0.34 ? "#E0D9E8" : v < 0.60 ? "#B9B1C6" : "#ACA4BB";
    }
    if (role === "tint" && v > 0.90) return "#302839";
    // Almost-white status tints still carry meaning; only neutral whites use the base surface.
    if (v > 0.96 && !isRose(r, g, b) && !isGreen(r, g, b) && !isBlue(r, g, b) && !isAmber(r, g, b)) return "#25212E";
    if (v > 0.84) {
      if (isRose(r, g, b)) return "#35262F";
      if (isGreen(r, g, b)) return "#25372F";
      if (isBlue(r, g, b)) return "#253449";
      if (isAmber(r, g, b)) return "#3D3328";
      return "#2D2739";
    }
    if (v > 0.65) {
      if (isBlue(r, g, b)) return "#2A3B51";
      if (isAmber(r, g, b)) return "#44382B";
      return "#332C40";
    }
    if (isRose(r, g, b)) return "#6C3D53";
    if (isGreen(r, g, b)) return "#2C6F58";
    if (isBlue(r, g, b)) return "#31587D";
    if (isAmber(r, g, b)) return "#755A35";
    if (isPurple(r, g, b)) return "#65418A";
    return v < 0.27 ? "#292334" : "#3B3049";
  })();
  return withAlpha(result, alpha);
}

/**
 * Small icon wells and decorative highlights need a visible separation from
 * dark cards. Never let a pastel icon background remain almost white.
 * This helper is deliberately for surfaces, not text or brand-filled buttons.
 */
export function themeIconSurface(source: string) {
  if (activeMode !== "dark") return source;
  const parsed = parseHex(source);
  if (!parsed) return appearanceColor(source, "background");
  const { r, g, b, alpha } = parsed;
  const color = isRose(r, g, b) ? "#4A2E3D"
    : isGreen(r, g, b) ? "#294638"
    : isBlue(r, g, b) ? "#303D59"
    : isAmber(r, g, b) ? "#45382D"
    : "#40324F";
  return withAlpha(color, alpha);
}

/**
 * Preserve authored SVG artwork colors in both appearance modes.
 * UI backgrounds should use themeBackground/themeIconSurface instead.
 * Illustrations contain skin, clothing, faces, books and other semantic art
 * layers that must not be remapped as if each were a card background.
 */
export function artworkColor(source: string) { return source; }

/**
 * Large illustration backdrop shapes may be quieter in dark mode, while
 * foreground artwork retains its original colors and tonal separation.
 */
export function artworkBackdrop(light: string, dark: string) {
  return activeMode === "dark" ? dark : light;
}

/**
 * Convert colors supplied to React Native View/Card backgrounds. Unlike text
 * or authored illustration colors, even a palette-proxied C.white becomes a
 * charcoal surface in dark mode. Saturated action fills remain vivid.
 * Use at the boundary of reusable components that receive a light tile color.
 */
export function themeSurface(source: string) {
  if (activeMode !== "dark") return source;
  const parsed = parseHex(source);
  if (parsed && parsed.brightness < 0.66) return source;
  return appearanceColor(source, "background");
}

export const themeBackground = (value: string) => appearanceColor(value, "background");
/** Filled primary actions stay deep enough for white labels in dark mode. */
export const themeAction = (value: string) => activeMode === "dark" ? "#774A9F" : value;
export const themeForeground = (value: string) => appearanceColor(value, "foreground");
export const themeBorder = (value: string) => appearanceColor(value, "border");
export const themeTint = (value: string) => appearanceColor(value, "tint");
export const themeShadow = (value: string) => appearanceColor(value, "shadow");

/** Reads theme values on access instead of freezing them at module-import time. */
export function createPalette<T extends Record<string, string>>(light: T): T {
  return new Proxy(light, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (activeMode !== "dark" || typeof prop !== "string" || typeof value !== "string") return value;
      if (darkPalette[prop]) return darkPalette[prop];
      return appearanceColor(value, prop.toLowerCase().includes("bg") ? "background" : "foreground");
    },
  });
}

const colorKeys: Record<string, ColorRole> = {
  color: "foreground", tintColor: "foreground", backgroundColor: "background",
  borderColor: "border", borderTopColor: "border", borderBottomColor: "border",
  borderLeftColor: "border", borderRightColor: "border",
  shadowColor: "shadow", textDecorationColor: "foreground",
  overlayColor: "background", selectionColor: "foreground",
};
function recolor(value: any): any {
  if (Array.isArray(value)) return value.map(recolor);
  if (!value || typeof value !== "object") return value;
  const result: Record<string, any> = {};
  for (const [key, v] of Object.entries(value)) {
    result[key] = typeof v === "string" && colorKeys[key]
      ? appearanceColor(v, colorKeys[key])
      : typeof v === "object" ? recolor(v) : v;
  }
  return result;
}
/** Makes existing StyleSheet objects respond to theme changes without remounting screens. */
export function themedStyles<T extends Record<string, any>>(styles: T): T {
  return new Proxy(styles, {
    get(target, key, receiver) {
      const value = Reflect.get(target, key, receiver);
      return activeMode === "dark" ? recolor(value) : value;
    },
  });
}
