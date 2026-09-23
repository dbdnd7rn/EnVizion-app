import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import {
  cancelCareCoverageRequest,
  createCareCoverageRequest,
  loadCareCoverageRequests,
  respondCareCoverageRequest,
  type CareCoverageRequest,
  type CareCoverageRequestResponse,
} from "../careCoverageRequests";
import {
  coverageRequestCounts,
  coverageRequestDurationLabel,
  coverageRequestDurationMinutes,
  coverageRequestWindowState,
  latestCoverageResponseForUser,
  orderedCoverageRequests,
} from "../careCoverageRequestHelpers";
import {
  buildCoverageBackupMatches,
  coverageBackupFitLabel,
  coverageEscalationLabel,
  coverageEscalationLevel,
  escalationEligibleMatches,
} from "../careCoverageMatchingHelpers";
import {
  loadCareSchedule,
  type CareShift,
  type CaregiverAvailability,
  type CaregiverAvailabilityRule,
} from "../careSchedule";
import { currentCareTaskUserId } from "../careTasks";
import {
  loadCareTeam,
  type CareTeamRoster,
} from "../careTeam";
import {
  localDateTimeToIso,
  reminderLocalParts,
} from "../reminders";
import { supabase } from "../supabase";
import { useCare } from "../store";
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

type Props = NativeStackScreenProps<RootStack, "CareCoverageRequests">;

type Draft = {
  label: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  note: string;
};

function defaultWindow(startsAt?: string, endsAt?: string) {
  const fallbackStart = new Date(Date.now() + 30 * 60_000);

  const parsedStart =
    startsAt && Number.isFinite(new Date(startsAt).getTime())
      ? startsAt
      : fallbackStart.toISOString();
  const fallbackEnd = new Date(
    new Date(parsedStart).getTime() + 2 * 60 * 60_000,
  );
  const parsedEnd =
    endsAt &&
    Number.isFinite(new Date(endsAt).getTime()) &&
    new Date(endsAt).getTime() > new Date(parsedStart).getTime()
      ? endsAt
      : fallbackEnd.toISOString();

  return {
    start: reminderLocalParts(parsedStart),
    end: reminderLocalParts(parsedEnd),
  };
}

function blankDraft(startsAt?: string, endsAt?: string): Draft {
  const window = defaultWindow(startsAt, endsAt);
  return {
    label: "Open caregiver coverage",
    startDate: window.start.date,
    startTime: window.start.time,
    endDate: window.end.date,
    endTime: window.end.time,
    note: "",
  };
}

function statusCopy(request: CareCoverageRequest, now = new Date()) {
  if (request.status === "filled") return "Filled";
  if (request.status === "reserved") return "Reserved for weekly approval";
  if (request.status === "cancelled") return "Cancelled";
  if (coverageRequestWindowState(request, now) === "ended") return "Expired";
  if (coverageRequestWindowState(request, now) === "active") return "Open now";
  return "Open";
}

function statusBackground(request: CareCoverageRequest, now = new Date()) {
  const label = statusCopy(request, now);
  if (label === "Filled") return "#EAF4EF";
  if (label === "Reserved for weekly approval") return "#F0E8F3";
  if (label === "Open now") return "#FFF1E5";
  if (label === "Open") return C.lavender;
  return "#F1EDEF";
}

function escalationBackground(
  level: ReturnType<typeof coverageEscalationLevel>,
) {
  if (level === "active_unfilled" || level === "starts_soon") return C.redBg;
  if (level === "getting_close") return "#FFF1E5";
  if (level === "watch") return C.lavender;
  return "#F1EDEF";
}

function escalationAccent(
  level: ReturnType<typeof coverageEscalationLevel>,
) {
  if (level === "active_unfilled" || level === "starts_soon") return C.rose;
  if (level === "getting_close") return "#A65F20";
  return C.purple;
}

function fitBackground(fit: ReturnType<typeof buildCoverageBackupMatches>[number]["fit"]) {
  if (fit === "preferred") return "#EAF4EF";
  if (fit === "available") return C.lavender;
  if (fit === "scheduled_conflict" || fit === "unavailable_conflict") {
    return C.redBg;
  }
  return "#F1EDEF";
}

