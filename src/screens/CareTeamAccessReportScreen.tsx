import { themeAction } from "../themeColors";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, Text, View } from "react-native";
import {
  loadCareAccessReportData,
  recordCareAccessReportGeneration,
  type CareAccessReportPeriod,
  type CareTeamMember,
  type ConsentEvent,
} from "../careTeam";
import {
  buildCareAccessReportHtml,
  careAccessReportPeriodLabels,
  careAccessReportSummary,
} from "../careTeamAccessReportHelpers";
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

function roleLabel(role: CareTeamMember["role"]) {
  if (role === "owner") return "Primary Advocate";
  if (role === "caregiver") return "Co-Caregiver";
  if (role === "patient") return "Care Recipient";
  return "Family Member";
}

function statusLabel(member: CareTeamMember) {
  if (member.status === "active") return "Active";
  if (member.status === "declined") return "Declined";
  if (member.status === "revoked") return "Revoked";
  if (member.isExpired) return "Expired";
  return "Invited";
}

const periods: CareAccessReportPeriod[] = [
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "all_recorded_history",
];

export function CareTeamAccessReportScreen() {
  const n = useNav();
  const { state } = useCare();
  const [period, setPeriod] =
    useState<CareAccessReportPeriod>("last_30_days");
  const [members, setMembers] = useState<CareTeamMember[]>([]);
  const [events, setEvents] = useState<ConsentEvent[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");

  const recipientId = state.careRecipientId;

  async function refresh(nextPeriod = period) {
    if (!recipientId) {
      setMembers([]);
      setEvents([]);
      setCanManage(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const data = await loadCareAccessReportData(
        recipientId,
        nextPeriod,
      );
      setMembers(data.members);
      setEvents(data.events);
      setCanManage(data.canManage);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not prepare the access report.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh(period);
  }, [recipientId, period]);

  const summary = useMemo(
    () =>
      careAccessReportSummary({
        careRecipientName: state.careRecipientName || "Care profile",
        generatedAt: new Date().toISOString(),
        period,
        members,
        events,
      }),
    [events, members, period, state.careRecipientName],
  );

  async function exportReport() {
    if (!recipientId || !canManage || exporting) return;

    setExporting(true);
    setMessage("");

    try {
      const html = buildCareAccessReportHtml({
        careRecipientName: state.careRecipientName || "Care profile",
        generatedAt: new Date().toISOString(),
        period,
        members,
        events,
      });

      await printHtmlResource("Care Team Access Report", html);
      await recordCareAccessReportGeneration(recipientId, period);

      setMessage(
        Platform.OS === "web"
          ? "The access report opened in the print workflow. Choose Save as PDF to keep a copy."
          : "The Care Team Access Report PDF is ready in the share workflow.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not create the access report.",
      );
    } finally {
      setExporting(false);
    }
  }

  if (loading && !members.length && !events.length) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Preparing access accountability report…</Txt>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="CARE TEAM ACCESS REPORT"
        title="Create a clean record of who has access and how it changed."
        body="Choose a reporting period, review the current access roster, then create a PDF that contains sharing history without clinical details."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0, gap: 12 }}>
        <View style={S.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[S.eyebrow, { color: "#DECBE5" }]}>
              {state.careRecipientName || "CARE PROFILE"}
            </Text>
            <Text style={[S.h2, { color: C.white }]}>
              Access accountability only
            </Text>
          </View>
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 17,
              backgroundColor: "#FFFFFF14",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="document-lock-outline" size={24} color="#F2E4F6" />
          </View>
        </View>

        <Txt style={{ color: "#EADFED" }}>
          Medications, diagnoses, observations, visit notes, Care Vault
          documents and other clinical details are intentionally excluded.
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {!canManage && !loading ? (
        <Card
          style={{
            backgroundColor: "#FFF8F3",
            borderColor: "#EBCDBD",
            gap: 10,
          }}
        >
          <Icon name="shield-outline" size={28} color="#A65C3D" />
          <Text style={S.h2}>Primary Advocate access required</Text>
          <Txt>
            Full care-team accountability reports can contain information about
            other team members. Only a Primary Advocate can generate this
            report.
          </Txt>
          <Button
            title="Back to Activity Center"
            secondary
            onPress={() => n.navigate("CareTeamActivity")}
          />
        </Card>
      ) : (
        <>
          <Section title="1. Choose reporting period" />
          <Card style={{ gap: 12 }}>
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {periods.map((value) => {
                const selected = period === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    disabled={loading || exporting}
                    onPress={() => setPeriod(value)}
                    style={[
                      S.pill,
                      {
                        minHeight: 42,
                        justifyContent: "center",
                        paddingHorizontal: 13,
                        backgroundColor: selected
                          ? themeAction(C.purple)
                          : C.lavender,
                        opacity: loading || exporting ? 0.65 : 1,
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
                      {careAccessReportPeriodLabels[value]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Txt style={S.small}>
              The role roster is a current snapshot. The event timeline is
              limited to {careAccessReportPeriodLabels[period].toLowerCase()}.
            </Txt>
          </Card>

          <Section title="2. Report preview" />
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 9,
            }}
          >
            {[
              ["Active access", summary.activeMembers, "#EAF3EE"],
              ["Pending", summary.pendingMembers, "#F4ECF8"],
              ["Role changes", summary.roleChanges, "#FFF4E2"],
              ["Revoked", summary.revoked, "#FBE8E4"],
            ].map(([label, value, background]) => (
              <Card
                key={String(label)}
                style={{
                  width: "48%",
                  minWidth: 145,
                  flexGrow: 1,
                  gap: 5,
                  backgroundColor: String(background),
                }}
              >
                <Text style={[S.h2, { fontSize: 25 }]}>
                  {String(value)}
                </Text>
                <Text style={S.small}>{String(label)}</Text>
              </Card>
            ))}
          </View>

          <Card style={{ gap: 9 }}>
            <View style={S.between}>
              <Text style={S.h3}>Recorded access events</Text>
              <View style={[S.pill, { backgroundColor: "#F1E7F5" }]}>
                <Text style={[S.small, { color: C.purple }]}>
                  {summary.totalEvents}
                </Text>
              </View>
            </View>
            <Txt style={S.small}>
              Includes recorded invitations, acceptance or decline, reminders,
              role changes, revocations and re-opened invitations within the
              selected period.
            </Txt>
          </Card>

          <Section title="3. Current access roster" />
          {!members.length ? (
            <Card>
              <Txt>No care-team members are recorded for this profile.</Txt>
            </Card>
          ) : (
            members.map((member) => (
              <Card key={member.userId}>
                <View style={S.between}>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={S.h3}>{member.displayName}</Text>
                    <Txt style={S.small}>{roleLabel(member.role)}</Txt>
                  </View>
                  <View
                    style={[
                      S.pill,
                      {
                        backgroundColor:
                          member.status === "active"
                            ? "#EAF3EE"
                            : member.isExpired
                              ? "#FFF3E6"
                              : "#F3ECF6",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        S.small,
                        {
                          color:
                            member.status === "active"
                              ? C.green
                              : C.deep,
                          fontFamily: "DMSans_600SemiBold",
                        },
                      ]}
                    >
                      {statusLabel(member)}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          )}

          <Section title="4. Create accountability PDF" />
          <Card style={{ backgroundColor: "#FAF7FB", gap: 12 }}>
            <View style={{ flexDirection: "row", gap: 11 }}>
              <Icon name="lock-closed-outline" size={21} color={C.purple} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.h3}>Privacy-minimized export</Text>
                <Txt style={S.small}>
                  The report includes names, roles, access status and recorded
                  access-history events. Email addresses and clinical care
                  content are not included.
                </Txt>
              </View>
            </View>
          </Card>

          <Button
            title={
              exporting
                ? "Creating report…"
                : Platform.OS === "web"
                  ? "Open report & save PDF"
                  : "Create & share report PDF"
            }
            icon="document-text-outline"
            disabled={exporting || loading}
            onPress={() => void exportReport()}
          />

          <Txt style={[S.small, { textAlign: "center" }]}>
            Creating a report is recorded in EnVizion’s care-team activity
            history for accountability.
          </Txt>
        </>
      )}

      <Button
        title="Back to Activity Center"
        secondary
        icon="time-outline"
        onPress={() => n.navigate("CareTeamActivity")}
      />
    </Page>
  );
}
