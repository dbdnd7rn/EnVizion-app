import type { CoverageGapPattern } from "./careCoverageInsights";
import type { CareCoverageRequirementOccurrence } from "./careCoverageRequirements";
import type { SmartCoverageNeed } from "./smartCoveragePlannerHelpers";

export type CoverageForecastRisk = "high" | "elevated" | "watch" | "stable";

export type CoverageForecastItem = {
  id: string;
  sourceId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  risk: CoverageForecastRisk;
  assignableCount: number;
  unspecifiedCount: number;
  conflictCount: number;
  historicalGapCount: number;
  recommendedCaregiverName: string | null;
  reasons: string[];
};

const weekdayNumbers: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

function time(value: string) {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

function localPatternKey(value: string, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(value));

    const weekday = weekdayNumbers[
      parts.find((part) => part.type === "weekday")?.value ?? ""
    ];
    const hour = Number(parts.find((part) => part.type === "hour")?.value);

    if (!weekday || !Number.isFinite(hour)) return null;
    return { weekdayIso: weekday, localHour: hour };
  } catch {
    return null;
  }
}

function occurrenceForNeed(
  need: SmartCoverageNeed,
  occurrences: CareCoverageRequirementOccurrence[],
) {
  const needStart = time(need.startsAt);
  return (
    occurrences.find((occurrence) => {
      if (occurrence.requirementId !== need.sourceId) return false;
      const start = time(occurrence.startsAt);
      const end = time(occurrence.endsAt);
      return start <= needStart && needStart < end;
    }) ?? null
  );
}

function riskRank(risk: CoverageForecastRisk) {
  if (risk === "high") return 0;
  if (risk === "elevated") return 1;
  if (risk === "watch") return 2;
  return 3;
}

export function buildCoverageForecast(input: {
  needs: SmartCoverageNeed[];
  occurrences: CareCoverageRequirementOccurrence[];
  gapPatterns: CoverageGapPattern[];
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return input.needs
    .filter(
      (need) =>
        need.source === "coverage_requirement" &&
        need.exactWindow &&
        time(need.endsAt) > now.getTime(),
    )
    .map((need): CoverageForecastItem => {
      const assignable = need.candidates.filter(
        (candidate) => candidate.assignable,
      );
      const unspecifiedCount = need.candidates.filter(
        (candidate) =>
          !candidate.declined && candidate.fit === "unspecified",
      ).length;
      const conflictCount = need.candidates.filter(
        (candidate) =>
          candidate.declined ||
          candidate.fit === "scheduled_conflict" ||
          candidate.fit === "unavailable_conflict",
      ).length;

      const occurrence = occurrenceForNeed(need, input.occurrences);
      const key = occurrence
        ? localPatternKey(need.startsAt, occurrence.timezone)
        : null;
      const historicalGapCount = key
        ? input.gapPatterns.find(
            (pattern) =>
              pattern.weekdayIso === key.weekdayIso &&
              pattern.localHour === key.localHour,
          )?.gapCount ?? 0
        : 0;

      let risk: CoverageForecastRisk = "stable";
      if (assignable.length === 0) risk = "high";
      else if (assignable.length === 1 || historicalGapCount >= 3) {
        risk = "elevated";
      } else if (historicalGapCount > 0 || unspecifiedCount > 0) {
        risk = "watch";
      }

      const reasons: string[] = [];
      if (assignable.length === 0) {
        reasons.push(
          "No caregiver currently has recorded Preferred or Available time for this entire uncovered segment.",
        );
      } else if (assignable.length === 1) {
        reasons.push(
          "Only one caregiver currently has recorded availability for this entire segment.",
        );
      } else {
        reasons.push(
          assignable.length +
            " caregivers currently have recorded availability for this segment.",
        );
      }

      if (historicalGapCount > 0) {
        reasons.push(
          "This weekday/time entered Open Coverage " +
            historicalGapCount +
            (historicalGapCount === 1 ? " time" : " times") +
            " in the recent coverage history.",
        );
      }

      if (unspecifiedCount > 0) {
        reasons.push(
          unspecifiedCount +
            (unspecifiedCount === 1
              ? " caregiver has"
              : " caregivers have") +
            " no availability recorded for the full window.",
        );
      }

      if (conflictCount > 0) {
        reasons.push(
          conflictCount +
            (conflictCount === 1 ? " caregiver is" : " caregivers are") +
            " blocked by a decline, unavailable period, or overlapping shift.",
        );
      }

      return {
        id: need.id,
        sourceId: need.sourceId,
        label: need.label,
        startsAt: need.startsAt,
        endsAt: need.endsAt,
        risk,
        assignableCount: assignable.length,
        unspecifiedCount,
        conflictCount,
        historicalGapCount,
        recommendedCaregiverName: assignable[0]?.displayName ?? null,
        reasons,
      };
    })
    .sort((a, b) => {
      const riskDifference = riskRank(a.risk) - riskRank(b.risk);
      if (riskDifference) return riskDifference;
      return time(a.startsAt) - time(b.startsAt);
    });
}

export function coverageForecastCounts(items: CoverageForecastItem[]) {
  return items.reduce(
    (counts, item) => {
      counts.total += 1;
      counts[item.risk] += 1;
      return counts;
    },
    { total: 0, high: 0, elevated: 0, watch: 0, stable: 0 },
  );
}

export function coverageForecastRiskLabel(risk: CoverageForecastRisk) {
  if (risk === "high") return "High attention";
  if (risk === "elevated") return "Elevated";
  if (risk === "watch") return "Watch";
  return "Stable options";
}
