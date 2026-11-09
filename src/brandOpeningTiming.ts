/**
 * Deliberate opening pace on native devices, without slowing web navigation
 * unnecessarily. Accessibility users bypass the decorative delay.
 */
export const BRAND_OPENING_NATIVE_MS = 2600;
export const BRAND_OPENING_WEB_MS = 1200;
export const BRAND_OPENING_FADE_MS = 420;

export function brandOpeningHoldMs(platform: string, reducedMotion: boolean): number {
  if (reducedMotion) return 0;
  return platform === "web" ? BRAND_OPENING_WEB_MS : BRAND_OPENING_NATIVE_MS;
}
