import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  assignCareCoverageRequest,
  loadCareCoverageRequests,
  type CareCoverageRequest,
  type CareCoverageRequestResponse,
} from "../careCoverageRequests";
import {
  loadCareCoverageRequirementOccurrences,
  scheduleCareCoverageRequirementGap,
  type CareCoverageRequirementOccurrence,
} from "../careCoverageRequirements";
import { coverageBackupFitLabel } from "../careCoverageMatchingHelpers";
import {
  loadCareSchedule,
  type CareShift,
  type CaregiverAvailability,
  type CaregiverAvailabilityRule,
} from "../careSchedule";
import { loadCareTasks, type CareTask } from "../careTasks";
import { loadCareTeam, type CareTeamRoster } from "../careTeam";
import {
  buildSmartCoveragePlan,
  smartCoveragePlanCounts,
  type SmartCoverageCandidate,
  type SmartCoverageNeed,
} from "../smartCoveragePlannerHelpers";
import { supabase } from "../supabase";
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
import { useNav } from "./MainScreens";

function fitBackground(fit: SmartCoverageCandidate["fit"]) {
  if (fit === "preferred") return "#EAF4EF";
  if (fit === "available") return C.lavender;
  if (fit === "scheduled_conflict" || fit === "unavailable_conflict") {
    return C.redBg;
  }
  return "#F1EDEF";
}

function fitAccent(fit: SmartCoverageCandidate["fit"]) {
  if (fit === "scheduled_conflict" || fit === "unavailable_conflict") {
    return C.rose;
  }
  if (fit === "preferred") return "#2D7656";
  return C.deep;
}

function needAccent(need: SmartCoverageNeed) {
  if (need.recommendedUserId) return "#2D7656";
  if (
    need.candidates.some(
      (candidate) =>
        !candidate.declined && candidate.fit === "unspecified",
    )
  ) {
    return "#A65F20";
  }
  return C.rose;
}

function needStatus(need: SmartCoverageNeed) {
  if (need.recommendedUserId) return "Suggested match ready";
  if (
    need.candidates.some(
      (candidate) =>
        !candidate.declined && candidate.fit === "unspecified",
    )
  ) {
    return "Needs availability review";
  }
  return "No eligible match recorded";
}

