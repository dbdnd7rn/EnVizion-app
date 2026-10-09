import { themeBackground, themeForeground } from "../themeColors";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  loadAccessGovernanceDashboard,
  recordAccessGovernanceReportGeneration,
  type AccessGovernanceDashboard,
  type AccessGovernanceQueueItem,
  type AccessReviewBucket,
} from "../accessGovernanceAdmin";
import { buildAccessGovernanceReportHtml } from "../accessGovernanceReportHelpers";
import { printHtmlResource } from "../printing";
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

type QueueFilter =
  | "all"
  | "overdue"
  | "due"
  | "upcoming"
  | "scheduled";

function roleLabel(role: "caregiver" | "viewer") {
  return role === "caregiver" ? "Co-Caregiver" : "Family Member";
}

function bucketLabel(bucket: AccessReviewBucket) {
  if (bucket === "overdue_14") return "Overdue 14+ days";
  if (bucket === "overdue_7") return "Overdue 7+ days";
  if (bucket === "due") return "Due now";
  if (bucket === "upcoming_7") return "Due within 7 days";
  return "Scheduled";
}

function bucketTone(bucket: AccessReviewBucket) {
  if (bucket === "overdue_14") {
    return { background: "#FBE8E3", color: "#B4472D" };
  }
  if (bucket === "overdue_7" || bucket === "due") {
    return { background: "#FFF3DE", color: "#93631D" };
  }
  if (bucket === "upcoming_7") {
    return { background: "#F1E8F5", color: C.purple };
  }
  return { background: "#F4F1F5", color: "#746C78" };
}

function decisionLabel(
  value: AccessGovernanceDashboard["recentCompleted"][number]["decision"],
) {
  if (value === "keep") return "Kept access";
  if (value === "change_role") return "Changed role";
  if (value === "revoke") return "Revoked access";
  return "Completed";
}

function statusPresentation(
  status: AccessGovernanceDashboard["summary"]["status"],
) {
  if (status === "action_required") {
    return {
      title: "Action required",
      body: "At least one 90-day access review is severely overdue or an active access record is missing an open recertification.",
      icon: "alert-circle-outline",
      background: "#FFF1EC",
      color: "#B4472D",
    };
  }
  if (status === "attention") {
    return {
      title: "Attention needed",
      body: "One or more access reviews are due or overdue and need Primary Advocate sign-off.",
      icon: "warning-outline",
      background: "#FFF7E8",
      color: "#93631D",
    };
  }
  if (status === "review") {
    return {
      title: "Upcoming access reviews",
      body: "The current access structure is covered, with at least one review due within the next 7 days.",
      icon: "time-outline",
      background: "#F7F0FA",
      color: C.purple,
    };
  }
  return {
    title: "Access governance is current",
    body: "No overdue access recertification or coverage gap is currently recorded.",
    icon: "shield-checkmark-outline",
    background: "#ECF6F0",
    color: C.green,
  };
}

function queueMatchesFilter(
  item: AccessGovernanceQueueItem,
  filter: QueueFilter,
) {
  if (filter === "all") return true;
  if (filter === "overdue") {
    return item.bucket === "overdue_14" || item.bucket === "overdue_7";
  }
  if (filter === "due") return item.bucket === "due";
  if (filter === "upcoming") return item.bucket === "upcoming_7";
  return item.bucket === "scheduled";
}

