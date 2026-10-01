import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, Pressable, Switch, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
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
    const invitedRole =
      pendingInvite.role === "caregiver"
        ? "Caregiver access"
        : pendingInvite.role === "patient"
          ? "Patient / care recipient access"
          : "Family member access";

    return (
      <Page>
        <Brand />
        <Heading
          eyebrow="CARE TEAM INVITATION"
          title={`You’ve been invited to join ${pendingInvite.careRecipientName}’s care space.`}
          body="Your access remains private and inactive until you choose to accept."
        />
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="people-outline" size={34} />
          <Text style={S.h2}>{invitedRole}</Text>
          <Txt>
            {pendingInvite.role === "caregiver"
              ? "You’ll be able to view and update the shared care record."
              : pendingInvite.role === "patient"
                ? "You’ll be able to view the care information being shared with you."
                : "You’ll be able to read shared updates without changing medical records."}
          </Txt>
        </Card>
        <Button
          title={saving ? "Accepting invitation…" : "Accept and open care profile"}
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
        <Txt style={S.small}>
          Accepting adds you to this care team. The Primary Advocate can later
          update your access or remove it.
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
          position: "relative",
          minHeight: 238,
          overflow: "hidden",
          marginHorizontal: -2,
        }}
      >
        <View
          style={{
            maxWidth: 225,
            gap: 8,
            paddingTop: 8,
            zIndex: 2,
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
              fontSize: 38,
              lineHeight: 43,
              letterSpacing: -0.9,
              color: "#17143D",
            }}
          >
            {item[0]}
          </Text>

          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 17,
              lineHeight: 25,
              color: "#747184",
              maxWidth: 210,
            }}
          >
            {item[1]}
          </Text>
        </View>

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -16,
            top: 0,
            width: 245,
            height: 215,
          }}
        >
          <Image
            source={require("../assets/specialist-primary-care-hero.webp")}
            resizeMode="contain"
            style={{
              width: "100%",
              height: "100%",
            }}
          />
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
        eyebrow="YOUR CARE COMPANION"
        title={`Hello, ${state.name}.`}
        body={`You’re here caring for ${state.relationship.toLowerCase()}.`}
      />

      <Card>
        <Text style={S.h3}>Your account</Text>
        <Txt>{user?.email ?? "Signed in"}</Txt>
        <Txt>Your caregiver profile is connected to your EnVizion Life account.</Txt>
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
        subtitle={`${state.careRecipientName || "Care profile"} · ${state.accessRole === "owner" ? "Owner" : state.accessRole === "caregiver" ? "Caregiver" : "Viewer"} access`}
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
