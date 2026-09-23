import type {
  CoverageForecastResolution,
  CoverageForecastResolutionState,
} from "./careCoverageForecastResolution";

export function forecastResolutionStateLabel(
  state: CoverageForecastResolutionState,
) {
  if (state === "resolved") return "Coverage secured";
  if (state === "in_progress") return "Resolution in progress";
  if (state === "improved") return "Options improved";
  if (state === "expired") return "Window ended";
  return "Still needs attention";
}

export function forecastResolutionTypeLabel(type: string | null) {
  if (type === "scheduled_shift") return "Scheduled caregiver shift";
  if (type === "open_coverage_filled") return "Open Coverage filled";
  if (type === "planned_assignment") return "Planned weekly assignment";
  if (type === "open_coverage") return "Open Coverage active";
  if (type === "availability_improved") return "Caregiver availability improved";
  if (type === "window_ended") return "Care window ended";
  return "No recorded resolution yet";
}

export function forecastResolutionCounts(
  rows: CoverageForecastResolution[],
) {
  return rows.reduce(
    (counts, row) => {
      counts.total += 1;
      counts[row.currentState] += 1;
      return counts;
    },
    {
      total: 0,
      active: 0,
      improved: 0,
      in_progress: 0,
      resolved: 0,
      expired: 0,
    },
  );
}
