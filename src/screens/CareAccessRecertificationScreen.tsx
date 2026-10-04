import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  completeCareAccessRecertification,
  loadCareAccessRecertifications,
  type CareAccessRecertificationDecision,
  type CareAccessRecertificationItem,
  type CareAccessRecertificationOverview,
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

function roleLabel(role: CareAccessRecertificationItem["role"]) {
  return role === "caregiver" ? "Co-Caregiver" : "Family Member";
}

function decisionLabel(
  decision: CareAccessRecertificationDecision | null,
) {
  if (decision === "keep") return "Kept";
  if (decision === "change_role") return "Role changed";
  if (decision === "revoke") return "Revoked";
  return "Pending";
}

function dateLabel(value: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString()
    : "Date unavailable";
}

function decisionPresentation(
  decision: CareAccessRecertificationDecision,
) {
  if (decision === "keep") {
    return {
      title: "Keep access",
      icon: "checkmark-circle-outline",
      background: "#EDF7F1",
      color: C.green,
      body: "Confirm that this person still needs the same access.",
    };
  }
  if (decision === "change_role") {
    return {
      title: "Change role",
      icon: "swap-horizontal-outline",
      background: "#F3EAF7",
      color: C.purple,
      body: "Move between Co-Caregiver and Family Member access.",
    };
  }
  return {
    title: "Revoke access",
    icon: "remove-circle-outline",
    background: "#FFF1EC",
    color: "#B24B2E",
    body: "End this person’s access to the care space.",
  };
}

