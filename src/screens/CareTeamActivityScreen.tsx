import { themeAction } from "../themeColors";
import { themeForeground } from "../themeColors";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  loadCareAuditTrail,
  loadCareTeam,
  loadConsentHistory,
  type CareAuditEvent,
  type CareRole,
  type CareTeamMember,
  type ConsentEvent,
} from "../careTeam";
import {
  buildCareTeamActivity,
  filterCareTeamActivity,
  summarizeCareTeamActivity,
  type CareTeamActivityCategory,
  type CareTeamActivityItem,
} from "../careTeamActivityHelpers";
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

function roleLabel(role: CareRole) {
  return {
    owner: "Primary Advocate",
    caregiver: "Co-Caregiver",
    patient: "Care Recipient",
    viewer: "Family Member",
  }[role];
}

function toneStyle(tone: CareTeamActivityItem["tone"]) {
  if (tone === "green") {
    return { backgroundColor: "#EAF3EE", color: C.green };
  }
  if (tone === "amber") {
    return { backgroundColor: "#FFF4E2", color: themeForeground("#956824") };
  }
  if (tone === "rose") {
    return { backgroundColor: "#FBE8E4", color: C.rose };
  }
  if (tone === "purple") {
    return { backgroundColor: "#F3EAF7", color: C.purple };
  }
  return { backgroundColor: "#F4F1F5", color: "#746C78" };
}

function filterLabel(
  category: "all" | CareTeamActivityCategory,
) {
  if (category === "access") return "Access changes";
  if (category === "activity") return "Workspace activity";
  return "Everything";
}

