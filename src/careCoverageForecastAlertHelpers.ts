export type CoverageForecastAlertLevel = "high" | "elevated";

export function coverageForecastAlertLevelLabel(
  level: CoverageForecastAlertLevel,
) {
  return level === "high" ? "High only" : "High + Elevated";
}

export function coverageForecastHorizonLabel(days: number) {
  return days === 1 ? "1 day ahead" : days + " days ahead";
}