export function AccessGovernanceAdminScreen() {
  const n = useNav();
  const [dashboard, setDashboard] =
    useState<AccessGovernanceDashboard | null>(null);
  const [filter, setFilter] = useState<QueueFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      setDashboard(await loadAccessGovernanceDashboard());
    } catch (error) {
      setDashboard(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "Access governance could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function exportGovernanceReport() {
    if (!dashboard || exporting) return;

    setExporting(true);
    setMessage("");

    try {
      const html = buildAccessGovernanceReportHtml(dashboard);
      await printHtmlResource("Access Governance Evidence Report", html);
      await recordAccessGovernanceReportGeneration(dashboard.generatedAt);

      setMessage(
        Platform.OS === "web"
          ? "The governance report opened in the print workflow. Choose Save as PDF to keep a copy."
          : "The Access Governance Evidence Report is ready in the share workflow.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not create the governance report.",
      );
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visibleQueue = useMemo(() => {
    if (!dashboard) return [];

    const query = search.trim().toLowerCase();
    return dashboard.queue.filter((item) => {
      if (!queueMatchesFilter(item, filter)) return false;
      if (!query) return true;

      return [
        item.careRecipientName,
        item.primaryAdvocateName,
        item.memberName,
        roleLabel(item.role),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [dashboard, filter, search]);

  if (loading && !dashboard) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading access governance…</Txt>
      </Page>
    );
  }

  if (!dashboard) {
    return (
      <Page>
        <Heading
          eyebrow="ACCESS GOVERNANCE"
          title="Administrator access required."
          body="This dashboard is restricted to active EnVizion administrators."
        />
        <Card>
          <Icon name="shield-outline" size={30} color={C.purple} />
          <Text style={S.h2}>Dashboard unavailable</Text>
          <Txt>{message || "We could not load access governance."}</Txt>
        </Card>
        <Button
          title="Back to Pilot Administration"
          secondary
          onPress={() => n.navigate("PilotAdmin")}
        />
      </Page>
    );
  }

  const status = statusPresentation(dashboard.summary.status);

  return (
    <Page>
      <Heading
        eyebrow="ADMIN ACCESS GOVERNANCE"
        title="See which care-team access reviews are current, due or overdue."
        body="This is a privacy-minimized governance view of 90-day access recertification. It does not expose medications, diagnoses, visit notes, documents or other clinical care data."
      />

      <Card
        style={{
          backgroundColor: status.background,
          borderColor: status.background,
          gap: 11,
        }}
      >
        <View style={S.between}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 18,
              backgroundColor: themeBackground(C.white),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={status.icon} size={26} color={status.color} />
          </View>
          <View style={[S.pill, { backgroundColor: themeBackground(C.white) }]}>
            <Text
              style={[
                S.small,
                {
                  color: status.color,
                  fontFamily: "DMSans_600SemiBold",
                },
              ]}
            >
              {dashboard.summary.openReviews} open
            </Text>
          </View>
        </View>

        <View style={{ gap: 5 }}>
          <Text style={[S.h2, { color: status.color }]}>
            {status.title}
          </Text>
          <Txt>{status.body}</Txt>
        </View>

        <Txt style={S.small}>
          Snapshot generated {new Date(dashboard.generatedAt).toLocaleString()}
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Section title="Governance summary" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
        {[
          [
            "Overdue 14+",
            dashboard.summary.overdue14,
            "#FBE8E3",
            "#B4472D",
          ],
          [
            "Overdue 7+",
            dashboard.summary.overdue7,
            "#FFF3DE",
            "#93631D",
          ],
          ["Due now", dashboard.summary.due, "#FFF8E8", "#93631D"],
          [
            "Coverage gaps",
            dashboard.summary.coverageGaps,
            "#F1E8F5",
            C.purple,
          ],
          [
            "Due within 7d",
            dashboard.summary.upcoming7,
            "#F5EFF8",
            C.purple,
          ],
          [
            "Completed 90d",
            dashboard.summary.completed90Days,
            "#EAF3EE",
            C.green,
          ],
        ].map(([label, value, background, color]) => (
          <Card
            key={String(label)}
            style={{
              width: "31%",
              minWidth: 116,
              flexGrow: 1,
              gap: 4,
              alignItems: "center",
              backgroundColor: String(background),
            }}
          >
            <Text
              style={[
                S.h2,
                { fontSize: 24, color: String(color) },
              ]}
            >
              {String(value)}
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[S.small, { color: String(color), textAlign: "center" }]}
            >
              {String(label)}
            </Text>
          </Card>
        ))}
      </View>

      <Card style={{ backgroundColor: "#FAF7FB", gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Icon name="lock-closed-outline" size={21} color={C.purple} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={S.h3}>Oversight only</Text>
            <Txt style={S.small}>
              Administrators can see recertification status and escalation
              coverage here, but cannot keep, change or revoke a family’s
              care-team access. Those decisions remain with the Primary
              Advocate.
            </Txt>
          </View>
        </View>
      </Card>

      <Section title="Open review queue" />
      <Card style={{ gap: 12 }}>
        <Text style={S.h3}>Search</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Care profile, member or Primary Advocate"
          placeholderTextColor={themeForeground("#918897")}
          autoCapitalize="none"
          style={{
            minHeight: 46,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#DDD2E1",
            backgroundColor: themeBackground(C.white),
            paddingHorizontal: 13,
            color: C.deep,
            fontFamily: "DMSans_400Regular",
          }}
        />

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(
            [
              ["all", "All"],
              ["overdue", "Overdue"],
              ["due", "Due now"],
              ["upcoming", "Next 7 days"],
              ["scheduled", "Scheduled"],
            ] as const
          ).map(([value, label]) => {
            const selected = filter === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setFilter(value)}
                style={[
                  S.pill,
                  {
                    minHeight: 40,
                    justifyContent: "center",
                    paddingHorizontal: 13,
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
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Txt style={S.small}>
          Showing {visibleQueue.length} of {dashboard.queue.length} open
          review{dashboard.queue.length === 1 ? "" : "s"}.
        </Txt>
      </Card>

      {!visibleQueue.length ? (
        <Card
          style={{
            alignItems: "center",
            gap: 10,
            paddingVertical: 24,
          }}
        >
          <Icon name="checkmark-circle-outline" size={31} color={C.green} />
          <Text style={S.h3}>No reviews match this filter</Text>
          <Txt style={[S.small, { textAlign: "center" }]}>
            Change the filter or search term to review another part of the
            queue.
          </Txt>
        </Card>
      ) : (
        visibleQueue.map((item) => {
          const tone = bucketTone(item.bucket);
          return (
            <Card key={item.id} style={{ gap: 10 }}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.h3}>{item.memberName}</Text>
                  <Txt style={S.small}>
                    {roleLabel(item.role)} · {item.careRecipientName}
                  </Txt>
                </View>
                <View
                  style={[
                    S.pill,
                    { backgroundColor: tone.background },
                  ]}
                >
                  <Text
                    style={[
                      S.small,
                      {
                        color: tone.color,
                        fontFamily: "DMSans_600SemiBold",
                      },
                    ]}
                  >
                    {bucketLabel(item.bucket)}
                  </Text>
                </View>
              </View>

              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: "#FAF7FB",
                  padding: 12,
                  gap: 5,
                }}
              >
                <Txt style={S.small}>
                  Primary Advocate: {item.primaryAdvocateName}
                </Txt>
                <Txt style={S.small}>
                  Due: {new Date(item.dueAt).toLocaleString()}
                </Txt>
                {item.overdueDays > 0 && (
                  <Txt style={[S.small, { color: "#A75235" }]}>
                    Overdue by {item.overdueDays} day
                    {item.overdueDays === 1 ? "" : "s"}
                  </Txt>
                )}
              </View>

              {(item.advanceNotifiedAt ||
                item.overdue7NotifiedAt ||
                item.overdue14NotifiedAt) && (
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 7,
                  }}
                >
                  {item.advanceNotifiedAt && (
                    <View style={[S.pill, { backgroundColor: "#F1E8F5" }]}>
                      <Text style={S.small}>Upcoming reminder sent</Text>
                    </View>
                  )}
                  {item.overdue7NotifiedAt && (
                    <View style={[S.pill, { backgroundColor: "#FFF3DE" }]}>
                      <Text style={S.small}>7-day escalation sent</Text>
                    </View>
                  )}
                  {item.overdue14NotifiedAt && (
                    <View style={[S.pill, { backgroundColor: "#FBE8E3" }]}>
                      <Text style={S.small}>14-day escalation sent</Text>
                    </View>
                  )}
                </View>
              )}
            </Card>
          );
        })
      )}

      <Section title="Coverage gaps" />
      {!dashboard.coverageGaps.length ? (
        <Card style={{ backgroundColor: "#F4FAF6" }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <Icon name="shield-checkmark-outline" size={22} color={C.green} />
            <Txt style={{ flex: 1 }}>
              Every eligible active Co-Caregiver and Family Member has an open
              90-day access recertification record.
            </Txt>
          </View>
        </Card>
      ) : (
        dashboard.coverageGaps.map((item) => (
          <Card
            key={item.careRecipientId + ":" + item.subjectUserId}
            style={{
              backgroundColor: "#FFF7F2",
              borderColor: "#EBCFBE",
              gap: 8,
            }}
          >
            <View style={S.between}>
              <Text style={S.h3}>{item.memberName}</Text>
              <View style={[S.pill, { backgroundColor: "#FBE7DA" }]}>
                <Text style={[S.small, { color: "#A65334" }]}>
                  Missing review
                </Text>
              </View>
            </View>
            <Txt>
              {roleLabel(item.role)} · {item.careRecipientName}
            </Txt>
            <Txt style={S.small}>
              Primary Advocate: {item.primaryAdvocateName}
            </Txt>
          </Card>
        ))
      )}

      <Section title="Recent Primary Advocate sign-offs" />
      {!dashboard.recentCompleted.length ? (
        <Card>
          <Txt>No completed access recertifications were recorded in the last 90 days.</Txt>
        </Card>
      ) : (
        dashboard.recentCompleted.slice(0, 20).map((item) => (
          <Card key={item.id} style={{ gap: 7 }}>
            <View style={S.between}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.h3}>{item.memberName}</Text>
                <Txt style={S.small}>
                  {item.careRecipientName} · {decisionLabel(item.decision)}
                  {item.roleAfter
                    ? " · " + roleLabel(item.roleAfter)
                    : ""}
                </Txt>
              </View>
              <Text style={S.small}>
                {item.reviewedAt
                  ? new Date(item.reviewedAt).toLocaleDateString()
                  : ""}
              </Text>
            </View>
            <Txt style={S.small}>
              Signed off by {item.reviewedByName}
            </Txt>
          </Card>
        ))
      )}

      <Card style={{ backgroundColor: "#FAF7FB", gap: 8 }}>
        <Text style={S.h3}>Governance policy</Text>
        <Txt style={S.small}>
          Access is recertified every {dashboard.policy.cadenceDays} days.
          Upcoming attention begins {dashboard.policy.upcomingWindowDays} days
          before due date, with overdue escalation at{" "}
          {dashboard.policy.overdueEscalationDays.join(" and ")} days.
        </Txt>
        <Txt style={S.small}>{dashboard.policy.scope}</Txt>
      </Card>

      <Section title="Governance evidence export" />
      <Card style={{ backgroundColor: "#FAF7FB", gap: 10 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Icon name="document-text-outline" size={22} color={C.purple} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={S.h3}>Privacy-minimized governance report</Text>
            <Txt style={S.small}>
              Export the current recertification queue, coverage gaps,
              recent Primary Advocate sign-offs and governance policy.
              Clinical care details and email addresses are excluded.
            </Txt>
          </View>
        </View>
      </Card>
      <Button
        title={
          exporting
            ? "Creating governance report…"
            : Platform.OS === "web"
              ? "Open governance report & save PDF"
              : "Create & share governance report PDF"
        }
        disabled={exporting || loading}
        icon="document-text-outline"
        onPress={() => void exportGovernanceReport()}
      />
      <Txt style={[S.small, { textAlign: "center" }]}>
        Report generation is recorded in the administrator audit trail.
      </Txt>

      <Button
        title={loading ? "Refreshing…" : "Refresh governance dashboard"}
        disabled={loading || exporting}
        icon="refresh-outline"
        onPress={() => void refresh()}
      />
      <Button
        title="Back to Pilot Administration"
        secondary
        onPress={() => n.navigate("PilotAdmin")}
      />
    </Page>
  );
}