export function CareCoverageRequestsScreen({ route }: Props) {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const viewer = state.accessRole === "viewer";
  const owner = state.accessRole === "owner";
  const initialStart = route.params?.startsAt;
  const initialEnd = route.params?.endsAt;

  const [requests, setRequests] = useState<CareCoverageRequest[]>([]);
  const [responses, setResponses] = useState<CareCoverageRequestResponse[]>([]);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [availability, setAvailability] = useState<CaregiverAvailability[]>([]);
  const [recurringAvailability, setRecurringAvailability] = useState<
    CaregiverAvailabilityRule[]
  >([]);
  const [shifts, setShifts] = useState<CareShift[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(
    Boolean(!viewer && (initialStart || initialEnd)),
  );
  const [draft, setDraft] = useState<Draft>(() =>
    blankDraft(initialStart, initialEnd),
  );
  const [pendingCancelId, setPendingCancelId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setRequests([]);
      setResponses([]);
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
      const [coverage, team, userId, schedule] = await Promise.all([
        loadCareCoverageRequests(careRecipientId),
        loadCareTeam(careRecipientId),
        currentCareTaskUserId(),
        loadCareSchedule(careRecipientId),
      ]);
      setRequests(coverage.requests);
      setResponses(coverage.responses);
      setRoster(team);
      setAvailability(schedule.availability);
      setRecurringAvailability(schedule.recurringAvailability);
      setShifts(schedule.shifts);
      setCurrentUserId(userId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load open caregiver coverage.",
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

    const channel = supabase
      .channel(`care-coverage-requests:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_coverage_requests",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_coverage_request_responses",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "caregiver_availability",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "caregiver_availability_rules",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_shifts",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const memberMap = useMemo(
    () =>
      new Map(
        (roster?.members ?? []).map((member) => [member.userId, member]),
      ),
    [roster],
  );

  function memberName(userId: string | null) {
    if (!userId) return "Caregiver";
    const member = memberMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? `${member.displayName || "Me"} (me)`
      : member.displayName || "Caregiver";
  }

  const counts = useMemo(() => coverageRequestCounts(requests), [requests]);
  const ordered = useMemo(() => orderedCoverageRequests(requests), [requests]);

  async function publishRequest() {
    if (!careRecipientId || viewer || busy) return;

    const startsAt = localDateTimeToIso(draft.startDate, draft.startTime);
    const endsAt = localDateTimeToIso(draft.endDate, draft.endTime);

    if (!startsAt || !endsAt) {
      setMessage(
        "Use valid dates and 24-hour times such as 2026-09-23 and 14:30.",
      );
      return;
    }

    if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
      setMessage("Coverage end time must be after the start time.");
      return;
    }

    if (new Date(endsAt).getTime() <= Date.now()) {
      setMessage("Coverage end time must still be in the future.");
      return;
    }

    setBusy("publish");
    setMessage("");
    try {
      await createCareCoverageRequest({
        careRecipientId,
        label: draft.label,
        startsAt,
        endsAt,
        note: draft.note,
      });
      setFormOpen(false);
      setDraft(blankDraft());
      await refresh();
      setMessage(
        "Coverage request published. Eligible caregivers can now accept or decline it.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not publish this coverage request.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function respond(
    request: CareCoverageRequest,
    response: "accepted" | "declined",
  ) {
    if (viewer || busy) return;

    setBusy(`${response}:${request.id}`);
    setMessage("");
    try {
      const result = await respondCareCoverageRequest({
        requestId: request.id,
        response,
      });
      await refresh();

      if (response === "accepted") {
        setMessage(
          result.shiftId
            ? "Coverage claimed. Your scheduled caregiver shift was created automatically."
            : "Coverage claimed.",
        );
      } else {
        setMessage(
          "Declined for now. You can still claim it later while the request remains open.",
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not record your coverage response.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function cancel(request: CareCoverageRequest) {
    if (viewer || busy) return;

    if (pendingCancelId !== request.id) {
      setPendingCancelId(request.id);
      setMessage("Tap cancel again to confirm this coverage request.");
      return;
    }

    setBusy(`cancel:${request.id}`);
    setMessage("");
    try {
      await cancelCareCoverageRequest(request.id);
      setPendingCancelId(null);
      await refresh();
      setMessage("Coverage request cancelled.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not cancel this coverage request.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="OPEN CAREGIVER COVERAGE"
          title="Choose a care profile first."
          body="Coverage requests belong to one shared care profile."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="OPEN SHIFT / COVERAGE REQUEST"
        title="Turn uncovered care time into a clear request for help."
        body="Publish a specific coverage window. EnVizion matches backup caregivers from recorded availability, escalates unfilled requests as start time approaches, and the first eligible caregiver who accepts receives the scheduled shift automatically."
      />

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 130 }}>
          <Text style={S.eyebrow}>OPEN</Text>
          <Text style={S.h2}>{counts.open}</Text>
          <Txt style={S.small}>Coverage requests</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 130 }}>
          <Text style={S.eyebrow}>RESERVED</Text>
          <Text style={S.h2}>{counts.reserved}</Text>
          <Txt style={S.small}>Weekly approval</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 130 }}>
          <Text style={S.eyebrow}>FILLED</Text>
          <Text style={S.h2}>{counts.filled}</Text>
          <Txt style={S.small}>Claimed requests</Txt>
        </Card>
      </View>

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
            You can see coverage requests and who claimed them, but only active
            Owners and Caregivers can publish or respond.
          </Txt>
        </Card>
      )}

      {!viewer && !formOpen && (
        <Button
          title="Publish open coverage"
          icon="megaphone-outline"
          onPress={() => {
            setDraft(blankDraft());
            setFormOpen(true);
            setMessage("");
          }}
        />
      )}

      {!viewer && formOpen && (
        <>
          <Section title="Coverage needed" />
          <Card>
            <Field
              label="Request label"
              value={draft.label}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  label: value.slice(0, 160),
                }))
              }
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="Start date"
                  value={draft.startDate}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      startDate: value,
                    }))
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="Start time"
                  value={draft.startTime}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      startTime: value,
                    }))
                  }
                />
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field
                  label="End date"
                  value={draft.endDate}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      endDate: value,
                    }))
                  }
                />
              </View>
              <View style={{ flex: 1 }}>
                <Field
                  label="End time"
                  value={draft.endTime}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      endTime: value,
                    }))
                  }
                />
              </View>
            </View>
            <Field
              label="What does the caregiver need to know?"
              value={draft.note}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  note: value.slice(0, 4000),
                }))
              }
              multiline
            />
            <Button
              title={busy === "publish" ? "Publishing…" : "Publish coverage request"}
              disabled={Boolean(busy)}
              icon="megaphone-outline"
              onPress={() => void publishRequest()}
            />
            <Button
              title="Cancel"
              secondary
              disabled={Boolean(busy)}
              onPress={() => setFormOpen(false)}
            />
          </Card>
        </>
      )}

      <Section
        title="Coverage request board"
        action="Refresh"
        onPress={() => void refresh()}
      />

      {loading && !requests.length ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading caregiver coverage requests…</Txt>
        </Card>
      ) : !ordered.length ? (
        <Card style={{ backgroundColor: "#EAF4EF" }}>
          <Icon name="checkmark-circle-outline" color={C.green} size={30} />
          <Text style={S.h3}>No coverage requests have been published.</Text>
          <Txt>
            When a gap is detected, publish its exact time window here instead
            of relying on an informal message thread.
          </Txt>
        </Card>
      ) : (
        ordered.map((request) => {
          const now = new Date();
          const windowState = coverageRequestWindowState(request, now);
          const myResponse = latestCoverageResponseForUser(
            responses,
            request.id,
            currentUserId,
          );
          const responseRows = responses.filter(
            (item) => item.requestId === request.id,
          );
          const escalationLevel = coverageEscalationLevel(
            request,
            new Date(clock),
          );
          const backupMatches = buildCoverageBackupMatches({
            request,
            members: roster?.members ?? [],
            availability,
            recurringAvailability,
            shifts,
            responses,
          });
          const escalationTargets = escalationEligibleMatches(
            backupMatches,
            escalationLevel,
          );
          const currentUserMatch =
            backupMatches.find((match) => match.userId === currentUserId) ??
            null;
          const canCancel =
            request.status === "open" &&
            (owner || request.createdBy === currentUserId);
          const canRespond =
            !viewer &&
            request.status === "open" &&
            windowState !== "ended";
          const claimBlockedByScheduledConflict =
            currentUserMatch?.fit === "scheduled_conflict";

          return (
            <Card
              key={request.id}
              style={{
                borderColor:
                  request.status === "open" && windowState !== "ended"
                    ? "#D9C8E1"
                    : C.line,
              }}
            >
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.h3}>{request.label}</Text>
                  <Txt style={S.small}>
                    Published by {memberName(request.createdBy)}
                  </Txt>
                </View>
                <View
                  style={[
                    S.pill,
                    { backgroundColor: statusBackground(request, now) },
                  ]}
                >
                  <Text style={S.small}>{statusCopy(request, now)}</Text>
                </View>
              </View>

              <View style={{ gap: 5 }}>
                <Txt>
                  {new Date(request.startsAt).toLocaleString()} →{" "}
                  {new Date(request.endsAt).toLocaleString()}
                </Txt>
                <Txt style={S.small}>
                  {coverageRequestDurationLabel(
                    coverageRequestDurationMinutes(request),
                  )}{" "}
                  requested
                </Txt>
              </View>

              {Boolean(request.note) && <Txt>{request.note}</Txt>}

              {request.status === "open" && windowState !== "ended" && (
                <>
                  <Card
                    style={{
                      backgroundColor: escalationBackground(escalationLevel),
                      borderColor: escalationAccent(escalationLevel),
                    }}
                  >
                    <View style={S.between}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={S.eyebrow}>COVERAGE ESCALATION</Text>
                        <Text style={S.h3}>
                          {coverageEscalationLabel(escalationLevel)}
                        </Text>
                      </View>
                      <Icon
                        name={
                          escalationLevel === "active_unfilled" ||
                          escalationLevel === "starts_soon"
                            ? "warning-outline"
                            : "notifications-outline"
                        }
                        color={escalationAccent(escalationLevel)}
                        size={24}
                      />
                    </View>

                    {escalationLevel === "watch" && (
                      <Txt style={S.small}>
                        Preferred backups are now eligible for reminder escalation.
                      </Txt>
                    )}
                    {escalationLevel === "getting_close" && (
                      <Txt style={S.small}>
                        Preferred and Available backups are now eligible for reminder escalation.
                      </Txt>
                    )}
                    {(escalationLevel === "starts_soon" ||
                      escalationLevel === "active_unfilled") && (
                      <Txt style={S.small}>
                        EnVizion can now remind any eligible backup who has not
                        declined, is not already scheduled elsewhere, and has not
                        marked this window unavailable.
                      </Txt>
                    )}
                    {escalationTargets.length > 0 && (
                      <Txt style={S.small}>
                        {escalationTargets.length} backup caregiver
                        {escalationTargets.length === 1 ? "" : "s"} match the
                        current escalation stage.
                      </Txt>
                    )}
                  </Card>

                  <Card style={{ backgroundColor: "#FBF9FC" }}>
                    <View style={S.between}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={S.eyebrow}>BACKUP CAREGIVER MATCHING</Text>
                        <Text style={S.h3}>
                          Recorded fit for this exact coverage window
                        </Text>
                      </View>
                      <Icon name="people-outline" color={C.purple} size={24} />
                    </View>
                    <Txt style={S.small}>
                      Matching uses caregiver availability and scheduled shifts.
                      “No availability recorded” is not treated as confirmation
                      that someone is free.
                    </Txt>

                    {!backupMatches.length ? (
                      <Txt style={S.small}>
                        No other active Owner/Caregiver is available in this care
                        profile to compare.
                      </Txt>
                    ) : (
                      backupMatches.slice(0, 6).map((match) => (
                        <View
                          key={match.userId}
                          style={{
                            padding: 12,
                            borderRadius: 13,
                            backgroundColor: C.white,
                            borderWidth: 1,
                            borderColor: C.line,
                            gap: 5,
                          }}
                        >
                          <View style={S.between}>
                            <Text style={S.h3}>
                              {match.displayName}
                              {match.isCurrentUser ? " (me)" : ""}
                            </Text>
                            <View
                              style={[
                                S.pill,
                                { backgroundColor: fitBackground(match.fit) },
                              ]}
                            >
                              <Text style={S.small}>
                                {coverageBackupFitLabel(match.fit)}
                              </Text>
                            </View>
                          </View>

                          {match.declined && (
                            <Txt style={S.small}>
                              This caregiver already declined this request, so
                              automatic escalation will not keep reminding them.
                            </Txt>
                          )}
                          {Boolean(match.overlappingShiftLabel) && (
                            <Txt style={S.small}>
                              Schedule conflict · {match.overlappingShiftLabel}
                            </Txt>
                          )}
                          {Boolean(match.availabilityNote) && (
                            <Txt style={S.small}>
                              Availability note · {match.availabilityNote}
                            </Txt>
                          )}
                        </View>
                      ))
                    )}
                  </Card>

                  {currentUserMatch?.fit === "unavailable_conflict" && (
                    <Txt style={{ color: C.rose }}>
                      Your recorded availability marks part of this window as
                      unavailable. Accept only if your availability has changed.
                    </Txt>
                  )}
                  {currentUserMatch?.fit === "scheduled_conflict" && (
                    <Txt style={{ color: C.rose }}>
                      You already have another scheduled shift overlapping this
                      window, so EnVizion will not let you claim it.
                    </Txt>
                  )}
                </>
              )}

              {request.status === "reserved" && (
                <Card style={{ backgroundColor: "#F0E8F3" }}>
                  <View style={S.row}>
                    <Icon name="checkmark-done-outline" color={C.purple} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={S.h3}>Reserved for weekly approval</Text>
                      <Txt style={S.small}>
                        The care owner included this window in a published weekly
                        plan. The selected caregiver can accept or decline it
                        there. Backup matching resumes automatically if they
                        decline.
                      </Txt>
                    </View>
                  </View>
                  <Button
                    title="Open weekly coverage approval"
                    secondary
                    onPress={() => n.navigate("WeeklyCoveragePlan")}
                  />
                </Card>
              )}

              {request.status === "filled" && (
                <Card style={{ backgroundColor: "#EAF4EF" }}>
                  <View style={S.row}>
                    <Icon name="checkmark-circle-outline" color={C.green} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={S.h3}>
                        Claimed by {memberName(request.claimedBy)}
                      </Text>
                      <Txt style={S.small}>
                        {request.claimedAt
                          ? new Date(request.claimedAt).toLocaleString()
                          : "Coverage accepted"}
                      </Txt>
                      <Txt style={S.small}>
                        The matching scheduled shift was created automatically.
                      </Txt>
                    </View>
                  </View>
                </Card>
              )}

              {request.status === "open" && windowState === "ended" && (
                <Txt style={{ color: C.rose }}>
                  This coverage window has ended and can no longer be claimed.
                </Txt>
              )}

              {myResponse?.response === "declined" && request.status === "open" && (
                <Txt style={S.small}>
                  You declined this request{" "}
                  {new Date(myResponse.respondedAt).toLocaleString()}. You can
                  still accept while it remains open.
                </Txt>
              )}

              {responseRows.length > 0 && request.status === "open" && (
                <Txt style={S.small}>
                  {responseRows.filter((item) => item.response === "declined").length}{" "}
                  caregiver
                  {responseRows.filter((item) => item.response === "declined").length === 1
                    ? ""
                    : "s"}{" "}
                  declined so far.
                </Txt>
              )}

              {canRespond && (
                <View style={{ gap: 8 }}>
                  <Button
                    title={
                      busy === `accepted:${request.id}`
                        ? "Claiming coverage…"
                        : "Accept & claim coverage"
                    }
                    disabled={
                      Boolean(busy) || claimBlockedByScheduledConflict
                    }
                    icon="hand-left-outline"
                    onPress={() => void respond(request, "accepted")}
                  />
                  <Button
                    title={
                      busy === `declined:${request.id}`
                        ? "Declining…"
                        : "Decline"
                    }
                    secondary
                    disabled={Boolean(busy)}
                    onPress={() => void respond(request, "declined")}
                  />
                </View>
              )}

              {canCancel && (
                <Button
                  title={
                    pendingCancelId === request.id
                      ? "Confirm cancellation"
                      : "Cancel coverage request"
                  }
                  secondary
                  disabled={Boolean(busy)}
                  icon="close-circle-outline"
                  onPress={() => void cancel(request)}
                />
              )}
            </Card>
          );
        })
      )}

      <Button
        title="Open Coverage Bridge"
        secondary
        icon="git-compare-outline"
        onPress={() => n.navigate("CareContinuity")}
      />
      <Button
        title="Open caregiver schedule"
        secondary
        icon="calendar-outline"
        onPress={() => n.navigate("CareSchedule")}
      />

      <Txt style={S.small}>
        Coverage requests coordinate recorded caregiver availability. They are
        not emergency dispatch, location tracking, or clinical monitoring.
      </Txt>
    </Page>
  );
}
