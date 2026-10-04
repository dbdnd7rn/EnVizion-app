import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  loadCareTeamSecurityReview,
  type CareTeamSecurityFinding,
  type CareTeamSecurityReview,
} from "../careTeam";
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

type FindingFilter = "all" | CareTeamSecurityFinding["severity"];

function statusPresentation(
  status: CareTeamSecurityReview["summary"]["status"],
) {
  if (status === "action_required") {
    return {
      label: "Action required",
      icon: "alert-circle-outline",
      background: "#FFF1EC",
      color: "#B84D2F",
      body: "At least one permission conflict could leave access broader than intended.",
    };
  }
  if (status === "attention") {
    return {
      label: "Attention needed",
      icon: "warning-outline",
      background: "#FFF7E8",
      color: "#946824",
      body: "No critical conflict was found, but one or more membership states should be reviewed.",
    };
  }
  if (status === "review") {
    return {
      label: "Review recommended",
      icon: "time-outline",
      background: "#F8F2FA",
      color: C.purple,
      body: "Access looks structurally consistent, but some invitations or inactive access should be checked.",
    };
  }
  return {
    label: "No automated access risks found",
    icon: "shield-checkmark-outline",
    background: "#ECF6F0",
    color: C.green,
    body: "The automated checks did not find a permission, membership, invitation, or stale-access issue.",
  };
}

function severityPresentation(
  severity: CareTeamSecurityFinding["severity"],
) {
  if (severity === "critical") {
    return {
      label: "Critical",
      background: "#FBE8E3",
      color: "#B4472D",
      icon: "alert-circle-outline",
    };
  }
  if (severity === "warning") {
    return {
      label: "Warning",
      background: "#FFF3DE",
      color: "#93631D",
      icon: "warning-outline",
    };
  }
  return {
    label: "Review",
    background: "#F1E8F5",
    color: C.purple,
    icon: "eye-outline",
  };
}

function categoryLabel(category: CareTeamSecurityFinding["category"]) {
  if (category === "permissions") return "Permissions";
  if (category === "invitations") return "Invitations";
  if (category === "activity") return "Access activity";
  return "Membership integrity";
}

