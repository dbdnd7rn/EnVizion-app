import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  applyCareTeamSecurityRemediation,
  loadCareTeamSecurityRemediationOptions,
  loadCareTeamSecurityReview,
  type CareTeamSecurityFinding,
  type CareTeamSecurityRemediationOption,
  type CareTeamSecurityRemediationOptions,
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

function severityStyle(severity: CareTeamSecurityFinding["severity"]) {
  if (severity === "critical") {
    return {
      label: "Critical",
      background: "#FBE8E3",
      color: "#B4472D",
    };
  }
  if (severity === "warning") {
    return {
      label: "Warning",
      background: "#FFF3DE",
      color: "#93631D",
    };
  }
  return {
    label: "Review",
    background: "#F1E8F5",
    color: C.purple,
  };
}

function optionTone(option: CareTeamSecurityRemediationOption) {
  return option.destructive
    ? {
        background: "#FFF6F2",
        border: "#EAC8B8",
        color: "#A75538",
        icon: "warning-outline",
      }
    : {
        background: "#F4F8F5",
        border: "#CFE1D5",
        color: C.green,
        icon: "shield-checkmark-outline",
      };
}

export function CareTeamSecurityRemediationScreen() {
  const n = useNav();
  const { state } = useCare();
  const [review, setReview] = useState<CareTeamSecurityReview | null>(null);
  const [preview, setPreview] =
    useState<CareTeamSecurityRemediationOptions | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyFindingId, setBusyFindingId] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
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
          : "We could not load security remediation options.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [primaryAdvocate, recipientId]);

  const selectedOption = useMemo(
    () =>
      preview?.options.find((option) => option.key === selectedKey) ?? null,
    [preview, selectedKey],
  );

  async function previewFinding(finding: CareTeamSecurityFinding) {
    if (!recipientId) return;

    setBusyFindingId(finding.id);
    setMessage("");
    setConfirmed(false);
    setSelectedKey(null);

    try {
      const next = await loadCareTeamSecurityRemediationOptions(
        recipientId,
        finding.id,
      );
      setPreview(next);
      setSelectedKey(next.options.length === 1 ? next.options[0].key : null);
    } catch (error) {
      setPreview(null);
      setMessage(
        error instanceof Error
          ? error.message
          : "No safe automated remediation is available for this finding.",
      );
    } finally {
      setBusyFindingId(null);
    }
  }

  async function applySelected() {
    if (
      !recipientId ||
      !preview ||
      !selectedOption ||
      !confirmed ||
      applying
    ) {
      return;
    }

    setApplying(true);
    setMessage("");

    try {
      const result = await applyCareTeamSecurityRemediation({
        careRecipientId: recipientId,
        findingId: preview.findingId,
        remediationKey: selectedOption.key,
        fingerprint: selectedOption.fingerprint,
      });

      setMessage(
        `${result.memberName}: ${result.before} → ${result.after}. The decision was recorded in accountability history.`,
      );
      setPreview(null);
      setSelectedKey(null);
      setConfirmed(false);
      await refresh();
    } catch (error) {
      setConfirmed(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not apply that remediation.",
      );
    } finally {
      setApplying(false);
    }
  }

  if (!primaryAdvocate) {
    return (
      <Page>
        <Heading
          eyebrow="SECURITY REMEDIATION"
          title="Primary Advocate access required."
          body="Only the person responsible for care-team access can confirm a security remediation."
        />
        <Card>
          <Icon name="shield-outline" size={30} color={C.purple} />
          <Text style={S.h2}>No permission changes are available</Text>
          <Txt>
            Co-Caregivers, Care Recipients and Family Members cannot change
            other people’s access from this center.
          </Txt>
        </Card>
        <Button
          title="Back to Security Review"
          secondary
          onPress={() => n.navigate("CareTeamSecurityReview")}
        />
      </Page>
    );
  }

  if (loading && !review) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Preparing safe remediation options…</Txt>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="SECURITY REMEDIATION CENTER"
        title="Preview every access change before it happens."
        body="EnVizion never silently fixes a permission finding. Review the current state, choose a safe remediation, inspect the before-and-after result, then explicitly confirm it."
      />

      <Card
        style={{
          backgroundColor: C.deep,
          borderWidth: 0,
          gap: 11,
        }}
      >
        <View style={S.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[S.eyebrow, { color: "#DECBE5" }]}>
              SAFE CHANGE CONTROL
            </Text>
            <Text style={[S.h2, { color: C.white }]}>
              No automatic permission changes
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
            <Icon name="lock-closed-outline" size={24} color="#F2E4F6" />
          </View>
        </View>
        <Txt style={{ color: "#EADFED" }}>
          Each remediation is generated from the current server state. If
          access changes after preview, EnVizion blocks the confirmation and
          requires a fresh review.
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {review && review.findings.length === 0 && (
        <Card
          style={{
            alignItems: "center",
            gap: 10,
            paddingVertical: 26,
            backgroundColor: "#F3FAF6",
          }}
        >
          <Icon name="shield-checkmark-outline" size={34} color={C.green} />
          <Text style={S.h2}>No remediation is needed</Text>
          <Txt style={[S.small, { textAlign: "center" }]}>
            The latest automated security review did not find a care-team
            access issue that needs action.
          </Txt>
        </Card>
      )}

      {review && review.findings.length > 0 && (
        <>
          <Section title="Findings ready for review" />
          {review.findings.map((finding) => {
            const severity = severityStyle(finding.severity);
            const previewing = busyFindingId === finding.id;

            return (
              <Card key={finding.id} style={{ gap: 10 }}>
                <View style={S.between}>
                  <View
                    style={[
                      S.pill,
                      { backgroundColor: severity.background },
                    ]}
                  >
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
                  {finding.memberName && (
                    <Text style={S.small}>{finding.memberName}</Text>
                  )}
                </View>

                <View style={{ gap: 5 }}>
                  <Text style={S.h3}>{finding.title}</Text>
                  <Txt>{finding.detail}</Txt>
                </View>

                <Button
                  title={
                    previewing ? "Preparing preview…" : "Preview safe remediation"
                  }
                  secondary
                  disabled={busyFindingId !== null || applying}
                  icon="eye-outline"
                  onPress={() => void previewFinding(finding)}
                />
              </Card>
            );
          })}
        </>
      )}

      {preview && (
        <>
          <Section title="Before & after preview" />
          <Card
            style={{
              backgroundColor: "#FAF7FB",
              borderColor: "#E1D6E5",
              gap: 13,
            }}
          >
            <View style={S.between}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.eyebrow}>TEAM MEMBER</Text>
                <Text style={S.h2}>{preview.memberName}</Text>
              </View>
              <Icon name="git-compare-outline" size={25} color={C.purple} />
            </View>

            {preview.options.length > 1 && (
              <>
                <Text style={S.h3}>Choose the intended outcome</Text>
                <View style={{ gap: 8 }}>
                  {preview.options.map((option) => {
                    const selected = selectedKey === option.key;
                    const tone = optionTone(option);
                    return (
                      <Pressable
                        key={option.key}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        onPress={() => {
                          setSelectedKey(option.key);
                          setConfirmed(false);
                        }}
                        style={{
                          borderRadius: 17,
                          borderWidth: 1,
                          borderColor: selected ? C.purple : tone.border,
                          backgroundColor: selected
                            ? "#F3EAF7"
                            : tone.background,
                          padding: 13,
                          gap: 5,
                        }}
                      >
                        <Text
                          style={[
                            S.h3,
                            { color: selected ? C.purple : C.deep },
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Txt style={S.small}>{option.impact}</Txt>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}

            {selectedOption && (
              <>
                <View
                  style={{
                    borderRadius: 17,
                    backgroundColor: "#F2EEF4",
                    padding: 13,
                    gap: 6,
                  }}
                >
                  <Text style={S.eyebrow}>BEFORE</Text>
                  <Text style={S.h3}>{selectedOption.before}</Text>
                </View>

                <View
                  style={{
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="arrow-down-outline" size={22} color={C.purple} />
                </View>

                <View
                  style={{
                    borderRadius: 17,
                    backgroundColor: selectedOption.destructive
                      ? "#FFF2ED"
                      : "#EDF7F1",
                    padding: 13,
                    gap: 6,
                  }}
                >
                  <Text style={S.eyebrow}>AFTER</Text>
                  <Text style={S.h3}>{selectedOption.after}</Text>
                </View>

                <View style={{ flexDirection: "row", gap: 10 }}>
                  <Icon
                    name={optionTone(selectedOption).icon}
                    size={20}
                    color={optionTone(selectedOption).color}
                  />
                  <Txt style={[S.small, { flex: 1 }]}>
                    {selectedOption.impact}
                  </Txt>
                </View>

                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: confirmed }}
                  onPress={() => setConfirmed((value) => !value)}
                  style={{
                    borderRadius: 17,
                    borderWidth: 1,
                    borderColor: confirmed ? C.purple : "#DCCFDF",
                    backgroundColor: confirmed ? "#F3EAF7" : C.white,
                    padding: 13,
                    flexDirection: "row",
                    gap: 11,
                    alignItems: "flex-start",
                  }}
                >
                  <Icon
                    name={
                      confirmed
                        ? "checkbox-outline"
                        : "square-outline"
                    }
                    size={22}
                    color={confirmed ? C.purple : "#746C78"}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={S.h3}>I reviewed this before-and-after change</Text>
                    <Txt style={S.small}>
                      I understand the effect on {preview.memberName} and want
                      EnVizion to apply this exact remediation.
                    </Txt>
                  </View>
                </Pressable>

                <Button
                  title={applying ? "Applying confirmed change…" : "Confirm & apply change"}
                  disabled={!confirmed || applying}
                  icon="shield-checkmark-outline"
                  onPress={() => void applySelected()}
                />
                <Button
                  title="Cancel preview"
                  secondary
                  disabled={applying}
                  onPress={() => {
                    setPreview(null);
                    setSelectedKey(null);
                    setConfirmed(false);
                  }}
                />
              </>
            )}
          </Card>
        </>
      )}

      <Card style={{ backgroundColor: "#FAF7FB", gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Icon name="information-circle-outline" size={21} color={C.purple} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={S.h3}>Accountability is preserved</Text>
            <Txt style={S.small}>
              Confirmed remediations are recorded in care-team consent and
              activity history. Access reductions also notify the affected team
              member. EnVizion does not apply a remediation merely because a
              finding exists.
            </Txt>
          </View>
        </View>
      </Card>

      <Button
        title={loading ? "Refreshing…" : "Refresh security findings"}
        disabled={loading || applying}
        secondary
        icon="refresh-outline"
        onPress={() => void refresh()}
      />
      <Button
        title="Back to Security Review"
        secondary
        onPress={() => n.navigate("CareTeamSecurityReview")}
      />
    </Page>
  );
}