export function CareAccessRecertificationScreen() {
  const n = useNav();
  const { state } = useCare();
  const [overview, setOverview] =
    useState<CareAccessRecertificationOverview | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [decision, setDecision] =
    useState<CareAccessRecertificationDecision | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const recipientId = state.careRecipientId;
  const primaryAdvocate = state.accessRole === "owner";

  async function refresh() {
    if (!recipientId || !primaryAdvocate) {
      setOverview(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      setOverview(await loadCareAccessRecertifications(recipientId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the access recertification schedule.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [primaryAdvocate, recipientId]);

  const due = useMemo(
    () => overview?.items.filter((item) => item.status === "due") ?? [],
    [overview],
  );
  const upcoming = useMemo(
    () =>
      (overview?.items.filter((item) => item.status === "scheduled") ?? [])
        .sort(
          (a, b) =>
            new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime(),
        ),
    [overview],
  );
  const history = useMemo(
    () =>
      (overview?.items.filter((item) => item.status === "completed") ?? [])
        .sort(
          (a, b) =>
            new Date(b.reviewedAt ?? b.dueAt).getTime() -
            new Date(a.reviewedAt ?? a.dueAt).getTime(),
        ),
    [overview],
  );

  const selected = due.find((item) => item.id === selectedId) ?? null;
  const roleAfter =
    selected && decision === "change_role"
      ? selected.role === "caregiver"
        ? "viewer"
        : "caregiver"
      : selected?.role ?? null;

  function chooseReview(item: CareAccessRecertificationItem) {
    setSelectedId(item.id);
    setDecision(null);
    setConfirmed(false);
    setMessage("");
  }

  async function submitDecision() {
    if (
      !recipientId ||
      !selected ||
      !decision ||
      !confirmed ||
      submitting
    ) {
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const result = await completeCareAccessRecertification({
        careRecipientId: recipientId,
        recertificationId: selected.id,
        decision,
        roleAfter: decision === "change_role" ? roleAfter : null,
      });

      setMessage(
        `${selected.displayName}: ${result.before} → ${result.after}. The 90-day access review was signed off and recorded.`,
      );
      setSelectedId(null);
      setDecision(null);
      setConfirmed(false);
      await refresh();
    } catch (error) {
      setConfirmed(false);
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not complete the access review.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!primaryAdvocate) {
    return (
      <Page>
        <Heading
          eyebrow="ACCESS RECERTIFICATION"
          title="Primary Advocate access required."
          body="Only the person responsible for care-team permissions can sign off periodic access reviews."
        />
        <Card>
          <Icon name="shield-outline" size={30} color={C.purple} />
          <Text style={S.h2}>90-day review unavailable</Text>
          <Txt>
            Co-Caregivers, Care Recipients and Family Members cannot approve or
            revoke other team members’ access.
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

  if (loading && !overview) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading 90-day access reviews…</Txt>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="90-DAY ACCESS RECERTIFICATION"
        title="Reconfirm who still needs care-team access."
        body="Every 90 days, active Co-Caregiver and Family Member access is reviewed again. Keep it, change the role, or revoke access with a recorded Primary Advocate sign-off."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0, gap: 11 }}>
        <View style={S.between}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[S.eyebrow, { color: "#DECBE5" }]}>
              PERIODIC ACCESS GOVERNANCE
            </Text>
            <Text style={[S.h2, { color: C.white }]}>
              {overview?.dueCount ?? 0} review
              {(overview?.dueCount ?? 0) === 1 ? "" : "s"} due
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
            <Icon name="calendar-outline" size={24} color="#F2E4F6" />
          </View>
        </View>
        <Txt style={{ color: "#EADFED" }}>
          EnVizion reviews access on a {overview?.cadenceDays ?? 90}-day cadence.
          Primary Advocate ownership and Care Recipient patient access are not
          part of this periodic caregiver/family recertification.
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Section title="Due now" />
      {!due.length ? (
        <Card
          style={{
            alignItems: "center",
            gap: 9,
            paddingVertical: 23,
            backgroundColor: "#F4FAF6",
          }}
        >
          <Icon name="shield-checkmark-outline" size={32} color={C.green} />
          <Text style={S.h3}>No access reviews are due</Text>
          <Txt style={[S.small, { textAlign: "center" }]}>
            Upcoming reviews stay scheduled automatically.
          </Txt>
        </Card>
      ) : (
        due.map((item) => (
          <Card
            key={item.id}
            style={{
              gap: 10,
              borderColor:
                selectedId === item.id ? C.purple : "#E3D9E6",
            }}
          >
            <View style={S.between}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.h3}>{item.displayName}</Text>
                <Txt style={S.small}>
                  {roleLabel(item.role)} · due {dateLabel(item.dueAt)}
                </Txt>
              </View>
              <View style={[S.pill, { backgroundColor: "#FFF3DE" }]}>
                <Text
                  style={[
                    S.small,
                    {
                      color: "#93631D",
                      fontFamily: "DMSans_600SemiBold",
                    },
                  ]}
                >
                  Review due
                </Text>
              </View>
            </View>

            <Button
              title={
                selectedId === item.id
                  ? "Review selected"
                  : "Review this access"
              }
              secondary
              icon="shield-outline"
              onPress={() => chooseReview(item)}
            />
          </Card>
        ))
      )}

      {selected && (
        <>
          <Section title="Sign-off decision" />
          <Card style={{ gap: 13 }}>
            <View style={S.between}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.eyebrow}>TEAM MEMBER</Text>
                <Text style={S.h2}>{selected.displayName}</Text>
                <Txt style={S.small}>
                  Current access · {roleLabel(selected.role)}
                </Txt>
              </View>
              <Icon name="key-outline" size={24} color={C.purple} />
            </View>

            <Text style={S.h3}>Does this person still need access?</Text>

            <View style={{ gap: 9 }}>
              {(["keep", "change_role", "revoke"] as const).map((value) => {
                const presentation = decisionPresentation(value);
                const selectedDecision = decision === value;

                return (
                  <Pressable
                    key={value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: selectedDecision }}
                    onPress={() => {
                      setDecision(value);
                      setConfirmed(false);
                    }}
                    style={{
                      borderRadius: 18,
                      borderWidth: 1,
                      borderColor: selectedDecision
                        ? C.purple
                        : "#DED3E1",
                      backgroundColor: selectedDecision
                        ? presentation.background
                        : C.white,
                      padding: 13,
                      flexDirection: "row",
                      gap: 11,
                      alignItems: "flex-start",
                    }}
                  >
                    <Icon
                      name={presentation.icon}
                      size={21}
                      color={presentation.color}
                    />
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={S.h3}>{presentation.title}</Text>
                      <Txt style={S.small}>{presentation.body}</Txt>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            {decision && (
              <>
                <View
                  style={{
                    borderRadius: 17,
                    backgroundColor: "#F3EEF5",
                    padding: 13,
                    gap: 5,
                  }}
                >
                  <Text style={S.eyebrow}>BEFORE</Text>
                  <Text style={S.h3}>{roleLabel(selected.role)}</Text>
                </View>

                <View style={{ alignItems: "center" }}>
                  <Icon name="arrow-down-outline" size={22} color={C.purple} />
                </View>

                <View
                  style={{
                    borderRadius: 17,
                    backgroundColor:
                      decision === "revoke" ? "#FFF1EC" : "#EDF7F1",
                    padding: 13,
                    gap: 5,
                  }}
                >
                  <Text style={S.eyebrow}>AFTER</Text>
                  <Text style={S.h3}>
                    {decision === "keep"
                      ? roleLabel(selected.role)
                      : decision === "change_role" && roleAfter
                        ? roleLabel(roleAfter)
                        : "Access revoked"}
                  </Text>
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
                    name={confirmed ? "checkbox-outline" : "square-outline"}
                    size={22}
                    color={confirmed ? C.purple : "#746C78"}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={S.h3}>I reviewed this person’s access</Text>
                    <Txt style={S.small}>
                      I confirm that this is the access decision I want to
                      record for {selected.displayName}.
                    </Txt>
                  </View>
                </Pressable>

                <Button
                  title={
                    submitting
                      ? "Recording sign-off…"
                      : "Confirm 90-day access decision"
                  }
                  disabled={!confirmed || submitting}
                  icon="shield-checkmark-outline"
                  onPress={() => void submitDecision()}
                />
                <Button
                  title="Cancel review"
                  secondary
                  disabled={submitting}
                  onPress={() => {
                    setSelectedId(null);
                    setDecision(null);
                    setConfirmed(false);
                  }}
                />
              </>
            )}
          </Card>
        </>
      )}

      <Section title="Upcoming reviews" />
      {!upcoming.length ? (
        <Card>
          <Txt>No upcoming access reviews are scheduled yet.</Txt>
        </Card>
      ) : (
        upcoming.slice(0, 12).map((item) => (
          <Card key={item.id}>
            <View style={S.between}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.h3}>{item.displayName}</Text>
                <Txt style={S.small}>{roleLabel(item.role)}</Txt>
              </View>
              <View style={[S.pill, { backgroundColor: "#F3EAF7" }]}>
                <Text style={[S.small, { color: C.purple }]}>
                  {dateLabel(item.dueAt)}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}

      <Section title="Sign-off history" />
      {!history.length ? (
        <Card>
          <Txt>No completed 90-day access reviews have been recorded yet.</Txt>
        </Card>
      ) : (
        history.slice(0, 20).map((item) => (
          <Card key={item.id} style={{ gap: 7 }}>
            <View style={S.between}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.h3}>{item.displayName}</Text>
                <Txt style={S.small}>
                  {decisionLabel(item.decision)}
                  {item.roleAfter ? ` · ${roleLabel(item.roleAfter)}` : ""}
                </Txt>
              </View>
              <Text style={S.small}>{dateLabel(item.reviewedAt)}</Text>
            </View>
            {item.reviewedByName && (
              <Txt style={S.small}>
                Signed off by {item.reviewedByName}
              </Txt>
            )}
          </Card>
        ))
      )}

      <Card style={{ backgroundColor: "#FAF7FB", gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Icon name="information-circle-outline" size={21} color={C.purple} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={S.h3}>Recorded access governance</Text>
            <Txt style={S.small}>
              Every completed review is written to EnVizion’s access and
              accountability history. Keeping or changing access schedules the
              next review for 90 days later; revoking access closes the cycle.
            </Txt>
          </View>
        </View>
      </Card>

      <Button
        title={loading ? "Refreshing…" : "Refresh access reviews"}
        secondary
        disabled={loading || submitting}
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