export function CareTeamActivityScreen() {
  const n = useNav();
  const { state } = useCare();
  const [members, setMembers] = useState<CareTeamMember[]>([]);
  const [consent, setConsent] = useState<ConsentEvent[]>([]);
  const [audit, setAudit] = useState<CareAuditEvent[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [category, setCategory] =
    useState<"all" | CareTeamActivityCategory>("all");
  const [memberUserId, setMemberUserId] = useState<string | null>(null);

  const recipientId = state.careRecipientId;

  async function refresh() {
    if (!recipientId) {
      setMembers([]);
      setConsent([]);
      setAudit([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const [roster, consentRows, auditRows] = await Promise.all([
        loadCareTeam(recipientId),
        loadConsentHistory(recipientId),
        loadCareAuditTrail(recipientId),
      ]);

      setMembers(roster.members);
      setCanManage(roster.canManage);
      setConsent(consentRows);
      setAudit(auditRows);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the care-team activity timeline.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [recipientId]);

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.userId, member.displayName])),
    [members],
  );

  const timeline = useMemo(
    () => buildCareTeamActivity(consent, audit, memberNames),
    [audit, consent, memberNames],
  );

  const filtered = useMemo(
    () => filterCareTeamActivity(timeline, category, memberUserId),
    [category, memberUserId, timeline],
  );

  const summary = useMemo(
    () => summarizeCareTeamActivity(timeline),
    [timeline],
  );

  const selectedMember = memberUserId
    ? members.find((member) => member.userId === memberUserId) ?? null
    : null;

  if (loading && !timeline.length) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading care-team accountability…</Txt>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="ACTIVITY & ACCOUNTABILITY"
        title="See how care access has changed over time."
        body="Review invitations, acceptance, reminders, role changes, revocations and recorded shared-workspace activity in one timeline."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0, gap: 10 }}>
        <View style={S.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[S.eyebrow, { color: "#DDC8E5" }]}>
              {state.careRecipientName || "CARE PROFILE"}
            </Text>
            <Text style={[S.h2, { color: C.white }]}>
              Care access accountability
            </Text>
          </View>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 17,
              backgroundColor: "#FFFFFF14",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="shield-checkmark-outline" size={24} color="#F2E5F5" />
          </View>
        </View>
        <Txt style={{ color: "#E8DCEA" }}>
          {canManage
            ? "As Primary Advocate, you can review the full sharing history available for this care profile."
            : "You will only see access history involving you, plus shared activity permitted by your role."}
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {canManage && (
        <Card
          onPress={() => n.navigate("CareTeamAccessReport")}
          label="Create Care Team Access Report"
          style={{
            backgroundColor: "#FAF7FB",
            borderColor: "#E4D9E8",
            gap: 11,
          }}
        >
          <View style={S.between}>
            <View
              style={{
                width: 46,
                height: 46,
                borderRadius: 17,
                backgroundColor: "#F1E7F5",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="document-text-outline" size={23} color={C.purple} />
            </View>
            <Icon name="chevron-forward" size={20} color={C.purple} />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={S.h2}>Create Care Team Access Report</Text>
            <Txt>
              Export a selected period of care-team access history and current
              roles without exposing clinical details.
            </Txt>
          </View>
        </Card>
      )}

      <Section title="Access history at a glance" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
        {[
          ["Invitations", summary.invitations, "person-add-outline", "#F4ECF8"],
          ["Accepted", summary.accepted, "checkmark-circle-outline", "#EAF3EE"],
          ["Role changes", summary.roleChanges, "swap-horizontal-outline", "#FFF4E2"],
          ["Revoked", summary.revoked, "remove-circle-outline", "#FBE8E4"],
        ].map(([label, value, icon, background]) => (
          <Card
            key={String(label)}
            style={{
              width: "48%",
              minWidth: 145,
              flexGrow: 1,
              gap: 8,
              backgroundColor: String(background),
            }}
          >
            <View style={S.between}>
              <Icon name={String(icon)} size={21} color={C.purple} />
              <Text style={[S.h2, { fontSize: 24 }]}>{String(value)}</Text>
            </View>
            <Text style={S.small}>{String(label)}</Text>
          </Card>
        ))}
      </View>

      <Section title="Filter timeline" />
      <Card style={{ gap: 13 }}>
        <Text style={S.h3}>Event type</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {(["all", "access", "activity"] as const).map((value) => {
            const selected = category === value;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setCategory(value)}
                style={[
                  S.pill,
                  {
                    minHeight: 40,
                    justifyContent: "center",
                    backgroundColor: selected ? themeAction(C.purple) : C.lavender,
                    paddingHorizontal: 13,
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
                  {filterLabel(value)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={S.h3}>Team member</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: memberUserId === null }}
            onPress={() => setMemberUserId(null)}
            style={[
              S.pill,
              {
                minHeight: 40,
                justifyContent: "center",
                backgroundColor:
                  memberUserId === null ? themeAction(C.purple) : C.lavender,
                paddingHorizontal: 13,
              },
            ]}
          >
            <Text
              style={[
                S.small,
                {
                  color: memberUserId === null ? C.white : C.deep,
                  fontFamily: "DMSans_600SemiBold",
                },
              ]}
            >
              Everyone
            </Text>
          </Pressable>

          {members.map((member) => {
            const selected = memberUserId === member.userId;
            return (
              <Pressable
                key={member.userId}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setMemberUserId(member.userId)}
                style={[
                  S.pill,
                  {
                    minHeight: 40,
                    justifyContent: "center",
                    backgroundColor: selected ? themeAction(C.purple) : C.lavender,
                    paddingHorizontal: 13,
                  },
                ]}
              >
                <Text
                  numberOfLines={1}
                  style={[
                    S.small,
                    {
                      color: selected ? C.white : C.deep,
                      fontFamily: "DMSans_600SemiBold",
                    },
                  ]}
                >
                  {member.displayName}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Txt style={S.small}>
          Showing {filtered.length} event{filtered.length === 1 ? "" : "s"}
          {selectedMember
            ? ` involving ${selectedMember.displayName}`
            : ""}
          {category === "all" ? "" : ` · ${filterLabel(category)}`}.
        </Txt>
      </Card>

      <Section
        title="Accountability timeline"
        action="Refresh"
        onPress={() => void refresh()}
      />

      {!filtered.length ? (
        <Card style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
          <Icon name="time-outline" size={30} color={C.purple} />
          <Text style={S.h3}>No matching activity</Text>
          <Txt style={[S.small, { textAlign: "center" }]}>
            Try another team member or event filter.
          </Txt>
        </Card>
      ) : (
        filtered.map((item, index) => {
          const tone = toneStyle(item.tone);
          const actorName = item.actorUserId
            ? memberNames.get(item.actorUserId) ?? "Care team member"
            : "System";
          const subjectName = item.subjectUserId
            ? memberNames.get(item.subjectUserId) ?? "Care team member"
            : null;

          return (
            <View
              key={item.id}
              style={{
                flexDirection: "row",
                gap: 11,
                alignItems: "stretch",
              }}
            >
              <View style={{ width: 42, alignItems: "center" }}>
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 15,
                    backgroundColor: tone.backgroundColor,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={item.icon} size={21} color={tone.color} />
                </View>
                {index < filtered.length - 1 && (
                  <View
                    style={{
                      flex: 1,
                      width: 2,
                      minHeight: 24,
                      marginTop: 5,
                      backgroundColor: "#E8E0EA",
                    }}
                  />
                )}
              </View>

              <Card
                style={{
                  flex: 1,
                  marginBottom: index < filtered.length - 1 ? 4 : 0,
                  gap: 8,
                }}
              >
                <View style={S.between}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={S.h3}>{item.title}</Text>
                    <Text style={S.small}>
                      {new Date(item.createdAt).toLocaleString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      S.pill,
                      { backgroundColor: tone.backgroundColor },
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
                      {item.category === "access" ? "Access" : "Activity"}
                    </Text>
                  </View>
                </View>

                <Txt>{item.detail}</Txt>

                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 7,
                  }}
                >
                  <View style={[S.pill, { backgroundColor: "#F6F2F7" }]}>
                    <Icon name="person-outline" size={13} color={C.purple} />
                    <Text style={S.small}>{actorName}</Text>
                  </View>
                  {subjectName && subjectName !== actorName && (
                    <View style={[S.pill, { backgroundColor: "#F6F2F7" }]}>
                      <Icon
                        name="person-circle-outline"
                        size={13}
                        color={C.purple}
                      />
                      <Text style={S.small}>{subjectName}</Text>
                    </View>
                  )}
                </View>
              </Card>
            </View>
          );
        })
      )}

      <Card style={{ backgroundColor: "#FAF7FB", gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Icon name="information-circle-outline" size={21} color={C.purple} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={S.h3}>What this history represents</Text>
            <Txt style={S.small}>
              Access events record invitation and permission changes. Shared
              activity records actions that EnVizion explicitly audits. This is
              not a complete operating-system, network, or device forensic log.
            </Txt>
          </View>
        </View>
      </Card>

      <Button
        title="Back to Care Team"
        secondary
        icon="people-outline"
        onPress={() => n.navigate("CareTeam")}
      />
    </Page>
  );
}
