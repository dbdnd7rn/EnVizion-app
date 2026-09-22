import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { loadCareAgendaData, type CareAgendaData } from "../careAgenda";
import {
  coordinationConflictCounts,
  coordinationConflictKindLabels,
  coordinationConflictKinds,
  detectCoordinationConflicts,
  type CoordinationConflict,
  type CoordinationConflictKind,
} from "../careCoordinationConflicts";
import {
  addCoordinationComment,
  assignCoordinationConflict,
  loadCoordinationWorkflow,
  reopenCoordinationConflict,
  resolveCoordinationConflict,
  snoozeCoordinationConflict,
  syncCoordinationConflicts,
  type CoordinationHistoryEvent,
  type CoordinationResolution,
  type CoordinationWorkflowData,
} from "../careCoordinationWorkflow";
import {
  coordinationHandlingLabel,
  coordinationHistoryActionLabel,
  currentActionableConflicts,
  currentResolvedConflicts,
  currentSnoozedConflicts,
  effectiveCoordinationStatus,
  resolutionMap,
} from "../careCoordinationWorkflowHelpers";
import { loadCareSchedule } from "../careSchedule";
import {
  loadCareTeam,
  type CareTeamMember,
  type CareTeamRoster,
} from "../careTeam";
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

function horizon(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function conflictIcon(kind: CoordinationConflictKind) {
  if (kind === "shift_overlap") return "copy-outline";
  if (kind === "appointment_double_booking") return "calendar-outline";
  if (kind === "task_without_coverage") return "shield-outline";
  if (kind === "follow_up_collision") return "chatbubbles-outline";
  if (kind === "long_scheduled_day") return "time-outline";
  return "person-remove-outline";
}

function ConflictCard({
  conflict,
  resolution,
  caregiverName,
  commentCount,
  readOnly,
  onManage,
  onOpenSource,
}: {
  conflict: CoordinationConflict;
  resolution: CoordinationResolution | null;
  caregiverName: (userId: string | null) => string;
  commentCount: number;
  readOnly: boolean;
  onManage: () => void;
  onOpenSource: () => void;
}) {
  const urgent = conflict.priority === "time_sensitive";
  const handling = coordinationHandlingLabel(resolution, caregiverName);

  return (
    <Card
      style={{
        borderColor: urgent ? "#E8BDC3" : C.line,
        backgroundColor: urgent ? "#FFF8F7" : C.white,
      }}
    >
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: urgent ? C.redBg : C.lavender,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={conflictIcon(conflict.kind)}
            color={urgent ? C.rose : C.purple}
            size={22}
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={S.between}>
            <Text style={[S.h3, { flex: 1 }]}>{conflict.title}</Text>
            <View
              style={[
                S.pill,
                { backgroundColor: urgent ? C.redBg : C.lavender },
              ]}
            >
              <Text
                style={[
                  S.small,
                  {
                    color: urgent ? C.rose : C.deep,
                    fontFamily: "DMSans_600SemiBold",
                  },
                ]}
              >
                {urgent ? "Time-sensitive" : "Review"}
              </Text>
            </View>
          </View>

          <Txt>{conflict.detail}</Txt>

          <Txt style={S.small}>
            {coordinationConflictKindLabels[conflict.kind]} ·{" "}
            {new Date(conflict.startsAt).toLocaleString()}
          </Txt>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            <View
              style={[
                S.pill,
                {
                  backgroundColor: resolution?.assignedTo
                    ? "#EAF4EF"
                    : "#F3EFF5",
                },
              ]}
            >
              <Txt style={S.small}>{handling}</Txt>
            </View>
            <View style={[S.pill, { backgroundColor: "#F3EFF5" }]}>
              <Txt style={S.small}>
                {commentCount} comment{commentCount === 1 ? "" : "s"}
              </Txt>
            </View>
          </View>
        </View>
      </View>

      <Button
        title={readOnly ? "View coordination" : "Manage coordination"}
        secondary
        icon="people-outline"
        onPress={onManage}
      />
      <Button
        title="Open source record"
        secondary
        icon="arrow-forward-outline"
        onPress={onOpenSource}
      />
    </Card>
  );
}

function HistoryList({
  history,
  caregiverName,
}: {
  history: CoordinationHistoryEvent[];
  caregiverName: (userId: string | null) => string;
}) {
  if (!history.length) {
    return <Txt style={S.small}>No workflow changes have been recorded yet.</Txt>;
  }

  return (
    <View style={{ gap: 8 }}>
      {history
        .slice()
        .reverse()
        .slice(0, 12)
        .map((event) => (
          <View key={event.id} style={{ gap: 2 }}>
            <Text style={[S.h3, { fontSize: 13 }]}>
              {coordinationHistoryActionLabel(event.action)}
              {event.action === "assigned" && event.assignedTo
                ? ` to ${caregiverName(event.assignedTo)}`
                : ""}
            </Text>
            <Txt style={S.small}>
              {event.actorUserId
                ? caregiverName(event.actorUserId)
                : "Former care-team member"}{" "}
              · {new Date(event.createdAt).toLocaleString()}
              {event.snoozedUntil
                ? ` · Until ${new Date(event.snoozedUntil).toLocaleString()}`
                : ""}
            </Txt>
          </View>
        ))}
    </View>
  );
}

function WorkflowPanel({
  conflict,
  resolution,
  comments,
  history,
  assignableMembers,
  caregiverName,
  readOnly,
  busy,
  commentDraft,
  onCommentDraft,
  onAssign,
  onSnooze,
  onResolve,
  onReopen,
  onComment,
  onClose,
}: {
  conflict: CoordinationConflict;
  resolution: CoordinationResolution | null;
  comments: CoordinationWorkflowData["comments"];
  history: CoordinationWorkflowData["history"];
  assignableMembers: CareTeamMember[];
  caregiverName: (userId: string | null) => string;
  readOnly: boolean;
  busy: boolean;
  commentDraft: string;
  onCommentDraft: (value: string) => void;
  onAssign: (userId: string | null) => void;
  onSnooze: (until: Date) => void;
  onResolve: () => void;
  onReopen: () => void;
  onComment: () => void;
  onClose: () => void;
}) {
  const effectiveStatus = effectiveCoordinationStatus(resolution);
  const activeSnooze =
    resolution?.status === "snoozed" &&
    resolution.snoozedUntil &&
    new Date(resolution.snoozedUntil).getTime() > Date.now();

  const tomorrowMorning = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date;
  };

  return (
    <Card style={{ borderColor: "#CDB8D6", backgroundColor: "#FBF8FC" }}>
      <View style={S.between}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={S.eyebrow}>COORDINATION WORKFLOW</Text>
          <Text style={S.h2}>{conflict.title}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close coordination workflow"
          onPress={onClose}
          style={{ minHeight: 44, minWidth: 44, alignItems: "flex-end" }}
        >
          <Icon name="close-outline" />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <View style={[S.pill, { backgroundColor: "#EAF4EF" }]}>
          <Txt style={S.small}>
            {resolution?.assignedTo
              ? coordinationHandlingLabel(resolution, caregiverName)
              : "Unassigned"}
          </Txt>
        </View>
        <View style={[S.pill, { backgroundColor: C.lavender }]}>
          <Txt style={S.small}>
            {activeSnooze
              ? `Snoozed until ${new Date(
                  resolution!.snoozedUntil!,
                ).toLocaleString()}`
              : effectiveStatus === "resolved"
                ? "Resolved"
                : resolution?.status === "snoozed"
                  ? "Snooze ended · open again"
                  : "Open"}
          </Txt>
        </View>
      </View>

      {!readOnly && (
        <>
          <Section title="Who is handling this?" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: !resolution?.assignedTo }}
              disabled={busy}
              onPress={() => onAssign(null)}
              style={[
                S.pill,
                {
                  minHeight: 40,
                  justifyContent: "center",
                  backgroundColor: !resolution?.assignedTo
                    ? C.purple
                    : C.lavender,
                },
              ]}
            >
              <Text
                style={[
                  S.small,
                  {
                    color: !resolution?.assignedTo ? C.white : C.deep,
                    fontFamily: "DMSans_600SemiBold",
                  },
                ]}
              >
                Unassigned
              </Text>
            </Pressable>

            {assignableMembers.map((member) => {
              const selected = resolution?.assignedTo === member.userId;
              return (
                <Pressable
                  key={member.userId}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  disabled={busy}
                  onPress={() => onAssign(member.userId)}
                  style={[
                    S.pill,
                    {
                      minHeight: 40,
                      justifyContent: "center",
                      backgroundColor: selected ? C.purple : C.lavender,
                    },
                  ]}
                >
                  <Text
                    style={[
                      S.small,
                      {
                        color: selected ? C.white : C.deep,
                        fontFamily: "DMSans_600SemiBold",
                      },
                    ]}
                  >
                    {member.isCurrentUser
                      ? `${member.displayName || "Me"} (me)`
                      : member.displayName || "Caregiver"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Section title="Pause or finish" />
          <View style={{ flexDirection: "row", gap: 9, flexWrap: "wrap" }}>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Button
                title="Snooze 2 hours"
                secondary
                disabled={busy}
                icon="time-outline"
                onPress={() =>
                  onSnooze(new Date(Date.now() + 2 * 60 * 60_000))
                }
              />
            </View>
            <View style={{ flex: 1, minWidth: 150 }}>
              <Button
                title="Tomorrow 9 AM"
                secondary
                disabled={busy}
                icon="alarm-outline"
                onPress={() => onSnooze(tomorrowMorning())}
              />
            </View>
          </View>

          {effectiveStatus === "resolved" ? (
            <Button
              title="Reopen coordination item"
              secondary
              disabled={busy}
              icon="refresh-outline"
              onPress={onReopen}
            />
          ) : (
            <Button
              title="Mark resolved"
              disabled={busy}
              icon="checkmark-circle-outline"
              onPress={onResolve}
            />
          )}

          <Section title="Family comment" />
          <Field
            label="Add context for the care team"
            value={commentDraft}
            onChange={onCommentDraft}
            multiline
          />
          <Button
            title={busy ? "Saving…" : "Add comment"}
            secondary
            disabled={busy || !commentDraft.trim()}
            icon="chatbubble-outline"
            onPress={onComment}
          />
        </>
      )}

      <Section title="Conversation" />
      {!comments.length ? (
        <Txt style={S.small}>No family comments yet.</Txt>
      ) : (
        comments.map((comment) => (
          <View key={comment.id} style={{ gap: 3 }}>
            <Text style={[S.h3, { fontSize: 13 }]}>
              {comment.authorUserId
                ? caregiverName(comment.authorUserId)
                : "Former care-team member"}
            </Text>
            <Txt>{comment.body}</Txt>
            <Txt style={S.small}>
              {new Date(comment.createdAt).toLocaleString()}
            </Txt>
          </View>
        ))
      )}

      <Section title="Resolution history" />
      <HistoryList history={history} caregiverName={caregiverName} />

      {readOnly && (
        <Txt style={S.small}>
          Viewer access can read coordination status, comments, and history but
          cannot assign, snooze, resolve, reopen, or add comments.
        </Txt>
      )}
    </Card>
  );
}

export function CareCoordinationInboxScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";

  const [agenda, setAgenda] = useState<CareAgendaData>({
    appointments: [],
    tasks: [],
    shifts: [],
    handoffs: [],
    followUps: [],
  });
  const [schedule, setSchedule] = useState<Awaited<
    ReturnType<typeof loadCareSchedule>
  > | null>(null);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [workflow, setWorkflow] = useState<CoordinationWorkflowData>({
    resolutions: [],
    comments: [],
    history: [],
  });
  const [filters, setFilters] = useState<CoordinationConflictKind[]>([
    ...coordinationConflictKinds,
  ]);
  const [selectedWorkflowKey, setSelectedWorkflowKey] = useState<string | null>(
    null,
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [message, setMessage] = useState("");

  const range = useMemo(() => horizon(), []);

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const [agendaRows, scheduleRows, team] = await Promise.all([
        loadCareAgendaData({
          careRecipientId,
          rangeStartIso: range.startIso,
          rangeEndIso: range.endIso,
        }),
        loadCareSchedule(careRecipientId),
        loadCareTeam(careRecipientId),
      ]);

      const detected = detectCoordinationConflicts({
        agenda: agendaRows,
        shifts: scheduleRows.shifts,
        availability: scheduleRows.availability,
        rangeStart: range.startIso,
        rangeEnd: range.endIso,
      });

      if (!readOnly) {
        await syncCoordinationConflicts(careRecipientId, detected);
      }

      const workflowRows = await loadCoordinationWorkflow(careRecipientId);

      setAgenda(agendaRows);
      setSchedule(scheduleRows);
      setRoster(team);
      setWorkflow(workflowRows);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not check the care plan for coordination conflicts.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, range.endIso, range.startIso, readOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`care-coordination-inbox:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_tasks",
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
          table: "care_communications",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_coordination_resolutions",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_coordination_comments",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_coordination_history",
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

  const assignableMembers = useMemo(
    () =>
      (roster?.members ?? []).filter(
        (member) =>
          member.status === "active" &&
          (member.role === "owner" || member.role === "caregiver"),
      ),
    [roster],
  );

  function caregiverName(userId: string | null) {
    if (!userId) return "Shared care team";
    const member = memberMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? `${member.displayName || "Me"} (me)`
      : member.displayName || "Caregiver";
  }

  const conflicts = useMemo(
    () =>
      schedule
        ? detectCoordinationConflicts({
            agenda,
            shifts: schedule.shifts,
            availability: schedule.availability,
            rangeStart: range.startIso,
            rangeEnd: range.endIso,
          })
        : [],
    [agenda, range.endIso, range.startIso, schedule],
  );

  const conflictMap = useMemo(
    () => new Map(conflicts.map((conflict) => [conflict.id, conflict])),
    [conflicts],
  );
  const resolutionsByConflict = useMemo(
    () => resolutionMap(workflow.resolutions),
    [workflow.resolutions],
  );

  const actionable = useMemo(
    () => currentActionableConflicts(conflicts, workflow.resolutions),
    [conflicts, workflow.resolutions],
  );
  const snoozed = useMemo(
    () => currentSnoozedConflicts(conflicts, workflow.resolutions),
    [conflicts, workflow.resolutions],
  );
  const resolvedCurrent = useMemo(
    () => currentResolvedConflicts(conflicts, workflow.resolutions),
    [conflicts, workflow.resolutions],
  );

  const selectedKinds = useMemo(() => new Set(filters), [filters]);
  const visibleActionable = actionable.filter((conflict) =>
    selectedKinds.has(conflict.kind),
  );
  const visibleSnoozed = snoozed.filter((conflict) =>
    selectedKinds.has(conflict.kind),
  );
  const timeSensitive = visibleActionable.filter(
    (conflict) => conflict.priority === "time_sensitive",
  );
  const review = visibleActionable.filter(
    (conflict) => conflict.priority === "review",
  );
  const counts = coordinationConflictCounts(actionable);

  const resolvedHistory = useMemo(
    () =>
      workflow.resolutions
        .filter(
          (row) =>
            row.status === "resolved" && selectedKinds.has(row.conflictKind),
        )
        .sort(
          (a, b) =>
            new Date(b.resolvedAt ?? b.updatedAt).getTime() -
            new Date(a.resolvedAt ?? a.updatedAt).getTime(),
        )
        .slice(0, 12),
    [selectedKinds, workflow.resolutions],
  );

  const selectedConflict = selectedWorkflowKey
    ? conflictMap.get(selectedWorkflowKey) ?? null
    : null;
  const selectedResolution = selectedWorkflowKey
    ? resolutionsByConflict.get(selectedWorkflowKey) ?? null
    : null;
  const selectedComments = selectedWorkflowKey
    ? workflow.comments.filter(
        (comment) => comment.conflictKey === selectedWorkflowKey,
      )
    : [];
  const selectedHistory = selectedWorkflowKey
    ? workflow.history.filter(
        (event) => event.conflictKey === selectedWorkflowKey,
      )
    : [];

  function toggleFilter(kind: CoordinationConflictKind) {
    setFilters((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind],
    );
  }

  function openWorkflow(conflict: CoordinationConflict) {
    setSelectedWorkflowKey(conflict.id);
    setCommentDraft("");
  }

  async function runWorkflowAction(
    action: () => Promise<unknown>,
    success: string,
  ) {
    if (readOnly || workflowBusy) return;
    setWorkflowBusy(true);
    setMessage("");
    try {
      await action();
      await refresh();
      setMessage(success);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update this coordination item.",
      );
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function assignSelected(userId: string | null) {
    if (!careRecipientId || !selectedConflict) return;
    await runWorkflowAction(
      () =>
        assignCoordinationConflict(
          careRecipientId,
          selectedConflict,
          userId,
        ),
      userId
        ? `Assigned to ${caregiverName(userId)}.`
        : "Assignment cleared.",
    );
  }

  async function snoozeSelected(until: Date) {
    if (!careRecipientId || !selectedConflict) return;
    await runWorkflowAction(
      () =>
        snoozeCoordinationConflict(careRecipientId, selectedConflict, until),
      `Snoozed until ${until.toLocaleString()}.`,
    );
  }

  async function resolveSelected() {
    if (!careRecipientId || !selectedConflict) return;
    await runWorkflowAction(
      () => resolveCoordinationConflict(careRecipientId, selectedConflict),
      "Coordination item marked resolved.",
    );
  }

  async function reopenSelected() {
    if (!careRecipientId || !selectedConflict) return;
    await runWorkflowAction(
      () => reopenCoordinationConflict(careRecipientId, selectedConflict),
      "Coordination item reopened.",
    );
  }

  async function commentSelected() {
    if (!careRecipientId || !selectedConflict || !commentDraft.trim()) return;
    const body = commentDraft;
    await runWorkflowAction(
      () => addCoordinationComment(careRecipientId, selectedConflict, body),
      "Family comment added.",
    );
    setCommentDraft("");
  }

  function openSource(conflict: CoordinationConflict) {
    n.navigate(conflict.fixTarget);
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="NEEDS COORDINATION"
          title="Choose a care profile first."
          body="Coordination checks follow one shared care profile at a time."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="NEEDS COORDINATION"
        title="Catch care-plan collisions—and make it clear who is handling them."
        body="The inbox checks the next seven days, tracks current conflicts for escalation, and adds assignment, comments, snooze, resolution, and a durable change history."
      />

      <Card
        style={{
          backgroundColor: counts.timeSensitive ? C.deep : "#EAF4EF",
          borderWidth: 0,
        }}
      >
        <Text
          style={[
            S.eyebrow,
            { color: counts.timeSensitive ? "#E7CFEF" : C.purple },
          ]}
        >
          NEXT 7 DAYS
        </Text>
        <Text
          style={[
            S.h2,
            { color: counts.timeSensitive ? C.white : C.deep },
          ]}
        >
          {counts.total
            ? `${counts.total} item${counts.total === 1 ? "" : "s"} need coordination`
            : "No active coordination conflicts detected"}
        </Text>
        <Txt style={{ color: counts.timeSensitive ? "#E9DDED" : C.ink }}>
          {counts.timeSensitive} time-sensitive · {counts.review} review ·{" "}
          {snoozed.length} snoozed
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {readOnly && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>
            You can see who is handling an issue, family comments, and resolution
            history, but only Owners and Caregivers can change workflow state.
          </Txt>
        </Card>
      )}

      <Section
        title="Filter inbox"
        action="Refresh"
        onPress={() => void refresh()}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {coordinationConflictKinds.map((kind) => {
          const selected = filters.includes(kind);
          return (
            <Pressable
              key={kind}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => toggleFilter(kind)}
              style={[
                S.pill,
                {
                  minHeight: 40,
                  justifyContent: "center",
                  paddingHorizontal: 11,
                  backgroundColor: selected ? C.purple : C.lavender,
                },
              ]}
            >
              <Text
                style={[
                  S.small,
                  {
                    color: selected ? C.white : C.deep,
                    fontFamily: "DMSans_600SemiBold",
                  },
                ]}
              >
                {coordinationConflictKindLabels[kind]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {selectedConflict && (
        <WorkflowPanel
          conflict={selectedConflict}
          resolution={selectedResolution}
          comments={selectedComments}
          history={selectedHistory}
          assignableMembers={assignableMembers}
          caregiverName={caregiverName}
          readOnly={readOnly}
          busy={workflowBusy}
          commentDraft={commentDraft}
          onCommentDraft={setCommentDraft}
          onAssign={(userId) => void assignSelected(userId)}
          onSnooze={(until) => void snoozeSelected(until)}
          onResolve={() => void resolveSelected()}
          onReopen={() => void reopenSelected()}
          onComment={() => void commentSelected()}
          onClose={() => {
            setSelectedWorkflowKey(null);
            setCommentDraft("");
          }}
        />
      )}

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Checking the shared care plan and family workflow…</Txt>
        </Card>
      ) : !visibleActionable.length && !visibleSnoozed.length ? (
        <Card style={{ backgroundColor: "#EAF4EF" }}>
          <Icon name="checkmark-circle-outline" size={30} />
          <Text style={S.h3}>
            Nothing in the selected filters needs active coordination.
          </Text>
          <Txt>
            This is a planning check, not emergency monitoring. Keep using the
            care team’s normal communication channels for urgent changes.
          </Txt>
        </Card>
      ) : (
        <>
          {timeSensitive.length > 0 && (
            <>
              <Section title="Time-sensitive" />
              {timeSensitive.map((conflict) => (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  resolution={resolutionsByConflict.get(conflict.id) ?? null}
                  caregiverName={caregiverName}
                  commentCount={
                    workflow.comments.filter(
                      (comment) => comment.conflictKey === conflict.id,
                    ).length
                  }
                  readOnly={readOnly}
                  onManage={() => openWorkflow(conflict)}
                  onOpenSource={() => openSource(conflict)}
                />
              ))}
            </>
          )}

          {review.length > 0 && (
            <>
              <Section title="Review when planning" />
              {review.map((conflict) => (
                <ConflictCard
                  key={conflict.id}
                  conflict={conflict}
                  resolution={resolutionsByConflict.get(conflict.id) ?? null}
                  caregiverName={caregiverName}
                  commentCount={
                    workflow.comments.filter(
                      (comment) => comment.conflictKey === conflict.id,
                    ).length
                  }
                  readOnly={readOnly}
                  onManage={() => openWorkflow(conflict)}
                  onOpenSource={() => openSource(conflict)}
                />
              ))}
            </>
          )}

          {visibleSnoozed.length > 0 && (
            <>
              <Section title="Snoozed" />
              {visibleSnoozed.map((conflict) => {
                const resolution =
                  resolutionsByConflict.get(conflict.id) ?? null;
                return (
                  <Card key={conflict.id} style={{ backgroundColor: "#F7F2F8" }}>
                    <View style={S.row}>
                      <Icon name="time-outline" />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={S.h3}>{conflict.title}</Text>
                        <Txt>
                          {resolution?.snoozedUntil
                            ? `Hidden from the active inbox until ${new Date(
                                resolution.snoozedUntil,
                              ).toLocaleString()}.`
                            : "Snoozed"}
                        </Txt>
                        <Txt style={S.small}>
                          {coordinationHandlingLabel(
                            resolution,
                            caregiverName,
                          )}
                        </Txt>
                      </View>
                    </View>
                    <Button
                      title={readOnly ? "View coordination" : "Manage or bring back"}
                      secondary
                      onPress={() => openWorkflow(conflict)}
                    />
                  </Card>
                );
              })}
            </>
          )}
        </>
      )}

      {resolvedHistory.length > 0 && (
        <>
          <Section title="Resolved recently" />
          {resolvedHistory.map((resolution) => {
            const currentConflict =
              conflictMap.get(resolution.conflictKey) ?? null;
            const currentComments = workflow.comments.filter(
              (comment) => comment.conflictKey === resolution.conflictKey,
            );
            return (
              <Card key={resolution.id} style={{ backgroundColor: "#F4F1F4" }}>
                <View style={S.row}>
                  <Icon name="checkmark-circle-outline" color={C.green} />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={S.h3}>{resolution.conflictTitle}</Text>
                    <Txt style={S.small}>
                      Resolved{" "}
                      {resolution.resolvedAt
                        ? new Date(resolution.resolvedAt).toLocaleString()
                        : new Date(resolution.updatedAt).toLocaleString()}
                      {resolution.resolvedBy
                        ? ` · by ${caregiverName(resolution.resolvedBy)}`
                        : ""}
                    </Txt>
                    <Txt style={S.small}>
                      {coordinationHandlingLabel(
                        resolution,
                        caregiverName,
                      )}{" "}
                      · {currentComments.length} comment
                      {currentComments.length === 1 ? "" : "s"}
                    </Txt>
                    {!currentConflict && (
                      <Txt style={S.small}>
                        The source conflict is no longer detected in the current
                        seven-day care plan.
                      </Txt>
                    )}
                  </View>
                </View>

                {currentConflict ? (
                  <Button
                    title={readOnly ? "View resolution history" : "View or reopen"}
                    secondary
                    onPress={() => openWorkflow(currentConflict)}
                  />
                ) : (
                  <HistoryList
                    history={workflow.history.filter(
                      (event) => event.conflictKey === resolution.conflictKey,
                    )}
                    caregiverName={caregiverName}
                  />
                )}
              </Card>
            );
          })}
        </>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="information-circle-outline" />
        <Text style={S.h3}>How EnVizion decides what appears here</Text>
        <Txt>
          Appointment double-booking requires the exact same recorded time.
          Follow-up collisions use a 60-minute planning window. A long scheduled
          day flag appears above 12 scheduled hours in one local day. These are
          coordination heuristics, not clinical, employment, or performance
          judgments.
        </Txt>
        <Txt style={S.small}>
          Workflow comments can contain sensitive family context. They remain
          inside this care profile and follow the same shared-care access rules.
        </Txt>
      </Card>

      <Button
        title="Open family care calendar"
        secondary
        icon="calendar-outline"
        onPress={() => n.navigate("CareCalendar")}
      />
    </Page>
  );
}
