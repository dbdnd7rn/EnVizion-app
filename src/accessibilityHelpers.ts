export const MINIMUM_TOUCH_TARGET = 44;

export function fontScaleLabel(scale: number) {
  if (!Number.isFinite(scale) || scale <= 0) return "System text size unavailable";
  if (scale >= 1.5) return "Large system text";
  if (scale > 1.05) return "Larger system text";
  if (scale < 0.95) return "Smaller system text";
  return "Standard system text";
}

export function accessibilityReadiness(input: {
  fontScale: number;
  reduceMotion: boolean;
  screenReader: boolean;
}) {
  return {
    fontScaleLabel: fontScaleLabel(input.fontScale),
    respectsReduceMotion: true,
    screenReaderActive: input.screenReader,
    minimumTouchTarget: MINIMUM_TOUCH_TARGET,
  };
}
