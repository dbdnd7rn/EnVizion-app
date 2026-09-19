import React, { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Switch, Text, View } from "react-native";
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
export function OnboardingScreen() {
  const n = useNav();
  const { dispatch, refresh } = useCare();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [careName, setCareName] = useState("");
  const [relationship, setRelationship] = useState("A parent");
  const [faith, setFaith] = useState(false);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

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

  async function finish() {
    setMessage("");

    const resolvedCareName =
      relationship === "Myself"
        ? careName.trim() || name.trim()
        : careName.trim();

    if (!name.trim() || !resolvedCareName) {
      setMessage("Add your name and the name of the person you are caring for.");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveOnboarding({
        name,
        careName: resolvedCareName,
        relationship,
        faith,
      });

      dispatch({
        type: "profile",
        name: saved.name,
        relationship: saved.relationship,
        faith: saved.faith,
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

  return (
    <Page>
      <View style={S.between}>
        <Brand />
        <Text style={S.small}>WELCOME • {step + 1} / 2</Text>
      </View>
      {step === 0 ? (
        <>
          <View style={{ borderRadius: 28, overflow: "hidden" }}>
            <Landscape height={240} />
          </View>
          <Heading
            eyebrow="FAITH. CLARITY. COMPASSION."
            title={"Care is a journey.\nLet’s walk together."}
            body="A little guidance for the big responsibility of caring for someone you love."
          />
          <View style={{ gap: 17 }}>
            {[
              [
                "heart-outline",
                "Organize everyday care",
                "Keep observations, medicines, and questions together.",
              ],
              [
                "compass-outline",
                "Find your next step",
                "Understand resources and the people on your care team.",
              ],
              [
                "sparkles-outline",
                "Make room for yourself",
                "Find encouragement and spiritual support.",
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
      ) : (
        <>
          <Heading
            eyebrow="MAKE YOURSELF AT HOME"
            title="A companion for your kind of care."
            body="Set up the care profile that will stay connected to your account."
          />
          <Field
            label="What should we call you?"
            value={name}
            onChange={setName}
          />
          <Field
            label={
              relationship === "Myself"
                ? "Your name for the care profile"
                : "What should we call the person you’re caring for?"
            }
            value={careName}
            onChange={setCareName}
          />
          <Text style={S.h3}>Who are you caring for?</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
            {["A parent", "My partner", "A loved one", "Myself"].map((r) => (
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
            title={saving ? "Saving your care profile…" : "Open my care companion"}
            disabled={saving}
            onPress={finish}
          />
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
  return (
    <Page>
      <Heading eyebrow="MEET YOUR CARE TEAM" title={item[0]} body={item[1]} />
      <Card>
        <Icon name="medical-outline" size={32} />
        <Text style={S.h2}>Before your visit</Text>
        <Txt>{item[2]}</Txt>
      </Card>
      <Section title="A few questions to ask" />
      {[
        "What is the next step in our care plan?",
        "What changes should prompt us to call?",
        "How will you coordinate with the rest of the care team?",
      ].map((q) => (
        <Card key={q}>
          <Txt style={{ color: C.ink }}>{q}</Txt>
        </Card>
      ))}
      <Button
        title="Open my appointment questions"
        onPress={() => n.navigate("Appointments")}
      />
      <Txt style={S.small}>
        This guide explains general roles. Your primary care team can help with
        individual referral questions.
      </Txt>
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
