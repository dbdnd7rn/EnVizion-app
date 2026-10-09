import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Circle, Path } from "react-native-svg";
import {
  completeCareAccessRecertification,
  loadCareAccessRecertifications,
  type CareAccessRecertificationDecision,
  type CareAccessRecertificationItem,
  type CareAccessRecertificationOverview,
} from "../careTeam";
import { useCare } from "../store";
import {
  C,
  Icon,
  S,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";


const PURPLE = "#7139A9";
const INK = "#19163E";
const MUTED = "#7C7795";
function Page({ children }: { children: React.ReactNode }) {
  const n = useNav();
  return <ScrollView style={{ flex: 1, backgroundColor: "#FCFAFF" }}
    contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 18, paddingBottom: 54 }}
    keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
    <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 4 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back"
          onPress={() => n.canGoBack() ? n.goBack() : n.navigate("CareTeam")}
          style={({pressed})=>({width:45,height:45,borderRadius:24,justifyContent:"center",
            alignItems:"center",backgroundColor:"#F1EAFB",borderWidth:1,
            borderColor:"#FFFFFF",opacity:pressed?0.75:1})}>
          <Icon name="arrow-back-outline" color={PURPLE} size={22}/>
        </Pressable>
        <Text accessibilityRole="header" style={{flex:1,color:INK,fontSize:18,
          fontFamily:"DMSans_700Bold"}}>90-day access review</Text>
      </View>
      {children}
    </View>
  </ScrollView>;
}
function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ padding: 16, borderRadius: 25, borderWidth: 1,
    borderColor: "#E7DDF2", backgroundColor: "#FFFDFFED", gap: 12,
    shadowColor: "#603982", shadowOpacity: 0.07,
    shadowOffset: { width: 0, height: 7 }, shadowRadius: 16,
    elevation: 2, overflow: "hidden" }, style]}>
    <View pointerEvents="none" style={{ position: "absolute",
      right: -65, top: -90, width: 175, height: 175, borderRadius: 90,
      backgroundColor: "#EFE4FE", opacity: 0.45 }} />
    {children}
  </View>;
}
function Heading({ eyebrow, title, body }: {
  eyebrow: string; title: string; body?: string;
}) {
  return <View style={{ gap: 9 }}>
    <Text style={{ color: PURPLE, fontFamily: "DMSans_700Bold",
      letterSpacing: 1.9, fontSize: 10.5 }}>{eyebrow}</Text>
    <Text accessibilityRole="header" style={{ fontFamily: "DMSans_700Bold",
      color: INK, fontSize: 29, lineHeight: 36,
      letterSpacing: -0.65 }}>{title}</Text>
    {body && <Text style={{ fontFamily: "DMSans_400Regular", color: MUTED,
      fontSize: 13.5, lineHeight: 21 }}>{body}</Text>}
  </View>;
}
function Section({ title }: { title: string }) {
  return <Text accessibilityRole="header" style={{ fontFamily: "DMSans_700Bold",
    color: INK, fontSize: 21, letterSpacing: -0.4, lineHeight: 27 }}>{title}</Text>;
}
function Button({ title, onPress, secondary = false, icon, disabled = false }: {
  title: string; onPress: () => void; secondary?: boolean; icon?: string; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ borderRadius: 30, minHeight: 53,
      borderColor: secondary ? "#E2CDF7" : "#9D65D4", borderWidth: 1,
      backgroundColor: secondary ? "#F0E8FB" : PURPLE,
      alignItems: "center", justifyContent: "center",
      flexDirection: "row", gap: 9, overflow: "hidden",
      opacity: disabled ? 0.44 : pressed ? 0.75 : 1 })}>
    {!secondary && <Svg width="100%" height="100%" pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0 }}
      viewBox="0 0 320 53" preserveAspectRatio="none">
      <Defs><LinearGradient id="reviewAction" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#9A5BD4"/>
        <Stop offset="0.55" stopColor="#7541B4"/>
        <Stop offset="1" stopColor="#8648C8"/>
      </LinearGradient></Defs>
      <Rect width="320" height="53" fill="url(#reviewAction)"/>
    </Svg>}
    {icon && <Icon name={icon} color={secondary ? PURPLE : "#FFFFFF"} size={20}/>}
    <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 14,
      color: secondary ? PURPLE : "#FFFFFF" }}>{title}</Text>
  </Pressable>;
}
function IconTile({ icon, green = false }: { icon: string; green?: boolean }) {
  return <View style={{ width: 50, height: 50, borderRadius: 20,
    backgroundColor: green ? "#E8F6EE" : "#F0E7FC",
    justifyContent: "center", alignItems: "center" }}>
    <Icon name={icon} color={green ? "#229870" : PURPLE} size={25}/>
  </View>;
}
function GlassCalendar() {
  return <Svg width={115} height={122} viewBox="0 0 130 140">
    <Defs>
      <LinearGradient id="calendarFace" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#E7DFFF"/><Stop offset="1" stopColor="#9B7FE5"/>
      </LinearGradient>
      <LinearGradient id="calendarShield" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#BA9CF4"/><Stop offset="1" stopColor="#7840CF"/>
      </LinearGradient>
    </Defs>
    <Rect x="10" y="24" width="92" height="99" rx="18"
      fill="url(#calendarFace)" stroke="#FFF" strokeWidth="2"
      transform="rotate(-9 56 72)"/>
    <Path d="M15 52 L104 38 L102 60 L18 75 Z" fill="#8D6BE0"/>
    <Rect x="29" y="13" width="10" height="27" rx="5"
      fill="#B6A1F7" stroke="#FFF" strokeWidth="2"/>
    <Rect x="77" y="7" width="10" height="29" rx="5"
      fill="#B6A1F7" stroke="#FFF" strokeWidth="2"/>
    {[0,1,2].map((row) => [0,1,2].map((col) =>
      <Rect key={row+"-"+col} x={25+col*20} y={73+row*18}
        width="12" height="12" rx="4" fill="#F9F5FF" opacity={0.77}/>))}
    <Circle cx="99" cy="100" r="29" fill="#FFF" opacity={0.6}/>
    <Circle cx="99" cy="100" r="25" fill="url(#calendarShield)"
      stroke="#FFF" strokeWidth="2"/>
    <Path d="M99 83 L114 89 L113 104 Q110 115 99 119 Q85 111 85 100 L85 89 Z"
      fill="#F6F1FF" stroke="#E6DEFF" strokeWidth="1.7"/>
    <Path d="M91 100 L97 106 L108 93" fill="none"
      stroke="#7A4CCA" strokeWidth="3.6" strokeLinecap="round"/>
  </Svg>;
}

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

      {overview && (
        <Card style={{ backgroundColor: "#F3EBFCEA", borderColor: "#DBC8F4" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
            <View style={{ width: 115, alignItems: "center" }}><GlassCalendar/></View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text style={{ color: PURPLE, fontFamily: "DMSans_700Bold",
                letterSpacing: 1.2, fontSize: 10 }}>PERIODIC ACCESS GOVERNANCE</Text>
              <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 23,
                lineHeight: 29, color: INK }}>
                {overview.dueCount} review{overview.dueCount === 1 ? "" : "s"} due
              </Text>
              <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11.5,
                lineHeight: 18, color: MUTED }}>
                EnVizion reviews access every {overview.cadenceDays} days.
                Primary Advocate ownership and Care Recipient access are
                not part of caregiver/family recertification.
              </Text>
            </View>
          </View>
        </Card>
      )}

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      <Section title="Due now" />
      {!due.length ? (
        <Card style={{backgroundColor:"#F9FCFA",borderColor:"#D9EDE3"}}>
          <View style={{flexDirection:"row",alignItems:"center",gap:13}}>
            <IconTile icon="shield-checkmark-outline" green/>
            <View style={{flex:1,gap:4}}>
              <Text style={{fontFamily:"DMSans_700Bold",fontSize:14,color:INK}}>
                No access reviews are due
              </Text>
              <Text style={{fontFamily:"DMSans_400Regular",fontSize:12.5,
                lineHeight:18,color:MUTED}}>
                Upcoming reviews stay scheduled automatically.
              </Text>
            </View>
          </View>
        </Card>      ) : (
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
        <Card><View style={{flexDirection:"row",alignItems:"center",gap:12}}>
          <IconTile icon="calendar-outline"/>
          <Text style={{flex:1,fontFamily:"DMSans_400Regular",fontSize:13,
            lineHeight:19,color:MUTED}}>No upcoming access reviews are scheduled yet.</Text>
        </View></Card>
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
        <Card><View style={{flexDirection:"row",alignItems:"center",gap:12}}>
          <IconTile icon="document-text-outline"/>
          <Text style={{flex:1,fontFamily:"DMSans_400Regular",fontSize:13,
            lineHeight:19,color:MUTED}}>
            No completed 90-day access reviews have been recorded yet.
          </Text>
        </View></Card>
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

      <Card style={{ backgroundColor: "#F8F2FCEB", gap: 8 }}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <IconTile icon="information-circle-outline"/>
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
        icon="people-outline"
        onPress={() => n.navigate("CareTeam")}
      />
    </Page>
  );
}