export function CareTeamSecurityReviewScreen() {
  const n = useNav();
  const { state } = useCare();
  const [review, setReview] = useState<CareTeamSecurityReview | null>(null);
  const [filter, setFilter] = useState<FindingFilter>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const recipientId = state.careRecipientId;
  const primaryAdvocate = state.accessRole === "owner";

  async function refresh() {
    if (!recipientId || !primaryAdvocate) {
      setReview(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      setReview(await loadCareTeamSecurityReview(recipientId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not complete the care-team security review.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [primaryAdvocate, recipientId]);

  const filteredFindings = useMemo(() => {
    if (!review) return [];
    if (filter === "all") return review.findings;
    return review.findings.filter((finding) => finding.severity === filter);
  }, [filter, review]);

  if (!primaryAdvocate) {
    return (
      <Page>
        <Heading
          eyebrow="CARE TEAM SECURITY"
          title="Primary Advocate access required."
          body="This review compares membership and access records across the care space, so it is limited to the person responsible for care-team access."
        />
        <Card
          style={{
            backgroundColor: "#FFF8F3",
            borderColor: "#EACDBE",
            gap: 10,
          }}
        >
          <Icon name="shield-outline" size={30} color="#A65C3D" />
          <Text style={S.h2}>Security review unavailable</Text>
          <Txt>
            Co-Caregivers, Care Recipients and Family Members cannot inspect
            other members’ access state.
          </Txt>
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

  if (loading && !review) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Checking care-team access…</Txt>
      </Page>
    );
  }

  const status = review
    ? statusPresentation(review.summary.status)
    : statusPresentation("review");

  return (
    <Page>
      <Heading
        eyebrow="CARE TEAM SECURITY REVIEW"
        title="Check whether care access still matches your intentions."
        body="EnVizion compares direct memberships, CareGroup roles, invitation state and recorded access activity to surface access risks for review."
      />

      <Card
        style={{
          backgroundColor: status.background,
          borderColor: status.background,
          gap: 12,
        }}
      >
        <View style={S.between}>
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 18,
              backgroundColor: C.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={status.icon} size={26} color={status.color} />
          </View>
          {review && (
            <View style={[S.pill, { backgroundColor: C.white }]}>
              <Text
                style={[
                  S.small,
                  {
                    color: status.color,
                    fontFamily: "DMSans_600SemiBold",
                  },
                ]}
              >
                {review.summary.total} finding
                {review.summary.total === 1 ? "" : "s"}
              </Text>
            </View>
          )}
        </View>

        <View style={{ gap: 5 }}>
          <Text style={[S.h2, { color: status.color }]}>{status.label}</Text>
          <Txt>{status.body}</Txt>
        </View>

        {review && (
          <Txt style={S.small}>
            Reviewed {new Date(review.reviewedAt).toLocaleString()}
          </Txt>
        )}
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {review && review.summary.total > 0 && (
        <Card
          onPress={() => n.navigate("CareTeamSecurityRemediation")}
          label="Open Security Remediation Center"
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
              <Icon name="git-compare-outline" size={23} color={C.purple} />
            </View>
            <Icon name="chevron-forward" size={20} color={C.purple} />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={S.h2}>Security Remediation Center</Text>
            <Txt>
              Preview safe before-and-after permission changes, then explicitly
              confirm only the fix you intend to apply.
            </Txt>
          </View>
        </Card>
      )}

      {review && (
        <>
          <Section title="Risk summary" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            {[
              ["Critical", review.summary.critical, "#FBE8E3", "#B4472D"],
              ["Warning", review.summary.warning, "#FFF3DE", "#93631D"],
              ["Review", review.summary.review, "#F1E8F5", C.purple],
            ].map(([label, value, background, color]) => (
              <Card
                key={String(label)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: 12,
                  gap: 4,
                  alignItems: "center",
                  backgroundColor: String(background),
                }}
              >
                <Text
                  style={[
                    S.h2,
                    { fontSize: 23, color: String(color) },
                  ]}
                >
                  {String(value)}
                </Text>
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[S.small, { color: String(color) }]}
                >
                  {String(label)}
                </Text>
              </Card>
            ))}
          </View>

          <Section title="Findings" />
          <Card style={{ gap: 11 }}>
            <Text style={S.h3}>Show</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {(["all", "critical", "warning", "review"] as const).map(
                (value) => {
                  const selected = filter === value;
                  const label =
                    value === "all"
                      ? "All findings"
                      : value[0].toUpperCase() + value.slice(1);
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
                },
              )}
            </View>
          </Card>

          {!filteredFindings.length ? (
            <Card
              style={{
                alignItems: "center",
                gap: 10,
                paddingVertical: 24,
                backgroundColor: "#F7FBF8",
              }}
            >
              <Icon
                name="shield-checkmark-outline"
                size={32}
                color={C.green}
              />
              <Text style={S.h3}>Nothing in this filter needs attention</Text>
              <Txt style={[S.small, { textAlign: "center" }]}>
                Change the filter to review another risk level.
              </Txt>
            </Card>
          ) : (
            filteredFindings.map((finding) => {
              const severity = severityPresentation(finding.severity);
              return (
                <Card key={finding.id} style={{ gap: 11 }}>
                  <View style={S.between}>
                    <View
                      style={[
                        S.pill,
                        { backgroundColor: severity.background },
                      ]}
                    >
                      <Icon
                        name={severity.icon}
                        size={14}
                        color={severity.color}
                      />
                      <Text
                        style={[
                          S.small,
                          {
                            color: severity.color,
                            fontFamily: "DMSans_600SemiBold",
                          },
                        ]}
                      >
                        {severity.label}
                      </Text>
                    </View>
                    <Text style={S.small}>
                      {categoryLabel(finding.category)}
                    </Text>
                  </View>

                  <View style={{ gap: 5 }}>
                    <Text style={S.h3}>{finding.title}</Text>
                    {finding.memberName && (
                      <Txt style={S.small}>
                        Team member: {finding.memberName}
                      </Txt>
                    )}
                    <Txt>{finding.detail}</Txt>
                  </View>

                  <View
                    style={{
                      borderRadius: 16,
                      backgroundColor: "#FAF7FB",
                      padding: 12,
                      gap: 5,
                    }}
                  >
                    <Text style={[S.small, { fontFamily: "DMSans_600SemiBold" }]}>
                      Recommended action
                    </Text>
                    <Txt style={S.small}>{finding.recommendation}</Txt>
                  </View>

                  {(finding.category === "permissions" ||
                    finding.category === "integrity" ||
                    finding.category === "invitations") && (
                    <Button
                      title="Open Remediation Center"
                      secondary
                      icon="git-compare-outline"
                      onPress={() => n.navigate("CareTeamSecurityRemediation")}
                    />
                  )}
                </Card>
              );
            })
          )}

          <Section title="Automated checks" />
          <Card style={{ gap: 12 }}>
            {review.checks.map((check) => (
              <View
                key={check}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                }}
              >
                <Icon
                  name="checkmark-circle-outline"
                  size={19}
                  color={C.purple}
                />
                <Txt style={[S.small, { flex: 1 }]}>{check}</Txt>
              </View>
            ))}
          </Card>

          <Card style={{ backgroundColor: "#FAF7FB", gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Icon
                name="information-circle-outline"
                size={21}
                color={C.purple}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.h3}>What this review can and cannot detect</Text>
                <Txt style={S.small}>
                  This review checks EnVizion’s recorded membership, role,
                  invitation and activity state. It does not prove that an
                  account, phone, email address or device has not been
                  compromised, and it is not a full forensic security audit.
                </Txt>
              </View>
            </View>
          </Card>
        </>
      )}

      <Button
        title={loading ? "Reviewing…" : "Run security review again"}
        disabled={loading}
        icon="refresh-outline"
        onPress={() => void refresh()}
      />
      <Button
        title="Back to Care Team"
        secondary
        icon="people-outline"
        onPress={() => n.navigate("CareTeam")}
      />
    </Page>
  );
}