export function SmartCoveragePlannerScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const owner = state.accessRole === "owner";
  const viewer = state.accessRole === "viewer";

  const [requests, setRequests] = useState<CareCoverageRequest[]>([]);
  const [responses, setResponses] = useState<CareCoverageRequestResponse[]>([]);
  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [requirementOccurrences, setRequirementOccurrences] = useState<
    CareCoverageRequirementOccurrence[]
  >([]);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [availability, setAvailability] = useState<CaregiverAvailability[]>([]);
  const [recurringAvailability, setRecurringAvailability] = useState<
    CaregiverAvailabilityRule[]
  >([]);
  const [shifts, setShifts] = useState<CareShift[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [clock, setClock] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setRequests([]);
      setResponses([]);
      setTasks([]);
      setRequirementOccurrences([]);
      setRoster(null);
      setAvailability([]);
      setRecurringAvailability([]);
      setShifts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const occurrenceStart = new Date();
      const occurrenceEnd = new Date(
        occurrenceStart.getTime() + 8 * 24 * 60 * 60_000,
      );
      const [coverage, schedule, taskRows, team, occurrences] =
        await Promise.all([
          loadCareCoverageRequests(careRecipientId),
          loadCareSchedule(careRecipientId),
          loadCareTasks(careRecipientId),
          loadCareTeam(careRecipientId),
          loadCareCoverageRequirementOccurrences({
            careRecipientId,
            startsAt: occurrenceStart.toISOString(),
            endsAt: occurrenceEnd.toISOString(),
          }),
        ]);

      setRequests(coverage.requests);
      setResponses(coverage.responses);
      setTasks(taskRows);
      setRequirementOccurrences(occurrences);
      setRoster(team);
      setAvailability(schedule.availability);
      setRecurringAvailability(schedule.recurringAvailability);
      setShifts(schedule.shifts);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not build the coverage plan.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!careRecipientId) return;

    const tables = [
      "care_coverage_requests",
      "care_coverage_request_responses",
      "care_coverage_requirements",
      "caregiver_availability",
      "caregiver_availability_rules",
      "care_shifts",
      "care_tasks",
      "care_recipient_members",
    ];

    const channel = tables.reduce(
      (current, table) =>
        current.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            filter: "care_recipient_id=eq." + careRecipientId,
          },
          () => void refresh(),
        ),
      supabase.channel("smart-coverage-planner:" + careRecipientId),
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const plan = useMemo(
    () =>
      buildSmartCoveragePlan({
        requests,
        responses,
        requirementOccurrences,
        tasks,
        members: roster?.members ?? [],
        availability,
        recurringAvailability,
        shifts,
        now: new Date(clock),
        horizonDays: 7,
      }),
    [
      availability,
      clock,
      recurringAvailability,
      requirementOccurrences,
      requests,
      responses,
      roster,
      shifts,
      tasks,
    ],
  );

  const counts = useMemo(() => smartCoveragePlanCounts(plan), [plan]);

  useEffect(() => {
    setSelected((previous) => {
      const next: Record<string, string> = {};
      for (const need of plan) {
        const existing = previous[need.id];
        if (
          existing &&
          need.candidates.some(
            (candidate) => candidate.userId === existing && candidate.assignable,
          )
        ) {
          next[need.id] = existing;
        } else if (need.recommendedUserId) {
          next[need.id] = need.recommendedUserId;
        }
      }
      return next;
    });
  }, [plan]);

  async function confirmCoverage(need: SmartCoverageNeed) {
    if (
      !owner ||
      (need.source !== "coverage_request" &&
        need.source !== "coverage_requirement") ||
      busy
    ) {
      return;
    }

    const caregiverId = selected[need.id] ?? need.recommendedUserId;
    const candidate = need.candidates.find(
      (item) => item.userId === caregiverId,
    );

    if (!caregiverId || !candidate?.assignable) {
      setMessage(
        "Choose a caregiver with recorded Preferred or Available time before confirming this plan.",
      );
      return;
    }

    setBusy(need.id);
    setMessage("");
    try {
      if (need.source === "coverage_request") {
        await assignCareCoverageRequest({
          requestId: need.sourceId,
          caregiverId,
          note: "Assigned from Smart Coverage Planner",
        });
      } else {
        await scheduleCareCoverageRequirementGap({
          requirementId: need.sourceId,
          caregiverId,
          startsAt: need.startsAt,
          endsAt: need.endsAt,
          note: "Scheduled from Smart Coverage Planner",
        });
      }

      await refresh();
      setMessage(
        "Coverage confirmed for " +
          candidate.displayName +
          (need.source === "coverage_request"
            ? ". The open request is filled and the caregiver shift is scheduled."
            : ". The uncovered recurring-care segment is now scheduled."),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not confirm that coverage suggestion.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="SMART COVERAGE PLANNER"
          title="Choose a care profile first."
          body="Coverage planning belongs to one shared care profile."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="SMART COVERAGE PLANNER"
        title="See the next seven days before a care gap becomes urgent."
        body="EnVizion combines recurring required-care windows, open coverage requests, uncovered tasks, caregiver availability, weekly patterns, and scheduled shifts. Nothing is scheduled automatically—the family reviews the suggestion first."
      />

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 110 }}>
          <Text style={S.eyebrow}>KNOWN NEEDS</Text>
          <Text style={S.h2}>{counts.total}</Text>
          <Txt style={S.small}>Next 7 days</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 110 }}>
          <Text style={S.eyebrow}>READY</Text>
          <Text style={S.h2}>{counts.ready}</Text>
          <Txt style={S.small}>Availability match</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 110 }}>
          <Text style={S.eyebrow}>REVIEW</Text>
          <Text style={S.h2}>{counts.review + counts.blocked}</Text>
          <Txt style={S.small}>Needs coordination</Txt>
        </Card>
      </View>

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Icon name="sparkles-outline" color="#E5C8ED" size={28} />
        <Text style={[S.h2, { color: C.white }]}>
          Suggestions, not automatic assignments.
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          Preferred and Available caregivers can be suggested. Missing
          availability is shown for review, while Unavailable time, declines,
          and overlapping shifts are treated as conflicts.
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {!owner && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name={viewer ? "eye-outline" : "people-outline"} />
          <Text style={S.h3}>
            {viewer
              ? "Viewer access is read-only."
              : "Caregivers can review the plan."}
          </Text>
          <Txt>
            {viewer
              ? "You can see the same planning picture, but cannot publish or confirm coverage."
              : "Only the care owner confirms a suggestion for another caregiver. You can still claim open coverage from the coverage request board."}
          </Txt>
        </Card>
      )}

      <View style={{ gap: 9 }}>
        <Button
          title="Proactive coverage forecast"
          secondary
          icon="telescope-outline"
          onPress={() => n.navigate("CoverageForecast")}
        />
        <Button
          title="Review & publish weekly coverage"
          secondary
          icon="checkmark-done-outline"
          onPress={() => n.navigate("WeeklyCoveragePlan")}
        />
        <Button
          title="Recurring care coverage requirements"
          secondary
          icon="time-outline"
          onPress={() => n.navigate("CareCoverageRequirements")}
        />
        <Button
          title="Caregiver availability & schedule"
          secondary
          icon="calendar-outline"
          onPress={() => n.navigate("CareSchedule")}
        />
        <Button
          title="Open caregiver coverage"
          secondary
          icon="megaphone-outline"
          onPress={() => n.navigate("CareCoverageRequests")}
        />
      </View>

      <Section title="Suggested coverage plan · next 7 days" />

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Building coverage suggestions…</Txt>
        </Card>
      ) : !plan.length ? (
        <Card style={{ backgroundColor: "#EAF4EF" }}>
          <Icon name="shield-checkmark-outline" color="#2D7656" />
          <Text style={S.h3}>No known coverage gaps need planning.</Text>
          <Txt>
            Current recurring care requirements, open coverage windows, and
            upcoming care tasks are covered by the schedule for the next seven
            days.
          </Txt>
        </Card>
      ) : (
        plan.map((need) => {
          const selectedUserId =
            selected[need.id] ?? need.recommendedUserId ?? null;
          const selectedCandidate = need.candidates.find(
            (candidate) => candidate.userId === selectedUserId,
          );

          return (
            <Card key={need.id}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={S.eyebrow}>
                    {need.source === "coverage_request"
                      ? "OPEN COVERAGE WINDOW"
                      : need.source === "coverage_requirement"
                        ? "RECURRING CARE GAP"
                        : "UNCOVERED CARE TASK"}
                  </Text>
                  <Text style={S.h2}>{need.label}</Text>
                </View>
                <View
                  style={[
                    S.pill,
                    { backgroundColor: needAccent(need) + "18" },
                  ]}
                >
                  <Text
                    style={[
                      S.small,
                      {
                        color: needAccent(need),
                        fontFamily: "DMSans_600SemiBold",
                      },
                    ]}
                  >
                    {needStatus(need)}
                  </Text>
                </View>
              </View>

              {need.exactWindow ? (
                <Txt style={S.small}>
                  {new Date(need.startsAt).toLocaleString()} →{" "}
                  {new Date(need.endsAt).toLocaleString()}
                </Txt>
              ) : (
                <>
                  <Txt style={S.small}>
                    Due {new Date(need.taskDueAt || need.startsAt).toLocaleString()}
                    {need.taskPriority ? " · " + need.taskPriority + " priority" : ""}
                  </Txt>
                  <Txt style={S.small}>
                    Availability is checked at the task due time only. EnVizion
                    does not infer how long care is required.
                  </Txt>
                </>
              )}

              {Boolean(need.note) && <Txt>{need.note}</Txt>}

              <Text style={S.h3}>
                {need.taskAssignedTo
                  ? "Assigned caregiver availability"
                  : "Caregiver matches"}
              </Text>

              {need.candidates.length ? (
                need.candidates.slice(0, 5).map((candidate) => {
                  const isSelected = selectedUserId === candidate.userId;
                  const canSelect =
                    owner && need.exactWindow && candidate.assignable;

                  return (
                    <Pressable
                      key={candidate.userId}
                      accessibilityRole={canSelect ? "radio" : undefined}
                      accessibilityState={
                        canSelect ? { selected: isSelected } : undefined
                      }
                      disabled={!canSelect}
                      onPress={() =>
                        setSelected((value) => ({
                          ...value,
                          [need.id]: candidate.userId,
                        }))
                      }
                      style={[
                        S.card,
                        {
                          padding: 13,
                          borderColor:
                            canSelect && isSelected ? C.purple : C.line,
                          backgroundColor: isSelected
                            ? "#F7F1F8"
                            : C.white,
                        },
                      ]}
                    >
                      <View style={S.between}>
                        <View style={{ flex: 1, gap: 3 }}>
                          <View style={S.row}>
                            {canSelect && (
                              <Icon
                                name={
                                  isSelected
                                    ? "checkmark-circle"
                                    : "ellipse-outline"
                                }
                                color={isSelected ? C.purple : C.muted}
                                size={19}
                              />
                            )}
                            <Text style={S.h3}>
                              {candidate.displayName}
                              {candidate.isCurrentUser ? " (me)" : ""}
                            </Text>
                          </View>
                          {Boolean(candidate.availabilityNote) && (
                            <Txt style={S.small}>
                              {candidate.availabilityNote}
                            </Txt>
                          )}
                          {Boolean(candidate.overlappingShiftLabel) && (
                            <Txt style={S.small}>
                              Conflicts with {candidate.overlappingShiftLabel}
                            </Txt>
                          )}
                        </View>
                        <View
                          style={[
                            S.pill,
                            {
                              backgroundColor: candidate.declined
                                ? C.redBg
                                : fitBackground(candidate.fit),
                            },
                          ]}
                        >
                          <Text
                            style={[
                              S.small,
                              {
                                color: candidate.declined
                                  ? C.rose
                                  : fitAccent(candidate.fit),
                              },
                            ]}
                          >
                            {candidate.declined
                              ? "Declined request"
                              : coverageBackupFitLabel(candidate.fit)}
                          </Text>
                        </View>
                      </View>
                    </Pressable>
                  );
                })
              ) : (
                <Card style={{ backgroundColor: C.redBg }}>
                  <Txt>
                    No active Owner/Caregiver is available for this planning
                    item.
                  </Txt>
                </Card>
              )}

              {need.source === "coverage_request" ? (
                owner ? (
                  <>
                    {selectedCandidate?.assignable ? (
                      <Button
                        title={
                          busy === need.id
                            ? "Confirming coverage…"
                            : "Confirm " +
                              selectedCandidate.displayName +
                              " for this shift"
                        }
                        disabled={Boolean(busy)}
                        icon="checkmark-circle-outline"
                        onPress={() => void confirmCoverage(need)}
                      />
                    ) : (
                      <Card style={{ backgroundColor: "#FFF1E5" }}>
                        <Txt>
                          Record or review caregiver availability before using
                          one-tap confirmation. You can still manage the window
                          manually from Open Coverage.
                        </Txt>
                      </Card>
                    )}
                    <Button
                      title="Review open coverage request"
                      secondary
                      onPress={() => n.navigate("CareCoverageRequests")}
                    />
                  </>
                ) : (
                  !viewer && (
                    <Button
                      title="Open coverage request"
                      secondary
                      onPress={() => n.navigate("CareCoverageRequests")}
                    />
                  )
                )
              ) : need.source === "coverage_requirement" ? (
                !viewer && (
                  <>
                    {owner && selectedCandidate?.assignable ? (
                      <Button
                        title={
                          busy === need.id
                            ? "Scheduling coverage…"
                            : "Schedule " +
                              selectedCandidate.displayName +
                              " for this gap"
                        }
                        disabled={Boolean(busy)}
                        icon="checkmark-circle-outline"
                        onPress={() => void confirmCoverage(need)}
                      />
                    ) : owner ? (
                      <Card style={{ backgroundColor: "#FFF1E5" }}>
                        <Txt>
                          No caregiver with recorded Preferred or Available time
                          currently covers this entire gap.
                        </Txt>
                      </Card>
                    ) : null}
                    <Button
                      title="Publish this gap as open coverage"
                      secondary
                      icon="megaphone-outline"
                      onPress={() =>
                        n.navigate("CareCoverageRequests", {
                          startsAt: need.startsAt,
                          endsAt: need.endsAt,
                        })
                      }
                    />
                    <Button
                      title="Manage recurring requirements"
                      secondary
                      icon="time-outline"
                      onPress={() => n.navigate("CareCoverageRequirements")}
                    />
                  </>
                )
              ) : (
                !viewer && (
                  <>
                    <Button
                      title="Define a coverage window"
                      secondary
                      icon="megaphone-outline"
                      onPress={() =>
                        n.navigate("CareCoverageRequests", {
                          startsAt: need.taskDueAt || need.startsAt,
                        })
                      }
                    />
                    {need.taskAssignedTo && !need.recommendedUserId && (
                      <Button
                        title="Review task assignment"
                        secondary
                        icon="checkbox-outline"
                        onPress={() => n.navigate("CareTasks")}
                      />
                    )}
                  </>
                )
              )}
            </Card>
          );
        })
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="information-circle-outline" />
        <Text style={S.h3}>Planning support, not emergency monitoring.</Text>
        <Txt>
          Smart Coverage Planner uses the care team’s recorded schedule and
          availability. It does not prove that a caregiver is physically
          present and does not replace urgent or emergency support.
        </Txt>
      </Card>
    </Page>
  );
}
