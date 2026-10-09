// Shared appearance tokens. Dark colors preserve the light design's lavender identity.
export type AppearanceMode = "light" | "dark";
type ColorRole = "background" | "foreground" | "border" | "tint" | "shadow";
let activeMode: AppearanceMode = "light";

export function setActiveAppearance(mode: AppearanceMode) { activeMode = mode; }
export function activeAppearance() { return activeMode; }

export const darkPalette: Record<string, string> = {
  ink: "#F6F0FF", muted: "#BFB5D0", purple: "#CFA6F8",
  deep: "#C2A0EB", lavender: "#30273F", paper: "#14121F",
  line: "#44384F", rose: "#FFA4B9", redBg: "#39232F",
  green: "#74DDB2", white: "#FFFFFF",
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
function isRose(r: number, g: number, b: number) { return r > g * 1.16 && r > b * 1.1; }
function isGreen(r: number, g: number, b: number) { return g > r * 1.17 && g > b * 1.08; }
function isPurple(r: number, g: number, b: number) { return b > g * 1.09 && r > g * 1.08; }

/** Semantic mapping for existing legacy inline colors. No colors change in light mode. */
export function appearanceColor(source: string, role: ColorRole = "foreground") {
  if (activeMode !== "dark") return source;
  const p = parseHex(source);
  if (!p) return source;
  const { r, g, b, alpha, brightness: v } = p;
  const result = (() => {
    if (role === "shadow") return "#000000";
    if (role === "border") {
      if (isRose(r, g, b) && v < 0.8) return "#815067";
      return v > 0.70 ? "#463A55" : "#66517C";
    }
    if (role === "foreground") {
      // Keep original white labels on filled actions white, not charcoal.
      if (v > 0.86) return "#FFFFFF";
      if (isRose(r, g, b) && v < 0.70) return "#FF9DB8";
      if (isGreen(r, g, b) && v < 0.70) return "#79E0B6";
      if (isPurple(r, g, b) && v < 0.73) return "#CDA5F6";
      return v < 0.34 ? "#F5F0FF" : "#C4B9D2";
    }
    if (role === "tint" && v > 0.90) return "#332943";
    if (v > 0.96) return "#25202F";
    if (v > 0.84) {
      if (isRose(r, g, b)) return "#402734";
      if (isGreen(r, g, b)) return "#21382F";
      return "#30273E";
    }
    if (v > 0.65) return "#383047";
    if (isRose(r, g, b)) return "#803F59";
    if (isGreen(r, g, b)) return "#2D775D";
    if (isPurple(r, g, b)) return "#6C4391";
    return v < 0.27 ? "#302842" : "#493654";
  })();
  return withAlpha(result, alpha);
}

export const themeBackground = (value: string) => appearanceColor(value, "background");
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
