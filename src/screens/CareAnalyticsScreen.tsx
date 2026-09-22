import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  loadCareAnalyticsData,
  recordWeeklyAnalyticsReport,
  type CareAnalyticsData,
} from "../careAnalytics";
import {
  buildCaregiverAnalytics,
  buildWeeklyCoordinationReportHtml,
  formatHours,
  missedCheckInShiftIds,
  scheduledSharePercent,
  weekPeriod,
  weeklyAnalyticsSummary,
} from "../careAnalyticsHelpers";
import {
  loadCareTeam,
  type CareTeamMember,
  type CareTeamRoster,
} from "../careTeam";
import { printHtmlResource } from "../printing";
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

function Bar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <View style={{ gap: 5 }}>
      <View style={S.between}>
        <Txt style={S.small}>{label}</Txt>
        <Txt style={S.small}>{formatHours(value)}</Txt>
      </View>
      <View
        style={{
          height: 8,
          borderRadius: 8,
          backgroundColor: "#ECE5EF",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.round(ratio * 100)}%`,
            minWidth: ratio > 0 ? 4 : 0,
            height: 8,
            borderRadius: 8,
            backgroundColor: C.purple,
          }}
        />
      </View>
    </View>
  );
}

export function CareAnalyticsScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const viewer = state.accessRole === "viewer";

  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<CareAnalyticsData | null>(null);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const period = useMemo(() => weekPeriod(weekOffset), [weekOffset]);

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setLoading(false);
      setData(null);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const [analytics, team] = await Promise.all([
        loadCareAnalyticsData({
          careRecipientId,
          startIso: period.startIso,
          endIso: period.endIso,
        }),
        loadCareTeam(careRecipientId),
      ]);
      setData(analytics);
      setRoster(team);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load this coordination week.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, period.endIso, period.startIso]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const caregivers = useMemo(() => {
    const active =
      roster?.members.filter(
        (member) =>
          (member.role === "owner" || member.role === "caregiver") &&
          member.status !== "revoked",
      ) ?? [];

    const idsFromData = new Set<string>();
    data?.shifts.forEach((item) => idsFromData.add(item.caregiverId));
    data?.attendance.forEach((item) => idsFromData.add(item.caregiverId));
    data?.completions.forEach((item) => {
      if (item.completedBy) idsFromData.add(item.completedBy);
    });
    data?.coverageEvents.forEach((item) => {
      if (item.assignedTo) idsFromData.add(item.assignedTo);
    });

    const map = new Map(active.map((member) => [member.userId, member]));
    idsFromData.forEach((userId) => {
      if (!map.has(userId)) {
        map.set(userId, {
          userId,
          displayName: "Former caregiver",
          email: "",
          role: "caregiver",
          status: "revoked",
          invitedAt: null,
          acceptedAt: null,
          revokedAt: null,
          isCurrentUser: false,
        } as CareTeamMember);
      }
    });

    return Array.from(map.values()).filter(
      (member) =>
        member.role === "owner" ||
        member.role === "caregiver" ||
        idsFromData.has(member.userId),
    );
  }, [data, roster]);

  const caregiverMap = useMemo(
    () => new Map(caregivers.map((member) => [member.userId, member])),
    [caregivers],
  );

  const rows = useMemo(
    () =>
      data
        ? buildCaregiverAnalytics(
            data,
            caregivers.map((member) => member.userId),
            period.startIso,
            period.endIso,
          )
        : [],
    [caregivers, data, period.endIso, period.startIso],
  );

  const summary = useMemo(
    () =>
      data
        ? weeklyAnalyticsSummary(rows, data)
        : {
            scheduledMinutes: 0,
            actualMinutes: 0,
            completedTasks: 0,
            lateCheckIns: 0,
            missedCheckIns: 0,
            coverageGapEvents: 0,
          },
    [data, rows],
  );

  const maxScheduled = useMemo(
    () => Math.max(1, ...rows.map((row) => row.scheduledMinutes)),
    [rows],
  );

  const taskMap = useMemo(
    () => new Map((data?.tasks ?? []).map((task) => [task.id, task])),
    [data],
  );

  const missedShiftIds = useMemo(
    () =>
      new Set(
        data
          ? missedCheckInShiftIds(
              data.shifts,
              data.attendance,
              period.startIso,
              period.endIso,
            )
          : [],
      ),
    [data, period.endIso, period.startIso],
  );

  function caregiverName(userId: string) {
    const member = caregiverMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? `${member.displayName || "Me"} (me)`
      : member.displayName || "Caregiver";
  }

  async function exportReport() {
    if (!careRecipientId || !data || viewer || exporting) return;

    setExporting(true);
    setMessage("");
    try {
      const html = buildWeeklyCoordinationReportHtml({
        careRecipientName: state.careRecipientName || "Care profile",
        periodLabel: period.label,
        generatedAt: new Date().toISOString(),
        rows,
        caregiverName,
        data,
        summary,
      });

      await printHtmlResource("Weekly Family Care Coordination Report", html);
      await recordWeeklyAnalyticsReport(
        careRecipientId,
        period.startIso,
        period.endIso,
      );
      setMessage("Weekly family care report prepared and recorded in the care audit history.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not create the weekly report.",
      );
    } finally {
      setExporting(false);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="CARE COORDINATION ANALYTICS"
          title="Choose a care profile first."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="CAREGIVER WORKLOAD + FAMILY COORDINATION"
        title="Turn care activity into a clear weekly picture."
        body="Review scheduled versus recorded attendance, workload distribution, task completion, check-in reliability, and coverage gaps without turning caregiver coordination into a performance score."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E7CFEF" }]}>REPORTING WEEK</Text>
        <Text style={[S.h2, { color: C.white }]}>{period.label}</Text>
        <Txt style={{ color: "#E9DDED" }}>
          {state.careRecipientName || "Care profile"} ·{" "}
          {weekOffset === 0
            ? "Current week"
            : `${Math.abs(weekOffset)} week${Math.abs(weekOffset) === 1 ? "" : "s"} ago`}
        </Txt>
      </Card>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="Previous week"
            secondary
            icon="chevron-back-outline"
            disabled={loading}
            onPress={() => setWeekOffset((value) => value - 1)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={weekOffset === 0 ? "This week" : "Next week"}
            secondary
            icon={weekOffset === 0 ? "today-outline" : "chevron-forward-outline"}
            disabled={loading || weekOffset === 0}
            onPress={() => setWeekOffset((value) => Math.min(0, value + 1))}
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

      {viewer && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access can review analytics.</Text>
          <Txt>
            Portable weekly report export is limited to the Owner and Caregiver
            roles because it creates a shareable copy of coordination data.
          </Txt>
        </Card>
      )}

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Calculating the weekly coordination picture…</Txt>
        </Card>
      ) : (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[
              ["Scheduled care", formatHours(summary.scheduledMinutes), "calendar-outline"],
              ["Recorded attendance", formatHours(summary.actualMinutes), "time-outline"],
              ["Tasks completed", String(summary.completedTasks), "checkmark-done-outline"],
              ["Late check-ins", String(summary.lateCheckIns), "alarm-outline"],
              ["Missed check-ins", String(summary.missedCheckIns), "warning-outline"],
              ["Coverage gaps", String(summary.coverageGapEvents), "shield-outline"],
            ].map(([label, value, icon]) => (
              <Card
                key={String(label)}
                style={{ flex: 1, minWidth: 135, padding: 15 }}
              >
                <Icon name={String(icon)} size={20} />
                <Text style={[S.h2, { fontSize: 21 }]}>{String(value)}</Text>
                <Txt style={S.small}>{String(label)}</Txt>
              </Card>
            ))}
          </View>

          <Section title="Workload by caregiver" />
          {rows.length ? (
            rows
              .slice()
              .sort((a, b) => b.scheduledMinutes - a.scheduledMinutes)
              .map((row) => {
                const share = scheduledSharePercent(row, rows);
                return (
                  <Card key={row.caregiverId}>
                    <View style={S.between}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={S.h2}>{caregiverName(row.caregiverId)}</Text>
                        <Txt style={S.small}>
                          {share}% of this week’s scheduled caregiver hours
                        </Txt>
                      </View>
                      <View style={[S.pill, { backgroundColor: C.lavender }]}>
                        <Text style={[S.small, { color: C.deep }]}>
                          {row.completedTasks} task
                          {row.completedTasks === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </View>

                    <Bar
                      value={row.scheduledMinutes}
                      max={maxScheduled}
                      label="Scheduled"
                    />
                    <Bar
                      value={row.actualMinutes}
                      max={maxScheduled}
                      label="Recorded attendance"
                    />

                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 8,
                      }}
                    >
                      <View style={[S.pill, { backgroundColor: "#EEF3F1" }]}>
                        <Txt style={S.small}>
                          {row.lateCheckIns} late check-in
                          {row.lateCheckIns === 1 ? "" : "s"}
                        </Txt>
                      </View>
                      <View
                        style={[
                          S.pill,
                          {
                            backgroundColor: row.missedCheckIns
                              ? C.redBg
                              : "#EEF3F1",
                          },
                        ]}
                      >
                        <Txt
                          style={[
                            S.small,
                            { color: row.missedCheckIns ? C.rose : C.deep },
                          ]}
                        >
                          {row.missedCheckIns} missed check-in
                          {row.missedCheckIns === 1 ? "" : "s"}
                        </Txt>
                      </View>
                      <View
                        style={[
                          S.pill,
                          {
                            backgroundColor: row.coverageGapEvents
                              ? "#FFF1E5"
                              : "#EEF3F1",
                          },
                        ]}
                      >
                        <Txt style={S.small}>
                          {row.coverageGapEvents} assigned coverage gap
                          {row.coverageGapEvents === 1 ? "" : "s"}
                        </Txt>
                      </View>
                    </View>

                    {row.lateMinutes > 0 && (
                      <Txt style={S.small}>
                        Total recorded lateness this week: {row.lateMinutes} min.
                      </Txt>
                    )}
                  </Card>
                );
              })
          ) : (
            <Card>
              <Txt>No caregiver workload activity is recorded for this week.</Txt>
            </Card>
          )}

          <Section title="Missed check-in history" />
          {data &&
          data.shifts.some((shift) => missedShiftIds.has(shift.id)) ? (
            data.shifts
              .filter((shift) => missedShiftIds.has(shift.id))
              .map((shift) => (
                <Card key={shift.id} style={{ borderColor: "#E8BDC3" }}>
                  <View style={S.row}>
                    <Icon name="warning-outline" color={C.rose} />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={S.h3}>{caregiverName(shift.caregiverId)}</Text>
                      <Txt style={S.small}>
                        Scheduled {new Date(shift.startsAt).toLocaleString()} →{" "}
                        {new Date(shift.endsAt).toLocaleString()}
                      </Txt>
                      <Txt>
                        No EnVizion “I’m here” check-in was recorded after the
                        scheduled start window.
                      </Txt>
                    </View>
                  </View>
                </Card>
              ))
          ) : (
            <Card style={{ backgroundColor: "#EAF4EF" }}>
              <Icon name="checkmark-circle-outline" />
              <Text style={S.h3}>No missed check-ins detected for this week.</Text>
            </Card>
          )}

          <Section title="Coverage-gap history" />
          {data?.coverageEvents.length ? (
            data.coverageEvents.map((event) => (
              <Card key={event.id}>
                <View style={S.row}>
                  <Icon name="alert-circle-outline" />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={S.h3}>
                      {taskMap.get(event.taskId)?.title || "Care task"}
                    </Text>
                    <Txt style={S.small}>
                      Due {new Date(event.taskDueAt).toLocaleString()}
                      {event.assignedTo
                        ? ` · ${caregiverName(event.assignedTo)}`
                        : " · Shared responsibility"}
                    </Txt>
                    <Txt>
                      Gap detected {new Date(event.detectedAt).toLocaleString()}.
                    </Txt>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Card>
              <Txt>
                No uncovered-task events were recorded for this week.
              </Txt>
            </Card>
          )}

          <Section title="Weekly family care report" />
          <Card>
            <Icon name="document-text-outline" size={28} />
            <Text style={S.h3}>Create a portable coordination summary</Text>
            <Txt>
              The PDF includes team totals, caregiver workload rows, and
              detected coverage gaps for {period.label}.
            </Txt>
            <Txt style={S.small}>
              Attendance data reflects EnVizion check-ins only. It is not
              payroll or verified proof of physical presence. Coverage-gap
              history begins when this analytics feature starts recording those
              events.
            </Txt>
            <Button
              title={exporting ? "Preparing report…" : "Create weekly PDF report"}
              icon="share-outline"
              disabled={viewer || exporting}
              onPress={() => void exportReport()}
            />
          </Card>

          <Button
            title="Open today’s caregiver shift board"
            secondary
            icon="people-outline"
            onPress={() => n.navigate("CareShiftBoard")}
          />
        </>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="information-circle-outline" />
        <Text style={S.h3}>Use trends for coordination, not judgment.</Text>
        <Txt>
          These numbers summarize what EnVizion recorded. Missing check-ins,
          connectivity problems, late data entry, cancelled family plans, or
          care delivered outside the app can change the real-world picture.
        </Txt>
      </Card>
    </Page>
  );
}
