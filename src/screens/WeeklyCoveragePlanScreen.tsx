import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  loadCareCoverageRequests,
  type CareCoverageRequest,
  type CareCoverageRequestResponse,
} from "../careCoverageRequests";
import {
  loadCareCoverageRequirementOccurrences,
  type CareCoverageRequirementOccurrence,
} from "../careCoverageRequirements";
import { coverageBackupFitLabel } from "../careCoverageMatchingHelpers";
import {
  loadCareSchedule,
  type CareShift,
  type CaregiverAvailability,
  type CaregiverAvailabilityRule,
} from "../careSchedule";
import { loadCareTeam, type CareTeamRoster } from "../careTeam";
import {
  buildSmartCoveragePlan,
  type SmartCoverageNeed,
} from "../smartCoveragePlannerHelpers";
import { localDateTimeToIso, reminderLocalParts } from "../reminderHelpers";
import { detectedTimezone } from "../reminders";
import { supabase } from "../supabase";
import { useCare } from "../store";
import {
  currentWeeklyCoverageUserId,
  loadWeeklyCoveragePlans,
  publishWeeklyCoveragePlan,
  respondWeeklyCoverageSlot,
  saveWeeklyCoveragePlanDraft,
  type CareWeeklyCoveragePlan,
  type CareWeeklyCoverageSlot,
} from "../weeklyCoveragePlan";
import {
  addLocalDateDays,
  defaultWeeklyApprovalDeadlineIso,
  localMondayDate,
  weeklyCoverageDraftSlots,
  weeklyCoverageNeeds,
  weeklyCoverageResponseCounts,
  weeklyCoverageWindow,
} from "../weeklyCoveragePlanHelpers";
import {
  Button,
  C,
  Card,
  Field,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";

function slotKey(input: {
  sourceType?: string;
  source?: string;
  sourceId: string;
  startsAt: string;
  endsAt: string;
}) {
  return [
    input.sourceType ?? input.source ?? "",
    input.sourceId,
    input.startsAt,
    input.endsAt,
  ].join("|");
}

function planStatusLabel(status: CareWeeklyCoveragePlan["status"]) {
  if (status === "draft") return "Draft";
  if (status === "published") return "Waiting on responses";
  if (status === "closed") return "Coverage resolved";
  return "Cancelled";
}

function planStatusBackground(status: CareWeeklyCoveragePlan["status"]) {
  if (status === "closed") return "#EAF4EF";
  if (status === "published") return "#FFF1E5";
  if (status === "cancelled") return C.redBg;
  return C.lavender;
}

function slotStatusLabel(status: CareWeeklyCoverageSlot["status"]) {
  if (status === "proposed") return "Draft";
  if (status === "pending") return "Awaiting response";
  if (status === "accepted") return "Accepted";
  if (status === "declined") return "Declined · Open Coverage";
  if (status === "open_coverage") return "Open Coverage";
  return "Cancelled";
}

function slotStatusBackground(status: CareWeeklyCoverageSlot["status"]) {
  if (status === "accepted") return "#EAF4EF";
  if (status === "pending" || status === "open_coverage") return "#FFF1E5";
  if (status === "declined" || status === "cancelled") return C.redBg;
  return C.lavender;
}

function slotStatusColor(status: CareWeeklyCoverageSlot["status"]) {
  if (status === "accepted") return "#2D7656";
  if (status === "declined" || status === "cancelled") return C.rose;
  if (status === "pending" || status === "open_coverage") return "#A65F20";
  return C.deep;
}

function planForWeek(
  plans: CareWeeklyCoveragePlan[],
  weekStart: string,
) {
  const rows = plans.filter((plan) => plan.weekStart === weekStart);
  const order: Record<CareWeeklyCoveragePlan["status"], number> = {
    draft: 0,
    published: 1,
    closed: 2,
    cancelled: 3,
  };
  return [...rows].sort(
    (a, b) => order[a.status] - order[b.status],
  )[0] ?? null;
}

export function WeeklyCoveragePlanScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const owner = state.accessRole === "owner";
  const viewer = state.accessRole === "viewer";

  const [weekOffset, setWeekOffset] = useState(0);
  const [requests, setRequests] = useState<CareCoverageRequest[]>([]);
  const [responses, setResponses] = useState<CareCoverageRequestResponse[]>([]);
  const [occurrences, setOccurrences] = useState<
    CareCoverageRequirementOccurrence[]
  >([]);
  const [availability, setAvailability] = useState<CaregiverAvailability[]>([]);
  const [recurringAvailability, setRecurringAvailability] = useState<
    CaregiverAvailabilityRule[]
  >([]);
  const [shifts, setShifts] = useState<CareShift[]>([]);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [plans, setPlans] = useState<CareWeeklyCoveragePlan[]>([]);
  const [slots, setSlots] = useState<CareWeeklyCoverageSlot[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string | null>>({});
  const [planNote, setPlanNote] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [deadlineTime, setDeadlineTime] = useState("");
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});
  const [pendingDeclineId, setPendingDeclineId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const currentMonday = useMemo(() => localMondayDate(new Date()), []);
  const weekStart = useMemo(
    () => addLocalDateDays(currentMonday, weekOffset * 7),
    [currentMonday, weekOffset],
  );
  const window = useMemo(
    () => weeklyCoverageWindow(weekStart),
    [weekStart],
  );
  const timezone = useMemo(() => detectedTimezone(), []);

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const occurrenceEnd = new Date(
        new Date(window.endsAt).getTime() + 24 * 60 * 60_000,
      ).toISOString();

      const [coverage, schedule, team, weekly, userId, requirementRows] =
        await Promise.all([
          loadCareCoverageRequests(careRecipientId),
          loadCareSchedule(careRecipientId),
          loadCareTeam(careRecipientId),
          loadWeeklyCoveragePlans(careRecipientId),
          currentWeeklyCoverageUserId(),
          loadCareCoverageRequirementOccurrences({
            careRecipientId,
            startsAt: window.startsAt,
            endsAt: occurrenceEnd,
          }),
        ]);

      setRequests(coverage.requests);
      setResponses(coverage.responses);
      setAvailability(schedule.availability);
      setRecurringAvailability(schedule.recurringAvailability);
      setShifts(schedule.shifts);
      setRoster(team);
      setPlans(weekly.plans);
      setSlots(weekly.slots);
      setCurrentUserId(userId);
      setOccurrences(requirementRows);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not prepare the weekly coverage plan.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, window.endsAt, window.startsAt]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const tables = [
      "care_weekly_coverage_plans",
      "care_weekly_coverage_slots",
      "care_coverage_requests",
      "care_coverage_request_responses",
      "care_coverage_requirements",
      "caregiver_availability",
      "caregiver_availability_rules",
      "care_shifts",
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
      supabase.channel(
        "weekly-coverage-plan:" + careRecipientId + ":" + weekStart,
      ),
    );

    channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh, weekStart]);

  const selectedPlan = useMemo(
    () => planForWeek(plans, weekStart),
    [plans, weekStart],
  );
  const selectedPlanSlots = useMemo(
    () =>
      selectedPlan
        ? slots
            .filter((slot) => slot.planId === selectedPlan.id)
            .sort(
              (a, b) =>
                new Date(a.startsAt).getTime() -
                new Date(b.startsAt).getTime(),
            )
        : [],
    [selectedPlan, slots],
  );

  const planningStart = useMemo(() => {
    const start = new Date(window.startsAt);
    const now = new Date();
    return now.getTime() > start.getTime() && weekOffset === 0 ? now : start;
  }, [weekOffset, window.startsAt]);

  const generatedPlan = useMemo(
    () =>
      buildSmartCoveragePlan({
        requests,
        responses,
        requirementOccurrences: occurrences,
        tasks: [],
        members: roster?.members ?? [],
        availability,
        recurringAvailability,
        shifts,
        now: planningStart,
        horizonDays: 8,
      }),
    [
      availability,
      occurrences,
      planningStart,
      recurringAvailability,
      requests,
      responses,
      roster,
      shifts,
    ],
  );

  const planningNeeds = useMemo(
    () =>
      weeklyCoverageNeeds(
        generatedPlan,
        window.startsAt,
        window.endsAt,
      ),
    [generatedPlan, window.endsAt, window.startsAt],
  );

  useEffect(() => {
    if (selectedPlan && selectedPlan.status !== "draft") return;

    const persistedByKey = new Map(
      selectedPlanSlots.map((slot) => [slotKey(slot), slot]),
    );
    const next: Record<string, string | null> = {};

    for (const need of planningNeeds) {
      const persisted = persistedByKey.get(slotKey(need));
      next[need.id] = persisted
        ? persisted.caregiverId
        : need.recommendedUserId;
    }

    setSelected(next);
    setPlanNote(selectedPlan?.note ?? "");

    const deadlineIso =
      selectedPlan?.approvalDeadlineAt ??
      defaultWeeklyApprovalDeadlineIso(planningNeeds);
    const deadlineParts = deadlineIso
      ? reminderLocalParts(deadlineIso)
      : { date: "", time: "" };
    setDeadlineDate(deadlineParts.date);
    setDeadlineTime(deadlineParts.time);
  }, [
    planningNeeds,
    selectedPlan?.approvalDeadlineAt,
    selectedPlan?.id,
    selectedPlan?.status,
    selectedPlanSlots,
  ]);

  const memberMap = useMemo(
    () =>
      new Map(
        (roster?.members ?? []).map((member) => [
          member.userId,
          member,
        ]),
      ),
    [roster],
  );

  const responseCounts = useMemo(
    () =>
      weeklyCoverageResponseCounts(
        selectedPlanSlots.map((slot) => slot.status),
      ),
    [selectedPlanSlots],
  );

  const readyCount = planningNeeds.filter((need) => {
    const caregiverId = Object.prototype.hasOwnProperty.call(selected, need.id)
      ? selected[need.id]
      : need.recommendedUserId;
    return Boolean(
      caregiverId &&
        need.candidates.some(
          (candidate) =>
            candidate.userId === caregiverId && candidate.assignable,
        ),
    );
  }).length;

  const unassignedCount = planningNeeds.length - readyCount;

  function approvalDeadlineForDraft(
    draftSlots: ReturnType<typeof weeklyCoverageDraftSlots>,
  ) {
    const assignedForApproval = draftSlots.filter(
      (slot) =>
        Boolean(slot.caregiverId) &&
        slot.caregiverId !== currentUserId,
    );

    if (!assignedForApproval.length) {
      return { value: null as string | null, error: "" };
    }

    const value = localDateTimeToIso(deadlineDate, deadlineTime);
    if (!value) {
      return {
        value: null as string | null,
        error:
          "Add a valid caregiver response deadline using YYYY-MM-DD and HH:MM.",
      };
    }

    const deadlineMs = new Date(value).getTime();
    const nowMs = Date.now();
    if (!Number.isFinite(deadlineMs) || deadlineMs <= nowMs) {
      return {
        value: null as string | null,
        error: "Caregiver response deadline must be in the future.",
      };
    }

    const boundaries = assignedForApproval
      .map((slot) => {
        const startsAt = new Date(slot.startsAt).getTime();
        const endsAt = new Date(slot.endsAt).getTime();
        if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) return NaN;
        return startsAt > nowMs ? startsAt : endsAt;
      })
      .filter(Number.isFinite);

    const earliestBoundary = boundaries.length
      ? Math.min(...boundaries)
      : NaN;

    if (
      Number.isFinite(earliestBoundary) &&
      deadlineMs >= earliestBoundary
    ) {
      return {
        value: null as string | null,
        error:
          "Set the approval deadline before the earliest assigned coverage window needs resolution.",
      };
    }

    return { value, error: "" };
  }

  async function saveDraft() {
    if (!careRecipientId || !owner || busy || !planningNeeds.length) return;

    const draftSlots = weeklyCoverageDraftSlots(
      planningNeeds,
      selected,
    );
    const deadline = approvalDeadlineForDraft(draftSlots);
    if (deadline.error) {
      setMessage(deadline.error);
      return;
    }

    setBusy("save");
    setMessage("");
    try {
      await saveWeeklyCoveragePlanDraft({
        careRecipientId,
        weekStart,
        timezone,
        note: planNote,
        approvalDeadlineAt: deadline.value,
        slots: draftSlots,
      });
      await refresh();
      setMessage(
        "Weekly draft saved. Review the assignments, then publish when the family is ready.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save the weekly coverage draft.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function publishPlan() {
    if (
      !careRecipientId ||
      !owner ||
      !selectedPlan ||
      selectedPlan.status !== "draft" ||
      busy
    ) {
      return;
    }

    const draftSlots = weeklyCoverageDraftSlots(
      planningNeeds,
      selected,
    );
    const deadline = approvalDeadlineForDraft(draftSlots);
    if (deadline.error) {
      setMessage(deadline.error);
      return;
    }

    setBusy("publish");
    setMessage("");
    try {
      const planId = await saveWeeklyCoveragePlanDraft({
        careRecipientId,
        weekStart,
        timezone,
        note: planNote,
        approvalDeadlineAt: deadline.value,
        slots: draftSlots,
      });
      await publishWeeklyCoveragePlan(planId);
      await refresh();
      setMessage(
        "Weekly plan published. Pending approvals will automatically move to Open Coverage at the response deadline.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not publish the weekly coverage plan.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function respond(
    slot: CareWeeklyCoverageSlot,
    response: "accepted" | "declined",
  ) {
    if (busy || slot.caregiverId !== currentUserId) return;

    if (response === "declined" && pendingDeclineId !== slot.id) {
      setPendingDeclineId(slot.id);
      setMessage(
        "Tap Confirm decline on this slot to move it into Open Coverage.",
      );
      return;
    }

    setBusy("response:" + slot.id);
    setMessage("");
    try {
      await respondWeeklyCoverageSlot({
        slotId: slot.id,
        response,
        note: responseNotes[slot.id] ?? "",
      });
      setPendingDeclineId(null);
      await refresh();
      setMessage(
        response === "accepted"
          ? "Coverage accepted. The caregiver shift is now scheduled."
          : "Coverage declined. The exact slot is now in Open Coverage.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save that coverage response.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="WEEKLY COVERAGE APPROVAL"
          title="Choose a care profile first."
          body="Weekly coverage plans belong to one shared care profile."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="WEEKLY COVERAGE APPROVAL"
        title="Review the whole care week before assignments become shifts."
        body="Build one weekly plan from real coverage gaps, publish it once, and let each assigned caregiver accept or decline their own slots."
      />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="This week"
            secondary={weekOffset !== 0}
            onPress={() => setWeekOffset(0)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Next week"
            secondary={weekOffset !== 1}
            onPress={() => setWeekOffset(1)}
          />
        </View>
      </View>

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E0C6E8" }]}>CARE WEEK</Text>
        <Text style={[S.h2, { color: C.white }]}>
          {weekStart} → {addLocalDateDays(weekStart, 6)}
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          {timezone} · Only real recurring-care gaps and open coverage windows
          are included. Uncovered task due-times stay in task coordination.
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {viewer && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>
            You can review published weekly coverage, but cannot create,
            publish, accept, or decline assignments.
          </Txt>
        </Card>
      )}

      <View style={{ gap: 9 }}>
        <Button
          title="Smart Coverage Planner"
          secondary
          icon="sparkles-outline"
          onPress={() => n.navigate("SmartCoveragePlanner")}
        />
        <Button
          title="Recurring care requirements"
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
      </View>

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Preparing this care week…</Txt>
        </Card>
      ) : selectedPlan && selectedPlan.status !== "draft" ? (
        <>
          <Section title="Published weekly plan" />
          <Card style={{ backgroundColor: planStatusBackground(selectedPlan.status) }}>
            <View style={S.between}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.h2}>{planStatusLabel(selectedPlan.status)}</Text>
                <Txt style={S.small}>
                  {responseCounts.accepted} accepted · {responseCounts.pending} pending ·{" "}
                  {responseCounts.openCoverage + responseCounts.declined} in Open Coverage
                </Txt>
              </View>
              <Icon
                name={
                  selectedPlan.status === "closed"
                    ? "shield-checkmark-outline"
                    : "people-outline"
                }
                color={selectedPlan.status === "closed" ? "#2D7656" : C.purple}
              />
            </View>
            {Boolean(selectedPlan.note) && <Txt>{selectedPlan.note}</Txt>}
            {selectedPlan.approvalDeadlineAt && (
              <Txt style={S.small}>
                Response deadline ·{" "}
                {new Date(selectedPlan.approvalDeadlineAt).toLocaleString()}
                {selectedPlan.approvalDeadlineProcessedAt
                  ? " · timeout check completed"
                  : ""}
              </Txt>
            )}
          </Card>

          {selectedPlanSlots.map((slot) => {
            const assigned = slot.caregiverId
              ? memberMap.get(slot.caregiverId)
              : null;
            const mine =
              slot.status === "pending" &&
              slot.caregiverId === currentUserId &&
              !viewer;

            return (
              <Card key={slot.id}>
                <View style={S.between}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={S.eyebrow}>
                      {slot.sourceType === "coverage_requirement"
                        ? "RECURRING CARE"
                        : "OPEN COVERAGE"}
                    </Text>
                    <Text style={S.h2}>{slot.label}</Text>
                  </View>
                  <View
                    style={[
                      S.pill,
                      { backgroundColor: slotStatusBackground(slot.status) },
                    ]}
                  >
                    <Text
                      style={[
                        S.small,
                        { color: slotStatusColor(slot.status) },
                      ]}
                    >
                      {slotStatusLabel(slot.status)}
                    </Text>
                  </View>
                </View>

                <Txt style={S.small}>
                  {new Date(slot.startsAt).toLocaleString()} →{" "}
                  {new Date(slot.endsAt).toLocaleString()}
                </Txt>
                <Txt>
                  {assigned
                    ? "Assigned to " +
                      (assigned.isCurrentUser
                        ? (assigned.displayName || "Me") + " (me)"
                        : assigned.displayName || "Caregiver")
                    : "No caregiver assigned"}
                </Txt>

                {Boolean(slot.responseNote) && (
                  <Txt style={S.small}>Response note · {slot.responseNote}</Txt>
                )}
                {slot.timedOutAt && (
                  <Txt style={S.small}>
                    Approval timed out ·{" "}
                    {new Date(slot.timedOutAt).toLocaleString()}
                  </Txt>
                )}

                {mine && (
                  <Card style={{ backgroundColor: "#F7F1F8" }}>
                    <Text style={S.h3}>Your response</Text>
                    <Txt>
                      Accept only if you can take this entire coverage window.
                      Declining moves the slot into Open Coverage automatically.
                    </Txt>
                    {selectedPlan.approvalDeadlineAt && (
                      <Txt style={S.small}>
                        Respond by{" "}
                        {new Date(
                          selectedPlan.approvalDeadlineAt,
                        ).toLocaleString()}. If no response arrives by then,
                        this reservation is released to backup caregivers.
                      </Txt>
                    )}
                    <Field
                      label="Optional response note"
                      value={responseNotes[slot.id] ?? ""}
                      onChange={(value) =>
                        setResponseNotes((current) => ({
                          ...current,
                          [slot.id]: value.slice(0, 2000),
                        }))
                      }
                      multiline
                    />
                    <Button
                      title={
                        busy === "response:" + slot.id
                          ? "Saving response…"
                          : "Accept coverage"
                      }
                      disabled={Boolean(busy)}
                      icon="checkmark-circle-outline"
                      onPress={() => void respond(slot, "accepted")}
                    />
                    <Button
                      title={
                        pendingDeclineId === slot.id
                          ? "Confirm decline"
                          : "Decline coverage"
                      }
                      secondary
                      disabled={Boolean(busy)}
                      onPress={() => void respond(slot, "declined")}
                    />
                  </Card>
                )}

                {(slot.status === "declined" ||
                  slot.status === "open_coverage") && (
                  <Button
                    title="Open Coverage board"
                    secondary
                    icon="megaphone-outline"
                    onPress={() => n.navigate("CareCoverageRequests")}
                  />
                )}
              </Card>
            );
          })}
        </>
      ) : (
        <>
          <Section title={owner ? "Owner review" : "Coverage preview"} />

          {!planningNeeds.length ? (
            <Card style={{ backgroundColor: "#EAF4EF" }}>
              <Icon name="shield-checkmark-outline" color="#2D7656" />
              <Text style={S.h3}>No weekly coverage gaps need approval.</Text>
              <Txt>
                Recurring required-care windows and open coverage needs are
                already covered for this week.
              </Txt>
            </Card>
          ) : (
            <>
              <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
                <Card style={{ flex: 1, minWidth: 105 }}>
                  <Text style={S.eyebrow}>SLOTS</Text>
                  <Text style={S.h2}>{planningNeeds.length}</Text>
                  <Txt style={S.small}>Need review</Txt>
                </Card>
                <Card style={{ flex: 1, minWidth: 105 }}>
                  <Text style={S.eyebrow}>ASSIGNED</Text>
                  <Text style={S.h2}>{readyCount}</Text>
                  <Txt style={S.small}>Recorded match</Txt>
                </Card>
                <Card style={{ flex: 1, minWidth: 105 }}>
                  <Text style={S.eyebrow}>OPEN</Text>
                  <Text style={S.h2}>{unassignedCount}</Text>
                  <Txt style={S.small}>Will need backup</Txt>
                </Card>
              </View>

              {owner && (
                <>
                  <Field
                    label="Weekly plan note · optional"
                    value={planNote}
                    onChange={(value) => setPlanNote(value.slice(0, 2000))}
                    multiline
                  />
                  <Card style={{ backgroundColor: "#F7F1F8" }}>
                    <Icon name="timer-outline" />
                    <Text style={S.h3}>Caregiver response deadline</Text>
                    <Txt>
                      Pending caregiver reservations automatically leave the
                      reserved state at this cutoff, move into Open Coverage,
                      notify backups, and join the existing escalation engine.
                    </Txt>
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Deadline date · YYYY-MM-DD"
                          value={deadlineDate}
                          onChange={(value) =>
                            setDeadlineDate(value.slice(0, 10))
                          }
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Field
                          label="Time · HH:MM"
                          value={deadlineTime}
                          onChange={(value) =>
                            setDeadlineTime(value.slice(0, 5))
                          }
                        />
                      </View>
                    </View>
                    <Txt style={S.small}>
                      The suggested cutoff leaves time for backup coverage
                      before the earliest assigned slot whenever possible.
                    </Txt>
                  </Card>
                </>
              )}

              {planningNeeds.map((need: SmartCoverageNeed) => {
                const selectedId = Object.prototype.hasOwnProperty.call(
                  selected,
                  need.id,
                )
                  ? selected[need.id]
                  : need.recommendedUserId;

                return (
                  <Card key={need.id}>
                    <Text style={S.eyebrow}>
                      {need.source === "coverage_requirement"
                        ? "RECURRING CARE GAP"
                        : "OPEN COVERAGE WINDOW"}
                    </Text>
                    <Text style={S.h2}>{need.label}</Text>
                    <Txt style={S.small}>
                      {new Date(need.startsAt).toLocaleString()} →{" "}
                      {new Date(need.endsAt).toLocaleString()}
                    </Txt>
                    {Boolean(need.note) && <Txt>{need.note}</Txt>}

                    <Text style={S.h3}>Planned caregiver</Text>

                    {owner && (
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected: selectedId === null }}
                        onPress={() =>
                          setSelected((current) => ({
                            ...current,
                            [need.id]: null,
                          }))
                        }
                        style={[
                          S.card,
                          {
                            padding: 12,
                            borderColor:
                              selectedId === null ? C.purple : C.line,
                            backgroundColor:
                              selectedId === null ? "#F7F1F8" : C.white,
                          },
                        ]}
                      >
                        <View style={S.row}>
                          <Icon
                            name={
                              selectedId === null
                                ? "checkmark-circle"
                                : "ellipse-outline"
                            }
                            color={selectedId === null ? C.purple : C.muted}
                            size={19}
                          />
                          <View style={{ flex: 1 }}>
                            <Text style={S.h3}>Leave unassigned</Text>
                            <Txt style={S.small}>
                              Publishing will move this exact slot to Open
                              Coverage.
                            </Txt>
                          </View>
                        </View>
                      </Pressable>
                    )}

                    {need.candidates
                      .filter((candidate) => candidate.assignable)
                      .slice(0, 6)
                      .map((candidate) => {
                        const chosen = selectedId === candidate.userId;
                        return (
                          <Pressable
                            key={candidate.userId}
                            accessibilityRole={owner ? "radio" : undefined}
                            accessibilityState={
                              owner ? { selected: chosen } : undefined
                            }
                            disabled={!owner}
                            onPress={() =>
                              setSelected((current) => ({
                                ...current,
                                [need.id]: candidate.userId,
                              }))
                            }
                            style={[
                              S.card,
                              {
                                padding: 12,
                                borderColor: chosen ? C.purple : C.line,
                                backgroundColor: chosen
                                  ? "#F7F1F8"
                                  : C.white,
                              },
                            ]}
                          >
                            <View style={S.between}>
                              <View style={[S.row, { flex: 1 }]}>
                                {owner && (
                                  <Icon
                                    name={
                                      chosen
                                        ? "checkmark-circle"
                                        : "ellipse-outline"
                                    }
                                    color={chosen ? C.purple : C.muted}
                                    size={19}
                                  />
                                )}
                                <Text style={S.h3}>
                                  {candidate.displayName}
                                  {candidate.isCurrentUser ? " (me)" : ""}
                                </Text>
                              </View>
                              <View
                                style={[
                                  S.pill,
                                  {
                                    backgroundColor:
                                      candidate.fit === "preferred"
                                        ? "#EAF4EF"
                                        : C.lavender,
                                  },
                                ]}
                              >
                                <Text style={S.small}>
                                  {coverageBackupFitLabel(candidate.fit)}
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        );
                      })}

                    {!need.candidates.some(
                      (candidate) => candidate.assignable,
                    ) && (
                      <Card style={{ backgroundColor: "#FFF1E5" }}>
                        <Txt>
                          No caregiver has recorded Preferred or Available time
                          for this entire slot. It can still be published to
                          Open Coverage.
                        </Txt>
                      </Card>
                    )}
                  </Card>
                );
              })}

              {owner && (
                <Card style={{ backgroundColor: C.lavender }}>
                  <Text style={S.h3}>
                    {selectedPlan?.status === "draft"
                      ? "Draft saved"
                      : "Draft not saved yet"}
                  </Text>
                  <Txt>
                    Saving does not notify caregivers. Publishing sends the
                    approval requests and moves unassigned slots into Open
                    Coverage. Any unanswered assigned slot is automatically
                    released at the response deadline.
                  </Txt>
                  <Button
                    title={
                      busy === "save"
                        ? "Saving weekly draft…"
                        : selectedPlan?.status === "draft"
                          ? "Update weekly draft"
                          : "Save weekly draft"
                    }
                    disabled={Boolean(busy)}
                    icon="save-outline"
                    onPress={() => void saveDraft()}
                  />
                  {selectedPlan?.status === "draft" && (
                    <Button
                      title={
                        busy === "publish"
                          ? "Publishing week…"
                          : "Publish weekly coverage plan"
                      }
                      disabled={Boolean(busy)}
                      icon="send-outline"
                      onPress={() => void publishPlan()}
                    />
                  )}
                </Card>
              )}
            </>
          )}
        </>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="information-circle-outline" />
        <Text style={S.h3}>Family coordination, not emergency monitoring.</Text>
        <Txt>
          A published plan records intended caregiver coverage. Caregivers
          still need to accept their assigned slots. Unanswered approvals are
          released to Open Coverage at the configured deadline, but EnVizion
          cannot verify physical presence until the normal shift check-in
          workflow is used.
        </Txt>
      </Card>
    </Page>
  );
}
