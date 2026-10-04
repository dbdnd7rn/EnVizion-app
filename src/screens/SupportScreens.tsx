import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Switch, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { RootStack } from "../navigation";
import { useCare } from "../store";
import { specialists, trustedResources } from "../content";
import { loadPublishedGuide, type ClinicalContentRecord } from "../clinicalContent";
import {
  Brand,
  Button,
  C,
  Card,
  Field,
  Heading,
  Icon,
  Landscape,
  Page,
  Row,
  S,
  Section,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";
import { printResource } from "../printing";
import { useAuth } from "../auth";
import {
  loadSavedOnboarding,
  saveOnboarding,
  submitCoachingRequest,
  updateFaithPreference,
  setSavedResource,
} from "../backend";
import {
  loadPendingCareInvitations,
  respondToCareInvitation,
  type CareInvitation,
} from "../careTeam";

function invitationRolePresentation(role: CareInvitation["role"]) {
  if (role === "caregiver") {
    return {
      label: "Co-Caregiver",
      icon: "people-circle-outline",
      summary:
        "Help coordinate day-to-day care and keep the shared record current.",
      permissions: [
        ["checkmark-circle-outline", "View and update shared care information"],
        ["calendar-outline", "Coordinate tasks, appointments and schedules"],
        ["document-text-outline", "Review visit summaries and shared documents"],
      ] as const,
      boundary: "You cannot manage Primary Advocate access.",
    };
  }

  if (role === "patient") {
    return {
      label: "Care Recipient",
      icon: "person-circle-outline",
      summary:
        "See the care information being organized for you in one private place.",
      permissions: [
        ["eye-outline", "Review your shared care information"],
        ["medical-outline", "See medicines, appointments and visit summaries"],
        ["shield-checkmark-outline", "Open emergency information and shared documents"],
      ] as const,
      boundary:
        "Your access is read-only. You cannot change care records or permissions.",
    };
  }

  return {
    label: "Family Member",
    icon: "heart-circle-outline",
    summary:
      "Stay informed without changing the clinical or coordination record.",
    permissions: [
      ["eye-outline", "Read family care updates"],
      ["calendar-outline", "See the shared care calendar and tasks"],
      ["document-text-outline", "Open documents shared with your role"],
    ] as const,
    boundary: "Your access is read-only.",
  };
}

export function OnboardingScreen() {
  const n = useNav();
  const { dispatch, refresh } = useCare();
  const [step, setStep] = useState(0);
  const [careMode, setCareMode] = useState<"advocate" | "self" | null>(null);
  const [name, setName] = useState("");
  const [careName, setCareName] = useState("");
  const [relationship, setRelationship] = useState("A parent");
  const [faith, setFaith] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pendingInvite, setPendingInvite] = useState<CareInvitation | null>(null);

  useEffect(() => {
    let active = true;

    loadSavedOnboarding()
      .then(async (saved) => {
        if (!active) return;

        if (saved) {
          dispatch({
            type: "profile",
            name: saved.name,
            relationship: saved.relationship,
            faith: saved.faith,
            careMode: saved.careMode,
          });
          await refresh();
          n.reset({ index: 0, routes: [{ name: "Main" }] });
          return;
        }

        const invitations = await loadPendingCareInvitations();
        if (!active) return;
        setPendingInvite(invitations[0] ?? null);
        setChecking(false);
      })
      .catch(() => {
        if (active) setChecking(false);
      });

    return () => {
      active = false;
    };
  }, [dispatch, n, refresh]);

  async function respondToInvite(response: "accept" | "decline") {
    if (!pendingInvite) return;

    setSaving(true);
    setMessage("");
    try {
      await respondToCareInvitation(pendingInvite.careRecipientId, response);

      if (response === "decline") {
        setPendingInvite(null);
        setMessage("Invitation declined. You can set up your own care profile below.");
        return;
      }

      const saved = await loadSavedOnboarding();
      if (!saved) {
        throw new Error("The shared care profile could not be opened.");
      }

      dispatch({
        type: "profile",
        name: saved.name,
        relationship: saved.relationship,
        faith: saved.faith,
        careMode: saved.careMode,
      });
      await refresh();
      n.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update this care invitation.",
      );
    } finally {
      setSaving(false);
    }
  }

  function chooseMode(mode: "advocate" | "self") {
    setCareMode(mode);
    setMessage("");
    if (mode === "self") {
      setRelationship("Myself");
    } else if (relationship === "Myself") {
      setRelationship("A parent");
    }
  }

  async function finish() {
    setMessage("");

    if (!careMode) {
      setMessage("Choose how you plan to use EnVizion Life.");
      setStep(1);
      return;
    }

    const resolvedRelationship = careMode === "self" ? "Myself" : relationship;
    const resolvedCareName =
      careMode === "self"
        ? careName.trim() || name.trim()
        : careName.trim();

    if (!name.trim() || !resolvedCareName) {
      setMessage(
        careMode === "self"
          ? "Add your name to create your personal care profile."
          : "Add your name and the name of the person you are caring for.",
      );
      return;
    }

    setSaving(true);
    try {
      const saved = await saveOnboarding({
        name,
        careName: resolvedCareName,
        relationship: resolvedRelationship,
        faith,
        careMode,
      });

      dispatch({
        type: "profile",
        name: saved.name,
        relationship: saved.relationship,
        faith: saved.faith,
        careMode: saved.careMode,
      });
      await refresh();
      n.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save your profile. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <Page>
        <Brand />
        <View style={{ minHeight: 360, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading your care profile…</Txt>
        </View>
      </Page>
    );
  }

  if (pendingInvite) {
    const presentation = invitationRolePresentation(pendingInvite.role);
    const invitedAt = pendingInvite.invitedAt
      ? new Date(pendingInvite.invitedAt).toLocaleDateString()
      : "";

    return (
      <Page>
        <View style={S.between}>
          <Brand />
          <View
            style={[
              S.pill,
              {
                backgroundColor: "#F1E8F5",
                paddingHorizontal: 12,
                paddingVertical: 8,
              },
            ]}
          >
            <Icon name="lock-closed-outline" size={14} color={C.purple} />
            <Text style={[S.small, { color: C.purple }]}>PRIVATE INVITATION</Text>
          </View>
        </View>

        <Card
          style={{
            overflow: "hidden",
            borderRadius: 30,
            borderWidth: 0,
            backgroundColor: C.deep,
            padding: 22,
            gap: 16,
          }}
        >
          <View style={S.between}>
            <View
              style={{
                width: 58,
                height: 58,
                borderRadius: 20,
                backgroundColor: "#FFFFFF18",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={presentation.icon} size={30} color="#F4DDFB" />
            </View>
            <View
              style={[
                S.pill,
                {
                  backgroundColor: "#FFFFFF14",
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                },
              ]}
            >
              <Text style={[S.small, { color: "#F2E7F5" }]}>
                {presentation.label}
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[S.eyebrow, { color: "#DCC8E3" }]}>
              INVITED BY {pendingInvite.inviterName.toUpperCase()}
            </Text>
            <Text
              style={[
                S.h2,
                {
                  color: C.white,
                  fontSize: 27,
                  lineHeight: 33,
                },
              ]}
            >
              Join {pendingInvite.careRecipientName}’s care space.
            </Text>
            <Txt style={{ color: "#E8DDEA", fontSize: 14, lineHeight: 21 }}>
              {pendingInvite.inviterName} invited you to EnVizion Life as a{" "}
              {presentation.label}. Nothing is shared with you until you accept.
            </Txt>
          </View>

          {(pendingInvite.relationship || invitedAt) && (
            <View
              style={{
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {Boolean(pendingInvite.relationship) && (
                <View style={[S.pill, { backgroundColor: "#FFFFFF12" }]}>
                  <Icon name="heart-outline" size={14} color="#F0DEEF" />
                  <Text style={[S.small, { color: "#F0DEEF" }]}>
                    {pendingInvite.relationship}
                  </Text>
                </View>
              )}
              {Boolean(invitedAt) && (
                <View style={[S.pill, { backgroundColor: "#FFFFFF12" }]}>
                  <Icon name="calendar-outline" size={14} color="#F0DEEF" />
                  <Text style={[S.small, { color: "#F0DEEF" }]}>
                    Invited {invitedAt}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card>

        <Heading
          eyebrow="YOUR ACCESS"
          title={\`What \${presentation.label} access means\`}
          body={presentation.summary}
        />

        <Card style={{ gap: 14 }}>
          {presentation.permissions.map(([icon, label]) => (
            <View
              key={label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 14,
                  backgroundColor: "#F4ECF8",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={icon} size={20} color={C.purple} />
              </View>
              <Text style={[S.body, { flex: 1 }]}>{label}</Text>
            </View>
          ))}

          <View
            style={{
              marginTop: 2,
              borderRadius: 16,
              backgroundColor: "#FBF7FC",
              padding: 13,
              flexDirection: "row",
              gap: 10,
            }}
          >
            <Icon name="information-circle-outline" size={20} color={C.purple} />
            <Txt style={[S.small, { flex: 1 }]}>{presentation.boundary}</Txt>
          </View>
        </Card>

        <Button
          title={
            saving
              ? "Accepting invitation…"
              : \`Accept as \${presentation.label}\`
          }
          disabled={saving}
          icon="checkmark-circle-outline"
          onPress={() => void respondToInvite("accept")}
        />
        <Button
          title="Decline invitation"
          secondary
          disabled={saving}
          onPress={() => void respondToInvite("decline")}
        />

        {Boolean(message) && (
          <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
            {message}
          </Text>
        )}

        <Txt style={[S.small, { textAlign: "center" }]}>
          You can review this invitation before joining. The Primary Advocate
          controls care-team access and can later change or revoke it.
        </Txt>
      </Page>
    );
  }

  return (
    <Page>
      <View style={S.between}>
        <Brand />
        <Text style={S.small}>WELCOME • {step + 1} / 3</Text>
      </View>

      {step === 0 ? (
        <>
          <View style={{ borderRadius: 28, overflow: "hidden" }}>
            <Landscape height={240} />
          </View>
          <Heading
            eyebrow="FAITH. CLARITY. COMPASSION."
            title={"Care is a journey.\nLet’s walk together."}
            body="A calmer place to organize care, prepare for appointments, coordinate family, and keep important information close."
          />
          <View style={{ gap: 17 }}>
            {[
              [
                "heart-outline",
                "Organize everyday care",
                "Keep medicines, appointments, observations, and tasks together.",
              ],
              [
                "people-outline",
                "Coordinate the people around care",
                "Share the right information with family and caregivers.",
              ],
              [
                "shield-checkmark-outline",
                "Be ready when it matters",
                "Keep important care information easier to find in urgent moments.",
              ],
            ].map(([icon, title, body]) => (
              <View key={title} style={S.row}>
                <Icon name={icon} size={24} />
                <View style={{ flex: 1 }}>
                  <Text style={S.h3}>{title}</Text>
                  <Txt>{body}</Txt>
                </View>
              </View>
            ))}
          </View>
          <Button
            title="Let’s get started"
            icon="arrow-forward"
            onPress={() => setStep(1)}
          />
        </>
      ) : step === 1 ? (
        <>
          <Heading
            eyebrow="CHOOSE YOUR EXPERIENCE"
            title="How will you use EnVizion?"
            body="We’ll personalize the words, dashboard, and care tools around the way you’re using the app."
          />

          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: careMode === "advocate" }}
            accessibilityLabel="Managing care for a loved one"
            onPress={() => chooseMode("advocate")}
            style={({ pressed }) => ({
              position: "relative",
              overflow: "hidden",
              borderRadius: 28,
              borderWidth: careMode === "advocate" ? 2 : 1,
              borderColor: careMode === "advocate" ? C.purple : "#E9E0EC",
              backgroundColor: careMode === "advocate" ? "#F7F0FA" : C.white,
              padding: 20,
              gap: 14,
              opacity: pressed ? 0.86 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <View style={S.between}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  backgroundColor: "#EBDDF3",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="people-outline" size={27} color={C.purple} />
              </View>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: careMode === "advocate" ? C.purple : "#CFC4D3",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: C.white,
                }}
              >
                {careMode === "advocate" && (
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: C.purple,
                    }}
                  />
                )}
              </View>
            </View>
            <View style={{ gap: 5 }}>
              <Text style={[S.h2, { fontSize: 22 }]}>Managing care for a loved one</Text>
              <Txt>
                Coordinate a parent, partner, relative, or another person’s care
                with the people helping you.
              </Txt>
            </View>
          </Pressable>

          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: careMode === "self" }}
            accessibilityLabel="Managing my own care"
            onPress={() => chooseMode("self")}
            style={({ pressed }) => ({
              position: "relative",
              overflow: "hidden",
              borderRadius: 28,
              borderWidth: careMode === "self" ? 2 : 1,
              borderColor: careMode === "self" ? C.purple : "#E9E0EC",
              backgroundColor: careMode === "self" ? "#F7F0FA" : C.white,
              padding: 20,
              gap: 14,
              opacity: pressed ? 0.86 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
            })}
          >
            <View style={S.between}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  backgroundColor: "#FCEAF1",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="person-outline" size={27} color="#B13D70" />
              </View>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  borderWidth: 2,
                  borderColor: careMode === "self" ? C.purple : "#CFC4D3",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: C.white,
                }}
              >
                {careMode === "self" && (
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: C.purple,
                    }}
                  />
                )}
              </View>
            </View>
            <View style={{ gap: 5 }}>
              <Text style={[S.h2, { fontSize: 22 }]}>Managing my own care</Text>
              <Txt>
                Keep your appointments, medicines, questions, care team, and
                important information organized for yourself.
              </Txt>
            </View>
          </Pressable>

          {Boolean(message) && (
            <Text accessibilityRole="alert" style={[S.small, { color: C.rose }]}>
              {message}
            </Text>
          )}

          <Button
            title="Continue"
            icon="arrow-forward"
            disabled={!careMode}
            onPress={() => setStep(2)}
          />
          <Button title="Back" secondary onPress={() => setStep(0)} />
        </>
      ) : (
        <>
          <Heading
            eyebrow={careMode === "self" ? "YOUR CARE PROFILE" : "YOUR FAMILY CARE SPACE"}
            title={
              careMode === "self"
                ? "Make this care space yours."
                : "Tell us who you’re caring for."
            }
            body={
              careMode === "self"
                ? "We’ll use your name throughout your personal care dashboard."
                : "This creates the care profile your family and caregivers can coordinate around."
            }
          />

          <Field
            label="What should we call you?"
            value={name}
            onChange={(value) => {
              setName(value);
              if (careMode === "self" && !careName.trim()) setCareName(value);
            }}
          />

          {careMode === "advocate" ? (
            <>
              <Field
                label="What should we call the person you’re caring for?"
                value={careName}
                onChange={setCareName}
              />
              <Text style={S.h3}>Your relationship to them</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
                {["A parent", "My partner", "A loved one", "A friend"].map((r) => (
                  <Pressable
                    key={r}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: r === relationship }}
                    onPress={() => setRelationship(r)}
                    style={[
                      S.pill,
                      {
                        padding: 14,
                        backgroundColor: r === relationship ? C.purple : C.lavender,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        S.h3,
                        {
                          fontSize: 13,
                          color: r === relationship ? C.white : C.deep,
                        },
                      ]}
                    >
                      {r}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : (
            <Card style={{ backgroundColor: "#F7F1FA" }}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    backgroundColor: "#E9DCF0",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="person-outline" size={23} color={C.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={S.h3}>Personal care profile</Text>
                  <Txt>
                    This profile is for you. You can still invite trusted family
                    or caregivers later.
                  </Txt>
                </View>
              </View>
            </Card>
          )}

          <Card>
            <View style={S.between}>
              <View style={{ flex: 1 }}>
                <Text style={S.h3}>Include spiritual encouragement</Text>
                <Txt>Optional moments of faith on your home screen.</Txt>
              </View>
              <Switch
                accessibilityLabel="Include spiritual encouragement"
                value={faith}
                onValueChange={setFaith}
                trackColor={{ true: C.purple }}
              />
            </View>
          </Card>

          <Txt style={S.small}>
            EnVizion Life helps organize care and educational resources. It does
            not diagnose, monitor emergencies, or replace professional care.
          </Txt>

          {Boolean(message) && (
            <Text accessibilityRole="alert" style={[S.small, { color: C.rose }]}>
              {message}
            </Text>
          )}

          <Button
            title={
              saving
                ? "Saving your care profile…"
                : careMode === "self"
                  ? "Open my care dashboard"
                  : "Open our care space"
            }
            disabled={saving}
            onPress={finish}
          />
          <Button title="Back" secondary disabled={saving} onPress={() => setStep(1)} />
        </>
      )}

      <Text style={[S.small, { textAlign: "center" }]}>
        ENVIZION LIFE • CAREGIVER & PATIENT ADVOCATE SUPPORT
      </Text>
    </Page>
  );
}
export function GuideScreen({
  route,
}: NativeStackScreenProps<RootStack, "Guide">) {
  const { state, dispatch } = useCare();
  const [guide, setGuide] = useState<ClinicalContentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setMessage("");

    loadPublishedGuide(route.params.id)
      .then((record) => {
        if (active) setGuide(record);
      })
      .catch((error) => {
        if (!active) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "We could not load this published guide.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [route.params.id]);

  if (loading) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading published guide…</Txt>
      </Page>
    );
  }

  if (!guide) {
    return (
      <Page>
        <Heading
          eyebrow="CLINICAL CONTENT REVIEW"
          title="This guide is not published yet."
          body="EnVizion Life only shows caregiver education here after it has completed clinical review, approval, and publication."
        />
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="shield-checkmark-outline" size={30} />
          <Text style={S.h3}>Why you’re seeing this</Text>
          <Txt>
            The resource may still be a draft, in clinical review, or awaiting
            publication. This prevents unapproved educational content from being
            presented as finalized guidance.
          </Txt>
        </Card>
        {Boolean(message) && <Txt>{message}</Txt>}
      </Page>
    );
  }

  const g = guide;

  return (
    <Page>
      <Heading eyebrow={g.category} title={g.title} body={g.description} />

      <View style={S.between}>
        <Text style={S.small}>
          {g.readTime} • Published version {g.version}
        </Text>
        <Icon name={g.icon} size={30} />
      </View>

      {g.sections.map((section) => (
        <View key={section.title} style={{ gap: 8 }}>
          <Text style={S.h2}>{section.title}</Text>
          <Txt>{section.body}</Txt>
        </View>
      ))}

      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>Bring it into the conversation</Text>
        <Txt>
          What is one question you want to ask your loved one or healthcare team
          after reading this?
        </Txt>
      </Card>

      <Button
        title={
          state.saved.includes(g.id) ? "Saved to your library" : "Save guide"
        }
        icon={state.saved.includes(g.id) ? "bookmark" : "bookmark-outline"}
        secondary
        onPress={async () => {
          const nextSaved = !state.saved.includes(g.id);
          setMessage("");
          try {
            await setSavedResource(g.id, nextSaved);
            dispatch({ type: "bookmark", id: g.id });
            setMessage(
              nextSaved
                ? "Guide saved to your library."
                : "Guide removed from saved items.",
            );
          } catch (error) {
            setMessage(
              error instanceof Error
                ? error.message
                : "We could not update your saved guides.",
            );
          }
        }}
      />

      <Button
        title="Print or save this resource"
        icon="print-outline"
        onPress={async () => {
          try {
            await printResource(
              g.title,
              g.sections.map((section) => `${section.title}: ${section.body}`),
            );
          } catch {
            setMessage("Printing could not open. Please try again.");
          }
        }}
      />

      {g.url && (
        <Button
          title="Visit the trusted source"
          secondary
          icon="open-outline"
          onPress={() =>
            Linking.openURL(g.url!).catch(() =>
              setMessage("The source could not open. Please try again."),
            )
          }
        />
      )}

      <Txt style={S.small}>
        This EnVizion Life resource has been published through the clinical
        content workflow. It supports education and does not replace an
        individualized care plan.
      </Txt>

      {Boolean(message) && <Txt>{message}</Txt>}
    </Page>
  );
}
export function SpecialistsScreen() {
  const n = useNav();
  return (
    <Page>
      <Heading
        eyebrow="HEALTHCARE NAVIGATION"
        title="Understand your care team"
        body="Different specialists, one shared goal: care for your loved one."
      />
      {specialists.map(([title, subtitle], i) => (
        <Row
          key={title}
          title={title}
          subtitle={subtitle}
          icon={
            [
              "medical-outline",
              "heart-outline",
              "water-outline",
              "leaf-outline",
              "flower-outline",
              "pulse-outline",
              "fitness-outline",
              "body-outline",
            ][i]
          }
          onPress={() => n.navigate("Specialist", { index: i })}
        />
      ))}
    </Page>
  );
}

function SpecialistHeroGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 420 315">
      <Defs>
        <LinearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FBF7FF" />
          <Stop offset="1" stopColor="#EEE3FB" />
        </LinearGradient>
        <LinearGradient id="heart" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFB7D0" />
          <Stop offset="0.55" stopColor="#DB8BDB" />
          <Stop offset="1" stopColor="#9B64D5" />
        </LinearGradient>
        <LinearGradient id="coat" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#F3EEF9" />
        </LinearGradient>
        <LinearGradient id="clipboard" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8C65C5" />
          <Stop offset="1" stopColor="#5D3C9A" />
        </LinearGradient>
        <LinearGradient id="hair" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#51304F" />
          <Stop offset="1" stopColor="#2D1732" />
        </LinearGradient>
      </Defs>

      <Path
        d="M38 268C8 223 21 158 58 111C93 66 148 46 202 55C253 18 333 20 382 62C427 100 437 169 403 221C372 268 319 292 255 292H88C66 292 49 285 38 268Z"
        fill="url(#bg)"
      />

      <Ellipse cx="52" cy="246" rx="20" ry="72" fill="#B998E1" transform="rotate(-32 52 246)" />
      <Ellipse cx="89" cy="250" rx="18" ry="63" fill="#D6C2F0" transform="rotate(22 89 250)" />
      <Ellipse cx="362" cy="233" rx="20" ry="72" fill="#AF8ADC" transform="rotate(24 362 233)" />
      <Ellipse cx="392" cy="257" rx="17" ry="61" fill="#DCC8F1" transform="rotate(32 392 257)" />

      <G>
        <Path
          d="M104 94C104 75 119 63 136 63C152 63 162 73 167 85C172 73 183 63 198 63C216 63 230 75 230 94C230 123 202 145 167 169C133 146 104 124 104 94Z"
          fill="url(#heart)"
        />
        <Path d="M124 111h19l8-19 11 35 10-22 8 11h25" stroke="#FFF" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </G>

      <G transform="translate(50 142)">
        <Rect x="0" y="12" width="97" height="116" rx="15" fill="#FFF" opacity="0.95" />
        <Rect x="34" y="0" width="38" height="22" rx="7" fill="#8E64C2" />
        <Circle cx="53" cy="3" r="6" fill="#F4EFFB" />
        <Path d="M18 45l9 9 17-20" stroke="#8760BE" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M18 77l9 9 17-20" stroke="#8760BE" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Path d="M18 109l9 9 17-20" stroke="#8760BE" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Rect x="51" y="38" width="30" height="7" rx="3.5" fill="#C8B5E3" />
        <Rect x="51" y="70" width="33" height="7" rx="3.5" fill="#D4C6E8" />
        <Rect x="51" y="102" width="26" height="7" rx="3.5" fill="#D4C6E8" />
      </G>

      <G transform="translate(328 78)">
        <Rect x="0" y="0" width="74" height="74" rx="20" fill="#FFF" opacity="0.88" />
        <Path d="M31 16h13v15h15v13H44v15H31V44H16V31h15Z" fill="#9A68CE" />
      </G>

      <G>
        <Path d="M179 122C174 74 205 45 248 47C293 49 322 80 319 125C317 160 303 181 282 198H194C183 179 181 153 179 122Z" fill="url(#hair)" />
        <Path d="M218 101C224 72 249 58 278 68C296 74 308 90 309 108C294 96 281 92 266 93C249 94 236 97 218 101Z" fill="#3E2143" />
        <Circle cx="251" cy="114" r="43" fill="#F1BDA4" />
        <Circle cx="237" cy="114" r="3" fill="#4A324D" />
        <Circle cx="267" cy="114" r="3" fill="#4A324D" />
        <Path d="M242 133C249 139 257 139 266 132" stroke="#C9766D" strokeWidth="3" fill="none" strokeLinecap="round" />
        <Path d="M212 147C205 184 212 221 221 260H307C320 213 319 176 300 147C280 162 232 163 212 147Z" fill="url(#coat)" />
        <Path d="M246 160L258 180L272 160V258H244Z" fill="#B89BE5" />
        <Path d="M219 160L242 176L229 197L240 258H218C209 219 205 185 219 160Z" fill="#FFF" />
        <Path d="M297 160L274 176L287 197L276 258H307C317 218 316 184 297 160Z" fill="#FFF" />
        <Path d="M229 162C214 187 212 214 218 242" stroke="#3D3159" strokeWidth="6" fill="none" strokeLinecap="round" />
        <Path d="M286 162C301 188 302 213 295 240" stroke="#3D3159" strokeWidth="6" fill="none" strokeLinecap="round" />
        <Circle cx="220" cy="244" r="9" fill="#2F2548" />
        <Circle cx="294" cy="242" r="15" fill="#76719A" stroke="#39344F" strokeWidth="5" />
        <Path d="M222 247c11 13 24 15 35 15s22-2 36-14" stroke="#5C5476" strokeWidth="4" fill="none" strokeLinecap="round" />

        <G transform="translate(262 201) rotate(-7 55 48)">
          <Rect x="0" y="0" width="112" height="94" rx="13" fill="url(#clipboard)" />
          <Rect x="40" y="-4" width="42" height="12" rx="6" fill="#69469D" />
          <Rect x="10" y="12" width="92" height="70" rx="9" fill="#7854AE" opacity="0.32" />
        </G>
        <Path d="M269 264c-13-3-24-2-31 3-8 5-8 15 0 22 8 7 21 10 32 8" fill="#F1BDA4" />
      </G>

      <Path d="M365 197c12-27 21-42 35-50-1 22-10 40-35 50Z" fill="#A98BDC" />
      <Path d="M357 223c17-25 29-36 44-40-6 21-18 36-44 40Z" fill="#C8AFE9" />
      <Path d="M351 248c19-22 34-31 48-31-10 19-24 31-48 31Z" fill="#E0C9F2" />
      <Path d="M82 216c-14-24-26-34-41-38 7 19 19 33 41 38Z" fill="#CBB2EA" />
      <Path d="M91 241c-18-21-33-29-48-28 10 18 25 28 48 28Z" fill="#B18EDC" />
    </Svg>
  );
}

export function SpecialistScreen({
  route,
}: NativeStackScreenProps<RootStack, "Specialist">) {
  const n = useNav();
  const item = specialists[route.params.index];

  if (!item)
    return (
      <Page>
        <Heading title="Specialist not found" />
      </Page>
    );

  const questions = [
    {
      text: "What is the next step in our care plan?",
      icon: "chatbubble-ellipses-outline",
      background: "#F1E9FA",
      color: "#74329A",
    },
    {
      text: "What changes should prompt us to call?",
      icon: "call-outline",
      background: "#FBE7F5",
      color: "#8C36A4",
    },
    {
      text: "How will you coordinate with the rest of the care team?",
      icon: "people",
      background: "#F0E8FA",
      color: "#74329A",
    },
  ];

  return (
    <Page>
      <View
        style={{
          minHeight: 236,
          flexDirection: "row",
          alignItems: "center",
          gap: 4,
          overflow: "hidden",
          marginHorizontal: -2,
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: 8,
            paddingTop: 4,
            paddingLeft: 2,
          }}
        >
          <Text
            style={[
              S.eyebrow,
              {
                color: "#74329A",
                fontSize: 10.5,
                letterSpacing: 2.55,
              },
            ]}
          >
            MEET YOUR CARE TEAM
          </Text>

          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 36,
              lineHeight: 41,
              letterSpacing: -0.85,
              color: "#17143D",
            }}
          >
            {item[0]}
          </Text>

          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 15.5,
              lineHeight: 23,
              color: "#747184",
              maxWidth: 180,
            }}
          >
            {item[1]}
          </Text>
        </View>

        <View
          pointerEvents="none"
          style={{
            width: 198,
            height: 214,
            marginRight: -8,
          }}
        >
          <SpecialistHeroGraphic />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Before your visit"
        onPress={() => n.navigate("Appointments")}
        style={({ pressed }) => ({
          minHeight: 136,
          borderRadius: 28,
          paddingHorizontal: 18,
          paddingVertical: 18,
          backgroundColor: "#F7F1FC",
          borderWidth: 1,
          borderColor: "#E7DCEF",
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          opacity: pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.992 : 1 }],
          shadowColor: "#54315F",
          shadowOpacity: 0.065,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 2,
        })}
      >
        <View
          style={{
            width: 78,
            height: 78,
            borderRadius: 24,
            backgroundColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            shadowColor: "#553066",
            shadowOpacity: 0.05,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 5 },
            elevation: 1,
          }}
        >
          <View style={{ position: "relative" }}>
            <Icon name="clipboard-outline" size={39} color="#6F3E9B" />
            <View
              style={{
                position: "absolute",
                right: -9,
                bottom: -8,
                width: 29,
                height: 29,
                borderRadius: 9,
                backgroundColor: "#7D48AA",
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 3,
                borderColor: "#FFFFFF",
              }}
            >
              <Icon name="add" size={18} color="#FFFFFF" />
            </View>
          </View>
        </View>

        <View style={{ flex: 1, gap: 7 }}>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 22,
              lineHeight: 27,
              color: "#17143D",
            }}
          >
            Before your visit
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 14.5,
              lineHeight: 21,
              color: "#777187",
            }}
          >
            {item[2]}
          </Text>
        </View>

        <Icon name="chevron-forward" size={27} color="#76369B" />
      </Pressable>

      <View style={{ gap: 14 }}>
        <Text
          style={{
            fontFamily: "DMSans_700Bold",
            fontSize: 27,
            lineHeight: 33,
            letterSpacing: -0.5,
            color: "#17143D",
          }}
        >
          A few questions to ask
        </Text>

        {questions.map((question) => (
          <Pressable
            key={question.text}
            accessibilityRole="button"
            accessibilityLabel={question.text}
            onPress={() => n.navigate("Appointments")}
            style={({ pressed }) => ({
              minHeight: 91,
              borderRadius: 25,
              paddingHorizontal: 15,
              paddingVertical: 14,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#EEE8F0",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              opacity: pressed ? 0.78 : 1,
              transform: [{ scale: pressed ? 0.99 : 1 }],
              shadowColor: "#3D2649",
              shadowOpacity: 0.035,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 5 },
              elevation: 1,
            })}
          >
            <View
              style={{
                width: 56,
                height: 56,
                borderRadius: 28,
                backgroundColor: question.background,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name={question.icon}
                size={27}
                color={question.color}
              />
            </View>

            <Text
              style={{
                flex: 1,
                fontFamily: "DMSans_500Medium",
                fontSize: 15.5,
                lineHeight: 22,
                color: "#17143D",
              }}
            >
              {question.text}
            </Text>

            <Icon name="chevron-forward" size={24} color="#79349B" />
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open my appointment questions"
        onPress={() => n.navigate("Appointments")}
        style={({ pressed }) => ({
          minHeight: 62,
          borderRadius: 31,
          paddingHorizontal: 22,
          backgroundColor: "#7D38A0",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          opacity: pressed ? 0.84 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
          shadowColor: "#6F2E89",
          shadowOpacity: 0.2,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 4,
        })}
      >
        <Icon name="document-text-outline" size={23} color="#FFFFFF" />
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontFamily: "DMSans_600SemiBold",
            fontSize: 15.5,
            color: "#FFFFFF",
          }}
        >
          Open my appointment questions
        </Text>
        <Icon name="chevron-forward" size={22} color="#FFFFFF" />
      </Pressable>

      <View
        style={{
          position: "relative",
          overflow: "hidden",
          minHeight: 88,
          paddingHorizontal: 10,
          paddingBottom: 14,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: -70,
            right: -70,
            bottom: -62,
            height: 105,
            borderRadius: 70,
            backgroundColor: "#F4ECFB",
            transform: [{ rotate: "-3deg" }],
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: 100,
            right: -110,
            bottom: -72,
            height: 100,
            borderRadius: 70,
            backgroundColor: "#FCECF7",
            transform: [{ rotate: "4deg" }],
          }}
        />

        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: "#EFE4F7",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 1,
          }}
        >
          <Icon name="information-outline" size={20} color="#7A4A94" />
        </View>

        <Text
          style={{
            flex: 1,
            fontFamily: "DMSans_400Regular",
            fontSize: 12.5,
            lineHeight: 18,
            color: "#777187",
          }}
        >
          This guide explains general roles. Your primary care team can help with
          individual referral questions.
        </Text>
      </View>
    </Page>
  );
}
export function CoachingScreen() {
  const { state, dispatch } = useCare();
  const [topic, setTopic] = useState("Navigating care");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setMessage("");
    setSubmitting(true);
    try {
      await submitCoachingRequest(topic);
      dispatch({ type: "coaching", topic });
      setMessage("Your coaching request has been sent to EnVizion Life.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not submit your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="PATIENT ADVOCATE COACHING"
        title="You deserve someone in your corner."
        body="Request support from EnVizion Life for the part of care that feels hardest right now."
      />
      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="people-outline" size={34} />
        <Text style={S.h2}>Clarity, with compassion.</Text>
        <Txt>
          One-on-one and group coaching, healthcare navigation, insurance and
          Medicare education, and spiritual wellness support.
        </Txt>
      </Card>
      <Section title="Where would support help?" />
      {[
        "Navigating care",
        "Hospital to home",
        "Caregiver wellbeing",
        "Insurance & Medicare",
        "Patient rights & planning",
      ].map((t) => (
        <Pressable
          key={t}
          accessibilityRole="radio"
          accessibilityState={{ selected: topic === t }}
          onPress={() => setTopic(t)}
          style={[
            S.card,
            S.row,
            { padding: 16, borderColor: topic === t ? C.purple : C.line },
          ]}
        >
          <Icon name={topic === t ? "radio-button-on" : "radio-button-off"} />
          <Text style={S.h3}>{t}</Text>
        </Pressable>
      ))}
      <Button
        title={submitting ? "Sending request…" : "Request coaching support"}
        disabled={submitting}
        onPress={submit}
      />
      {Boolean(message) && (
        <Card>
          <Icon
            name={state.coaching ? "checkmark-circle" : "alert-circle-outline"}
            color={state.coaching ? C.green : C.rose}
          />
          <Text accessibilityRole="alert" style={S.h3}>
            {message}
          </Text>
          {state.coaching && <Txt>Topic: {state.coaching}</Txt>}
        </Card>
      )}
      <Txt style={S.small}>
        Coaching is educational and supportive. It is not emergency care or a
        medical consultation.
      </Txt>
    </Page>
  );
}
export function WellnessScreen() {
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [reflection, setReflection] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () => setSeconds((s) => Math.min(s + 1, 60)),
      1000,
    );
    return () => clearInterval(timer);
  }, [running]);
  useEffect(() => {
    if (seconds === 60) setRunning(false);
  }, [seconds]);
  return (
    <Page>
      <Heading
        eyebrow="SPIRITUAL WELLNESS"
        title="A quiet moment, just for you."
        body="There is space here for your faith, your feelings, and your need to rest."
      />
      <View style={{ borderRadius: 24, overflow: "hidden" }}>
        <Landscape height={160} />
      </View>
      <Card
        style={{
          backgroundColor: C.lavender,
          alignItems: "center",
          paddingVertical: 30,
        }}
      >
        <Icon name="sparkles-outline" size={28} />
        <Text style={[S.h2, { textAlign: "center" }]}>
          {running
            ? "Rest in this moment."
            : seconds === 60
              ? "A small pause. A fresh start."
              : "You can pause here."}
        </Text>
        <Txt style={{ textAlign: "center" }}>
          Sit comfortably. Let your breathing stay natural.{"\n"}There is
          nothing you need to achieve.
        </Txt>
        <Text style={[S.title, { fontSize: 40 }]}>
          {running ? `${60 - seconds}s` : "1 minute"}
        </Text>
        <Button
          title={running ? "End quiet moment" : "Begin a quiet moment"}
          secondary
          onPress={() => {
            setRunning(!running);
            setSeconds(0);
          }}
        />
      </Card>
      <Text
        style={[S.h2, { textAlign: "center", fontSize: 24, lineHeight: 34 }]}
      >
        “God is our refuge and strength, a very present help in trouble.”
      </Text>
      <Text style={[S.small, { textAlign: "center" }]}>
        PSALM 46:1 • KING JAMES VERSION
      </Text>
      <Field
        label="What is one thing you can set down today?"
        value={reflection}
        onChange={(v) => {
          setReflection(v);
          setSaved(false);
        }}
        multiline
      />
      <Button
        title={
          saved ? "Reflection kept for this visit" : "Keep this reflection"
        }
        disabled={!reflection.trim()}
        secondary
        onPress={() => setSaved(true)}
      />
      <Txt style={S.small}>
        Your reflection stays on this screen during this visit. No reflection is
        sent or stored. Spiritual practices are optional.
      </Txt>
    </Page>
  );
}
export function ResourcesScreen() {
  const [message, setMessage] = useState("");
  return (
    <Page>
      <Heading
        eyebrow="A TRUSTED STARTING POINT"
        title="Resources within reach"
        body="Read online, or take a printable worksheet into your next conversation."
      />
      <Section title="Printable & digital toolkit" />
      {[
        [
          "Daily caregiver record",
          [
            "Date and time: __________",
            "Observations: __________",
            "Medication questions: __________",
            "Who we contacted and next steps: __________",
          ],
        ],
        [
          "Advance care conversation starter",
          [
            "What matters most to me? __________",
            "Who would I want involved? __________",
            "What should we ask a qualified professional? __________",
          ],
        ],
      ].map(([title, lines]) => (
        <Row
          key={title as string}
          title={title as string}
          subtitle="Open print dialog or save as PDF"
          icon="print-outline"
          onPress={async () => {
            try {
              await printResource(title as string, lines as string[]);
            } catch {
              setMessage("Could not open printing. Please try again.");
            }
          }}
        />
      ))}
      <Section title="Trusted organizations" />
      {trustedResources.map((r) => (
        <Row
          key={r.title}
          title={r.title}
          subtitle={r.subtitle}
          icon="globe-outline"
          trailing={<Icon name="open-outline" size={18} />}
          onPress={() =>
            Linking.openURL(r.url).catch(() =>
              setMessage("Could not open this resource. Please try again."),
            )
          }
        />
      ))}
      {Boolean(message) && <Txt>{message}</Txt>}
      <Txt style={S.small}>
        External resources open outside the app. Printable starter sheets are
        educational drafts, not clinical or legal documents.
      </Txt>
    </Page>
  );
}
export function ProfileScreen() {
  const n = useNav();
  const { state, dispatch } = useCare();
  const { user, signOut } = useAuth();
  const [message, setMessage] = useState("");

  async function changeFaith(faith: boolean) {
    dispatch({
      type: "profile",
      name: state.name,
      relationship: state.relationship,
      faith,
    });

    try {
      await updateFaithPreference(faith);
      setMessage("Preference saved.");
    } catch {
      setMessage("Could not save that preference. Please try again.");
    }
  }

  return (
    <Page>
      <Heading
        eyebrow={state.careMode === "self" ? "YOUR CARE DASHBOARD" : "YOUR CARE COMPANION"}
        title={`Hello, ${state.name}.`}
        body={
          state.careMode === "self"
            ? "Your care information, preferences, and support settings live here."
            : `You’re here caring for ${state.relationship.toLowerCase()}.`
        }
      />

      <Card>
        <Text style={S.h3}>Your account</Text>
        <Txt>{user?.email ?? "Signed in"}</Txt>
        <Txt>
          {state.careMode === "self"
            ? "Your personal care profile is connected to your EnVizion Life account."
            : "Your advocate profile is connected to your EnVizion Life account."}
        </Txt>
      </Card>

      <Card>
        <Text style={S.h3}>Your care activity</Text>
        <Txt>
          {state.entries.length} care observations · {state.saved.length} saved
          resources
        </Txt>
        <Txt>
          Your observations, medications, appointments, transition checklist,
          and saved resources are connected to your secure account.
        </Txt>
      </Card>

      <Row
        title="Care team & sharing"
        subtitle={`${state.careRecipientName || "Care profile"} · ${state.accessRole === "owner" ? "Primary Advocate" : state.accessRole === "caregiver" ? "Co-Caregiver" : state.accessRole === "patient" ? "Care Recipient" : "Family Member"} access`}
        icon="people-outline"
        onPress={() => n.navigate("CareTeam")}
      />

      <Row
        title="Care contacts & providers"
        subtitle="Doctors, specialists, pharmacy, insurance, and care services"
        icon="call-outline"
        onPress={() => n.navigate("CareContacts")}
      />

      <Row
        title="Care notes & communication log"
        subtitle="Shared calls, outcomes, decisions, and follow-ups for this care profile"
        icon="chatbubbles-outline"
        onPress={() => n.navigate("CareCommunicationLog")}
      />

      <Row
        title="Today & caregiver shift board"
        subtitle="Today’s coverage, overdue responsibilities, and caregiver handoffs"
        icon="people-outline"
        onPress={() => n.navigate("CareShiftBoard")}
      />

      <Row
        title="Caregiver availability & schedule"
        subtitle="Availability, shifts, check-ins, attendance, swaps, and coverage gaps"
        icon="calendar-outline"
        onPress={() => n.navigate("CareSchedule")}
      />

      <Row
        title="Care coordination analytics"
        subtitle="Weekly workload, attendance, completed tasks, and coverage gaps"
        icon="bar-chart-outline"
        onPress={() => n.navigate("CareAnalytics")}
      />

      <Row
        title="Needs coordination"
        subtitle="Review schedule overlaps, uncovered tasks, and planning conflicts"
        icon="warning-outline"
        onPress={() => n.navigate("CareCoordinationInbox")}
      />

      <Row
        title="Care tasks & shared care plan"
        subtitle="Responsibilities, assignments, due dates, and completion history"
        icon="checkbox-outline"
        onPress={() => n.navigate("CareTasks")}
      />

      <Row
        title="Account, privacy & data"
        subtitle="Password, exports, consent and deletion controls"
        icon="shield-checkmark-outline"
        onPress={() => n.navigate("PrivacyData")}
      />

      <Row
        title="Accessibility & display"
        subtitle="Text scaling, reduced motion, screen-reader support, and touch targets"
        icon="accessibility-outline"
        onPress={() => n.navigate("Accessibility")}
      />

      <Row
        title="Pilot launch validation"
        subtitle="Run role, device and recovery checks for an active pilot wave"
        icon="flag-outline"
        onPress={() => n.navigate("LaunchValidation")}
      />

      <Row
        title="Pilot feedback"
        subtitle="Report bugs, share your experience, or suggest improvements"
        icon="chatbubble-ellipses-outline"
        onPress={() => n.navigate("PilotFeedback")}
      />

      <Row
        title="Notification preferences"
        subtitle="Push updates, quiet hours, and alert categories"
        icon="notifications-outline"
        onPress={() => n.navigate("NotificationSettings")}
      />

      <Card>
        <View style={S.between}>
          <Text style={[S.h3, { flex: 1 }]}>
            Spiritual encouragement on home
          </Text>
          <Switch
            accessibilityLabel="Spiritual encouragement on home"
            value={state.faith}
            onValueChange={changeFaith}
            trackColor={{ true: C.purple }}
          />
        </View>
      </Card>

      {Boolean(message) && <Txt style={S.small}>{message}</Txt>}

      <Button
        title="Sign out"
        secondary
        onPress={() => {
          void signOut();
        }}
      />

      <Txt style={S.small}>
        EnVizion Life Caregiver Toolkit & Patient Advocate Support Program.
        Founded by Dr. Delphine Tolbert, DNP, RN, CLC.
      </Txt>
    </Page>
  );
}
