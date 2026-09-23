import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import { loadCareCoverageRequests } from "../careCoverageRequests";
import {
  loadCareCoverageRequirementOccurrences,
  type CareCoverageRequirementOccurrence,
} from "../careCoverageRequirements";
import { loadCoverageOperationalInsights } from "../careCoverageInsights";
import {
  buildCoverageForecast,
  coverageForecastCounts,
  coverageForecastRiskLabel,
  type CoverageForecastRisk,
} from "../careCoverageForecastHelpers";
import {
  coverageForecastWindowKey,
  loadCoverageForecastSnoozes,
  snoozeCoverageForecastWindow,
  unsnoozeCoverageForecastWindow,
  type CoverageForecastSnooze,
} from "../careCoverageForecastAlerts";
import { loadCareSchedule } from "../careSchedule";
import { loadCareTeam } from "../careTeam";
import { buildSmartCoveragePlan } from "../smartCoveragePlannerHelpers";
import { useCare } from "../store";
import {
  Button,
  C,
  Card,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";

type Props = NativeStackScreenProps<RootStack, "CoverageForecast">;

function riskBackground(risk: CoverageForecastRisk) {
  if (risk === "high") return C.redBg;
  if (risk === "elevated") return "#FFF1E5";
  if (risk === "watch") return C.lavender;
  return "#EAF4EF";
}

function riskColor(risk: CoverageForecastRisk) {
  if (risk === "high") return C.rose;
  if (risk === "elevated") return "#A65F20";
  if (risk === "watch") return C.purple;
  return "#2D7656";
}

function riskIcon(risk: CoverageForecastRisk) {
  if (risk === "high") return "warning-outline";
  if (risk === "elevated") return "alert-circle-outline";
  if (risk === "watch") return "eye-outline";
  return "shield-checkmark-outline";
}

export function CoverageForecastScreen({ navigation }: Props) {
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const owner = state.accessRole === "owner";

  const [horizonDays, setHorizonDays] = useState(14);
  const [occurrences, setOccurrences] = useState<
    CareCoverageRequirementOccurrence[]
  >([]);
  const [planNeeds, setPlanNeeds] = useState<
    ReturnType<typeof buildSmartCoveragePlan>
  >([]);
  const [gapPatterns, setGapPatterns] = useState<
    Awaited<ReturnType<typeof loadCoverageOperationalInsights>>["gapPatterns"]
  >([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [snoozes, setSnoozes] = useState<CoverageForecastSnooze[]>([]);
  const [busySnoozeKey, setBusySnoozeKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId || !owner) {
      setPlanNeeds([]);
      setOccurrences([]);
      setGapPatterns([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const now = new Date();
      const end = new Date(
        now.getTime() + (horizonDays + 1) * 24 * 60 * 60_000,
      );

      const [
        coverage,
        schedule,
        team,
        requirementRows,
        history,
        snoozeRows,
      ] = await Promise.all([
          loadCareCoverageRequests(careRecipientId),
          loadCareSchedule(careRecipientId),
          loadCareTeam(careRecipientId),
          loadCareCoverageRequirementOccurrences({
            careRecipientId,
            startsAt: now.toISOString(),
            endsAt: end.toISOString(),
          }),
          loadCoverageOperationalInsights(careRecipientId, 180),
          loadCoverageForecastSnoozes(careRecipientId),
        ]);

      const needs = buildSmartCoveragePlan({
        requests: coverage.requests,
        responses: coverage.responses,
        requirementOccurrences: requirementRows,
        tasks: [],
        members: team.members,
        availability: schedule.availability,
        recurringAvailability: schedule.recurringAvailability,
        shifts: schedule.shifts,
        now,
        horizonDays,
      });

      setPlanNeeds(needs);
      setOccurrences(requirementRows);
      setGapPatterns(history.gapPatterns);
      setSnoozes(snoozeRows);
      setGeneratedAt(new Date().toISOString());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not calculate the coverage forecast.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, horizonDays, owner]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const forecast = useMemo(
    () =>
      buildCoverageForecast({
        needs: planNeeds,
        occurrences,
        gapPatterns,
      }),
    [gapPatterns, occurrences, planNeeds],
  );
  const counts = useMemo(() => coverageForecastCounts(forecast), [forecast]);
  const snoozeMap = useMemo(
    () =>
      new Map(
        snoozes.map((snooze) => [
          coverageForecastWindowKey(
            snooze.requirementId,
            snooze.startsAt,
            snooze.endsAt,
          ),
          snooze,
        ]),
      ),
    [snoozes],
  );

  async function snoozeWindow(
    item: (typeof forecast)[number],
    hours: 6 | 24 | 72,
  ) {
    if (!careRecipientId) return;

    const key = coverageForecastWindowKey(
      item.sourceId,
      item.startsAt,
      item.endsAt,
    );
    setBusySnoozeKey(key);
    setMessage("");

    try {
      const snoozedUntil = await snoozeCoverageForecastWindow({
        careRecipientId,
        requirementId: item.sourceId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        hours,
      });

      setSnoozes((current) => [
        ...current.filter(
          (entry) =>
            coverageForecastWindowKey(
              entry.requirementId,
              entry.startsAt,
              entry.endsAt,
            ) !== key,
        ),
        {
          requirementId: item.sourceId,
          startsAt: item.startsAt,
          endsAt: item.endsAt,
          snoozedUntil,
        },
      ]);
      setMessage(
        "Forecast alerts snoozed for this care window until " +
          new Date(snoozedUntil).toLocaleString() +
          ".",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not snooze this forecast window.",
      );
    } finally {
      setBusySnoozeKey(null);
    }
  }

  async function resumeWindow(item: (typeof forecast)[number]) {
    if (!careRecipientId) return;

    const key = coverageForecastWindowKey(
      item.sourceId,
      item.startsAt,
      item.endsAt,
    );
    setBusySnoozeKey(key);
    setMessage("");

    try {
      await unsnoozeCoverageForecastWindow({
        careRecipientId,
        requirementId: item.sourceId,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
      });

      setSnoozes((current) =>
        current.filter(
          (entry) =>
            coverageForecastWindowKey(
              entry.requirementId,
              entry.startsAt,
              entry.endsAt,
            ) !== key,
        ),
      );
      setMessage("Forecast alerts resumed for this care window.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not resume forecast alerts for this window.",
      );
    } finally {
      setBusySnoozeKey(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="COVERAGE FORECAST"
          title="Choose a care profile first."
          body="Coverage forecasting belongs to one shared care profile."
        />
      </Page>
    );
  }

  if (!owner) {
    return (
      <Page>
        <Heading
          eyebrow="COVERAGE FORECAST"
          title="Coverage forecasting is owner-only."
          body="The forecast combines future care requirements with team availability and historical coverage patterns."
        />
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="lock-closed-outline" color={C.purple} />
          <Text style={S.h3}>Protected planning view</Text>
          <Txt>
            Caregivers continue to manage their own availability and coverage
            responses without seeing another caregiver's planning history.
          </Txt>
        </Card>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="PROACTIVE COVERAGE FORECAST"
        title="Find future care windows that need attention before they become emergencies."
        body="EnVizion combines exact uncovered recurring-care segments, current caregiver availability, scheduled shifts, existing Open Coverage, and recent gap patterns. Forecast labels explain current planning risk; they do not rank caregivers."
      />

      <View style={{ flexDirection: "row", gap: 10 }}>
        {[7, 14, 21].map((days) => (
          <View key={days} style={{ flex: 1 }}>
            <Button
              title={days + " days"}
              secondary={horizonDays !== days}
              onPress={() => setHorizonDays(days)}
            />
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 115 }}>
          <Text style={S.eyebrow}>HIGH ATTENTION</Text>
          <Text style={S.h2}>{counts.high}</Text>
          <Txt style={S.small}>No assignable match</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 115 }}>
          <Text style={S.eyebrow}>ELEVATED</Text>
          <Text style={S.h2}>{counts.elevated}</Text>
          <Txt style={S.small}>Thin coverage options</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 115 }}>
          <Text style={S.eyebrow}>WATCH</Text>
          <Text style={S.h2}>{counts.watch}</Text>
          <Txt style={S.small}>History / availability</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 115 }}>
          <Text style={S.eyebrow}>STABLE</Text>
          <Text style={S.h2}>{counts.stable}</Text>
          <Txt style={S.small}>Multiple options</Txt>
        </Card>
      </View>

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <View style={S.row}>
          <Icon name="telescope-outline" color="#E5C8ED" size={27} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[S.h2, { color: C.white }]}>
              Forecasting is a planning signal, not an automatic decision.
            </Text>
            <Txt style={{ color: "#E9DDED" }}>
              Nothing is assigned automatically. Owners review the exact care
              window and decide whether to update availability, build the
              weekly plan, or confirm coverage.
            </Txt>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            title="Smart Coverage Planner"
            secondary
            icon="sparkles-outline"
            onPress={() => navigation.navigate("SmartCoveragePlanner")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            title="Caregiver availability"
            secondary
            icon="calendar-outline"
            onPress={() => navigation.navigate("CareSchedule")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            title="Weekly coverage"
            secondary
            icon="checkmark-done-outline"
            onPress={() => navigation.navigate("WeeklyCoveragePlan")}
          />
        </View>
        <View style={{ flex: 1, minWidth: 150 }}>
          <Button
            title="Forecast alert settings"
            secondary
            icon="notifications-outline"
            onPress={() => navigation.navigate("NotificationSettings")}
          />
        </View>
      </View>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Section title={"Forecast · next " + horizonDays + " days"} />

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Calculating future coverage pressure…</Txt>
        </Card>
      ) : !forecast.length ? (
        <Card style={{ backgroundColor: "#EAF4EF" }}>
          <Icon name="shield-checkmark-outline" color="#2D7656" />
          <Text style={S.h3}>No uncovered recurring-care segments forecast.</Text>
          <Txt>
            Current shifts and Open Coverage reservations account for the
            recurring care requirements in this forecast window.
          </Txt>
        </Card>
      ) : (
        forecast.map((item) => {
          const snoozeKey = coverageForecastWindowKey(
            item.sourceId,
            item.startsAt,
            item.endsAt,
          );
          const snooze = snoozeMap.get(snoozeKey) ?? null;
          const snoozeBusy = busySnoozeKey === snoozeKey;

          return (
          <Card key={item.id}>
            <View style={S.between}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.eyebrow}>FUTURE CARE WINDOW</Text>
                <Text style={S.h2}>{item.label}</Text>
                <Txt style={S.small}>
                  {new Date(item.startsAt).toLocaleString()} →{" "}
                  {new Date(item.endsAt).toLocaleString()}
                </Txt>
              </View>
              <View
                style={[
                  S.pill,
                  { backgroundColor: riskBackground(item.risk) },
                ]}
              >
                <View style={S.row}>
                  <Icon
                    name={riskIcon(item.risk)}
                    color={riskColor(item.risk)}
                    size={16}
                  />
                  <Text
                    style={[
                      S.small,
                      {
                        color: riskColor(item.risk),
                        fontFamily: "DMSans_600SemiBold",
                      },
                    ]}
                  >
                    {coverageForecastRiskLabel(item.risk)}
                  </Text>
                </View>
              </View>
            </View>

            {item.recommendedCaregiverName && (
              <Card style={{ backgroundColor: "#EAF4EF" }}>
                <Txt style={S.small}>CURRENT STRONGEST RECORDED OPTION</Txt>
                <Text style={S.h3}>{item.recommendedCaregiverName}</Text>
                <Txt style={S.small}>
                  {item.assignableCount} caregiver
                  {item.assignableCount === 1 ? "" : "s"} with Preferred or
                  Available time for the full uncovered segment.
                </Txt>
              </Card>
            )}

            {item.reasons.map((reason, index) => (
              <View key={index} style={S.row}>
                <Icon
                  name={
                    item.risk === "high"
                      ? "alert-circle-outline"
                      : "information-circle-outline"
                  }
                  color={riskColor(item.risk)}
                  size={17}
                />
                <Txt style={{ flex: 1 }}>{reason}</Txt>
              </View>
            ))}

            {(item.risk === "high" || item.risk === "elevated") && (
              <>
                {snooze ? (
                  <Card style={{ backgroundColor: C.lavender }}>
                    <View style={S.row}>
                      <Icon name="notifications-off-outline" color={C.purple} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={S.h3}>Alerts snoozed for this window</Text>
                        <Txt style={S.small}>
                          Resume automatically ·{" "}
                          {new Date(snooze.snoozedUntil).toLocaleString()}
                        </Txt>
                      </View>
                    </View>
                    <Button
                      title={snoozeBusy ? "Resuming alerts…" : "Resume alerts"}
                      secondary
                      disabled={snoozeBusy}
                      icon="notifications-outline"
                      onPress={() => void resumeWindow(item)}
                    />
                  </Card>
                ) : (
                  <Card style={{ backgroundColor: C.white }}>
                    <View style={S.row}>
                      <Icon name="moon-outline" color={C.purple} />
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={S.h3}>Snooze only this forecast window</Text>
                        <Txt style={S.small}>
                          Other forecast windows keep alerting normally.
                        </Txt>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                      {([6, 24, 72] as const).map((hours) => (
                        <View key={hours} style={{ flex: 1, minWidth: 110 }}>
                          <Button
                            title={"Snooze " + hours + "h"}
                            secondary
                            disabled={snoozeBusy}
                            onPress={() => void snoozeWindow(item, hours)}
                          />
                        </View>
                      ))}
                    </View>
                  </Card>
                )}

                <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <View style={{ flex: 1, minWidth: 145 }}>
                  <Button
                    title="Review availability"
                    secondary
                    onPress={() => navigation.navigate("CareSchedule")}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 145 }}>
                  <Button
                    title="Plan this coverage"
                    onPress={() => navigation.navigate("SmartCoveragePlanner")}
                  />
                </View>
              </View>
              </>
            )}
          </Card>
          );
        })
      )}

      {generatedAt && (
        <Txt style={S.small}>
          Forecast recalculated from live care data ·{" "}
          {new Date(generatedAt).toLocaleString()}
        </Txt>
      )}
    </Page>
  );
}
