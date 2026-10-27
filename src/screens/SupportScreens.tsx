import { themeBorder, themeTint } from "../themeColors";
import { themeBackground, themeForeground, themeShadow, themeAction } from "../themeColors";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Switch, Text, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { RootStack } from "../navigation";
import { useCare } from "../store";
import { specialists, trustedResources } from "../content";
import { SpecialistArtwork, SPECIALIST_PALETTES, SPECIALIST_QUESTIONS, SPECIALIST_NOTES } from "../components/SpecialistArtwork";
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
import { OnboardingWelcomeStep } from "../components/OnboardingWelcomeStep";
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

    Promise.all([
      loadPendingCareInvitations(),
      loadSavedOnboarding(),
    ])
      .then(async ([invitations, saved]) => {
        if (!active) return;

        const invitation = invitations[0] ?? null;
        if (invitation) {
          setPendingInvite(invitation);
          setChecking(false);
          return;
        }

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
        const [remainingInvitations, saved] = await Promise.all([
          loadPendingCareInvitations(),
          loadSavedOnboarding(),
        ]);

        const nextInvitation = remainingInvitations[0] ?? null;
        if (nextInvitation) {
          setPendingInvite(nextInvitation);
          setMessage("Invitation declined. Review the next invitation below.");
          return;
        }

        setPendingInvite(null);

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

        setMessage(
          "Invitation declined. You can create your own EnVizion Life care profile below.",
        );
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
                backgroundColor: themeBackground("#F1E8F5"),
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
                backgroundColor: themeBackground("#FFFFFF18"),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name={presentation.icon} size={30} color={themeForeground("#F4DDFB")} />
            </View>
            <View
              style={[
                S.pill,
                {
                  backgroundColor: themeBackground("#FFFFFF14"),
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                },
              ]}
            >
              <Text style={[S.small, { color: themeForeground("#F2E7F5") }]}>
                {presentation.label}
              </Text>
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={[S.eyebrow, { color: themeForeground("#DCC8E3") }]}>
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
            <Txt style={{ color: themeForeground("#E8DDEA"), fontSize: 14, lineHeight: 21 }}>
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
                <View style={[S.pill, { backgroundColor: themeBackground("#FFFFFF12") }]}>
                  <Icon name="heart-outline" size={14} color={themeForeground("#F0DEEF")} />
                  <Text style={[S.small, { color: themeForeground("#F0DEEF") }]}>
                    {pendingInvite.relationship}
                  </Text>
                </View>
              )}
              {Boolean(invitedAt) && (
                <View style={[S.pill, { backgroundColor: themeBackground("#FFFFFF12") }]}>
                  <Icon name="calendar-outline" size={14} color={themeForeground("#F0DEEF")} />
                  <Text style={[S.small, { color: themeForeground("#F0DEEF") }]}>
                    Invited {invitedAt}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card>

        <Heading
          eyebrow="YOUR ACCESS"
          title={"What " + presentation.label + " access means"}
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
                  backgroundColor: themeBackground("#F4ECF8"),
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
              backgroundColor: themeBackground("#FBF7FC"),
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
              : "Accept as " + presentation.label
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
      {step > 0 && (
        <View style={S.between}>
          <Brand />
          <Text style={S.small}>WELCOME • {step + 1} / 3</Text>
        </View>
      )}

      {step === 0 ? (
        <OnboardingWelcomeStep
          step={step}
          totalSteps={3}
          onContinue={() => setStep(1)}
        />
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
                  backgroundColor: themeBackground("#EBDDF3"),
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
                  backgroundColor: themeBackground(C.white),
                }}
              >
                {careMode === "advocate" && (
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: themeAction(C.purple),
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
                  backgroundColor: themeBackground("#FCEAF1"),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="person-outline" size={27} color={themeForeground("#B13D70")} />
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
                  backgroundColor: themeBackground(C.white),
                }}
              >
                {careMode === "self" && (
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      backgroundColor: themeAction(C.purple),
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
                        backgroundColor: r === relationship ? themeAction(C.purple) : C.lavender,
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
            <Card style={{ backgroundColor: themeBackground("#F7F1FA") }}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    backgroundColor: themeBackground("#E9DCF0"),
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

/** These guides deliberately share navigation and accessibility, but not a generic hero illustration. */
function SpecialtyGlass({children,accent,style}:{
  children:React.ReactNode;accent:string;style?:any;
}) {
  return (
    <View style={[{
      overflow:"hidden",borderRadius:26,borderWidth:1,
      borderColor:themeBorder("#E9E1F0"),backgroundColor:themeBackground("#FFFEFF"),
      shadowColor:themeShadow(accent),shadowOpacity:0.075,
      shadowRadius:17,shadowOffset:{width:0,height:6},elevation:2,
    },style]}>{children}</View>
  );
}

export function SpecialistsScreen() {
  const n=useNav();
  const {width}=useWindowDimensions();
  const narrow=width<380;
  return <Page>
    <View style={{gap:11,marginBottom:7}}>
      <Text style={[S.eyebrow,{color:themeForeground("#7639A5"),letterSpacing:2.7}]}>
        HEALTHCARE NAVIGATION
      </Text>
      <View style={{flexDirection:"row",alignItems:"center",gap:5,minHeight:166}}>
        <View style={{flex:1,justifyContent:"center",gap:10,zIndex:1}}>
          <Text accessibilityRole="header" style={{
            fontFamily:"Lora_500Medium",fontSize:narrow?28:35,
            lineHeight:narrow?38:44,letterSpacing:-.8,color:themeForeground("#17143D"),
          }}>Understand your care team</Text>
          <Text style={{fontFamily:"DMSans_400Regular",fontSize:14,lineHeight:21,
            color:themeForeground("#777187")}}>
            Different specialists, one shared goal: care for your loved one.
          </Text>
        </View>
        <View style={{width:narrow?116:148,height:160,marginRight:-9}} pointerEvents="none">
          <SpecialistArtwork index={0} height={160} motion/>
        </View>
      </View>
      <Text style={[S.small,{color:themeForeground("#777187")}]}>
        Choose a specialty to explore visit preparation and helpful questions.
      </Text>
    </View>
    {specialists.map(([title,subtitle],i)=>{
      const palette=SPECIALIST_PALETTES[i]??SPECIALIST_PALETTES[0];
      return <Pressable key={title} accessibilityRole="button"
        accessibilityLabel={`Open ${title} specialist guide`}
        onPress={()=>n.navigate("Specialist",{index:i})}
        style={({pressed})=>({opacity:pressed?.82:1,transform:[{scale:pressed?.994:1}]})}>
        <SpecialtyGlass accent={palette.accent} style={{minHeight:112}}>
          <View pointerEvents="none" style={{position:"absolute",top:0,right:0,bottom:0,width:"48%",opacity:.47}}>
            <SpecialistArtwork index={i} height={128} compact/>
          </View>
          <View style={{flexDirection:"row",alignItems:"center",gap:14,
            paddingHorizontal:17,paddingVertical:17,minHeight:112}}>
            <View style={{width:58,height:58,borderRadius:20,
              backgroundColor:themeBackground(palette.pale),
              alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
              <SpecialistArtwork index={i} height={54} compact/>
            </View>
            <View style={{flex:1,justifyContent:"center",gap:5}}>
              <Text style={{fontFamily:"DMSans_700Bold",fontSize:16.5,lineHeight:22,
                color:themeForeground("#17143D")}}>{title}</Text>
              <Text style={{fontFamily:"DMSans_400Regular",fontSize:12.5,lineHeight:18,
                color:themeForeground("#777187")}}>{subtitle}</Text>
            </View>
            <View style={{width:35,height:35,borderRadius:19,alignItems:"center",
              justifyContent:"center",backgroundColor:themeBackground(palette.pale)}}>
              <Icon name="chevron-forward" size={22} color={themeForeground(palette.accent)}/>
            </View>
          </View>
        </SpecialtyGlass>
      </Pressable>;
    })}
    <Text style={[S.small,{lineHeight:19,marginTop:3}]}>
      These specialist guides explain general care roles. Your clinical team can help with individual referrals.
    </Text>
  </Page>;
}

export function SpecialistScreen({route}:NativeStackScreenProps<RootStack,"Specialist">) {
  const n=useNav();
  const {width}=useWindowDimensions();
  const item=specialists[route.params.index];
  if(!item) return <Page><Heading title="Specialist not found" /></Page>;
  const index=route.params.index;
  const palette=SPECIALIST_PALETTES[index]??SPECIALIST_PALETTES[0];
  const questions=SPECIALIST_QUESTIONS[index]??SPECIALIST_QUESTIONS[0];
  const specialtyNote=SPECIALIST_NOTES[index]??SPECIALIST_NOTES[0];
  const compact=width<380;
  // Make room for long names rather than compressing them beside an image.
  const stackedHero=compact && item[0].length>19;
  const toAppointments=()=>n.navigate("Appointments");

  return <Page>
    <View style={{minHeight:stackedHero?310:226,position:"relative",
      justifyContent:stackedHero?"flex-start":"center",
      borderRadius:30,overflow:"hidden",marginHorizontal:-5,
      backgroundColor:themeBackground("#FFFDFC")}}>
      <View style={{width:stackedHero?"100%":compact?"63%":"61%",
        paddingHorizontal:15,gap:9,zIndex:1,
        paddingVertical:stackedHero?18:27}}>
        <Text style={[S.eyebrow,{letterSpacing:2.6,fontSize:10,
          color:themeForeground(palette.accent)}]}>MEET YOUR CARE TEAM</Text>
        <Text accessibilityRole="header" style={{
          fontFamily:"Lora_500Medium",fontSize:compact?30:37,
          lineHeight:compact?39:46,letterSpacing:-1.05,
          color:themeForeground("#17143D")}}>{item[0]}</Text>
        <Text style={{fontFamily:"DMSans_400Regular",fontSize:14.5,
          lineHeight:22,color:themeForeground("#777187")}}>{item[1]}</Text>
        <View style={{width:45,height:3,borderRadius:3,
          backgroundColor:themeBackground(palette.accent),marginTop:5}}/>
      </View>
      <View pointerEvents="none" style={stackedHero?{
        alignSelf:"flex-end",width:205,height:155,marginTop:-9,marginRight:-6,
      }:{
        position:"absolute",right:-30,bottom:-3,
        width:compact?195:230,height:220,opacity:.96,
      }}>
        <SpecialistArtwork index={index} height={stackedHero?155:215} motion/>
      </View>
    </View>

    <Pressable accessibilityRole="button" accessibilityLabel={`Before your ${item[0]} visit`}
      onPress={toAppointments} style={({pressed})=>({opacity:pressed?.82:1})}>
      <SpecialtyGlass accent={palette.accent} style={{
        backgroundColor:themeBackground(palette.pale)}}>
        <View style={{position:"absolute",right:-38,bottom:-32,width:152,opacity:.24}} pointerEvents="none">
          <SpecialistArtwork index={index} height={154} compact/>
        </View>
        <View style={{flexDirection:"row",alignItems:"center",gap:15,padding:19,minHeight:137}}>
          <View style={{width:64,height:64,borderRadius:21,
            backgroundColor:themeBackground("#FFFFFF"),justifyContent:"center",
            alignItems:"center",shadowColor:themeShadow(palette.accent),
            shadowOpacity:.06,shadowRadius:9,shadowOffset:{width:0,height:3}}}>
            <Icon name="clipboard-outline" size={33} color={themeForeground(palette.accent)}/>
          </View>
          <View style={{flex:1,gap:7}}>
            <Text style={{fontFamily:"DMSans_700Bold",fontSize:19,lineHeight:24,
              color:themeForeground("#17143D")}}>Before your visit</Text>
            <Text style={{fontFamily:"DMSans_400Regular",fontSize:13.5,lineHeight:21,
              color:themeForeground("#777187")}}>{item[2]}</Text>
          </View>
          <Icon name="chevron-forward" size={23} color={themeForeground(palette.accent)}/>
        </View>
      </SpecialtyGlass>
    </Pressable>

    <View style={{gap:12}}>
      <Text style={{fontFamily:"Lora_500Medium",fontSize:25,lineHeight:34,
        color:themeForeground("#17143D"),marginBottom:2}}>
        A few questions to ask
      </Text>
      {questions.map((question,j)=><Pressable key={question.text}
        accessibilityRole="button" accessibilityLabel={question.text}
        onPress={toAppointments} style={({pressed})=>({opacity:pressed?.8:1})}>
        <SpecialtyGlass accent={palette.accent} style={{minHeight:90}}>
          <View pointerEvents="none" style={{position:"absolute",right:7,bottom:-32,
            width:125,opacity:.15}}>
            <SpecialistArtwork index={index} height={125} compact/>
          </View>
          <View style={{flexDirection:"row",gap:14,alignItems:"center",
            paddingVertical:17,paddingHorizontal:15}}>
            <View style={{width:54,height:54,borderRadius:19,backgroundColor:
              themeBackground(j%2===0?palette.pale:"#F0E8F8"),
              alignItems:"center",justifyContent:"center"}}>
              <Icon name={question.icon} size={27} color={themeForeground(palette.accent)}/>
            </View>
            <Text style={{flex:1,fontFamily:"DMSans_500Medium",
              fontSize:14.5,lineHeight:21,color:themeForeground("#17143D")}}>
              {question.text}
            </Text>
            <View style={{height:35,width:35,borderRadius:18,
              backgroundColor:themeBackground(palette.pale),alignItems:"center",
              justifyContent:"center"}}>
              <Icon name="chevron-forward" size={21} color={themeForeground(palette.accent)}/>
            </View>
          </View>
        </SpecialtyGlass>
      </Pressable>)}
    </View>

    <Pressable accessibilityRole="button" accessibilityLabel="Open my appointment questions"
      onPress={toAppointments} style={({pressed})=>({
        minHeight:61,borderRadius:31,paddingHorizontal:20,
        flexDirection:"row",alignItems:"center",justifyContent:"center",gap:11,
        backgroundColor:themeBackground("#70338F"),
        shadowColor:themeShadow("#70338F"),shadowOpacity:.2,
        shadowRadius:18,shadowOffset:{width:0,height:8},elevation:4,
        opacity:pressed?.84:1})}>
      <Icon name="document-text-outline" size={22} color={themeForeground("#FFFFFF")}/>
      <Text style={{flex:1,textAlign:"center",fontFamily:"DMSans_600SemiBold",
        fontSize:14.5,color:themeForeground("#FFFFFF")}}>
        Open my appointment questions
      </Text>
      <Icon name="chevron-forward" size={22} color={themeForeground("#FFFFFF")}/>
    </Pressable>

    <SpecialtyGlass accent={palette.accent}>
      <View style={{flexDirection:"row",alignItems:"flex-start",gap:12,padding:16}}>
        <View style={{height:40,width:40,borderRadius:20,
          alignItems:"center",justifyContent:"center",
          backgroundColor:themeBackground(palette.pale)}}>
          <Icon name="information-circle-outline" size={23} color={themeForeground(palette.accent)}/>
        </View>
        <View style={{flex:1,gap:4}}>
          <Text style={{fontFamily:"DMSans_700Bold",fontSize:14.5,color:themeForeground("#17143D")}}>
            About this guide
          </Text>
          <Text style={{fontFamily:"DMSans_400Regular",fontSize:12.5,
            lineHeight:19,color:themeForeground("#777187")}}>
            {specialtyNote} This is general information, not an individual treatment plan.
            Your primary care team can help with referral questions.
          </Text>
        </View>
      </View>
    </SpecialtyGlass>
  </Page>;
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
