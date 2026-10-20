import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo, ActivityIndicator, Animated, Image, Pressable, Text, View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useCare } from "../store";
import { useAuth } from "../auth";
import { useAppearance } from "../appearance";
import { loadCarePlan, type CarePlanItem, type CarePlanCompletion } from "../carePlan";
import { loadCareTeam, type CareTeamMember } from "../careTeam";
import { chatPeople, type ChatPerson } from "../careChat";
import { supabase } from "../supabase";
import { ProfileAvatar, useProfileAvatar } from "../profileAvatar";
import { themeBackground, themeBorder, themeForeground, themeShadow, themeTint } from "../themeColors";
import { C, Icon, Page } from "../ui";
import { useNav } from "./MainScreens";

const INK = "#1A163B";
const MUTED = "#756E87";
const PURPLE = "#70338F";
const FONT = "DMSans_400Regular";
const SEMI = "DMSans_600SemiBold";
const BOLD = "DMSans_700Bold";

function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}
function readableDate(value: string | null | undefined) {
  if (!value) return "Date to be confirmed";
  const valueDate = new Date(value.length === 10 ? value + "T12:00:00" : value);
  return Number.isFinite(valueDate.getTime())
    ? valueDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : value;
}
function timeLabel(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "Time to be confirmed";
}
function PatientText({ children, muted = false, size = 15 }: {
  children: React.ReactNode; muted?: boolean; size?: number;
}) {
  return <Text style={{ color: themeForeground(muted ? MUTED : INK), fontSize: size,
    lineHeight: Math.round(size * 1.47), fontFamily: FONT }}>{children}</Text>;
}
function PatientGlass({ children, tint = "#F3EAFB" }: {
  children: React.ReactNode; tint?: string;
}) {
  return (
    <View style={{ borderRadius: 27, overflow: "hidden", padding: 19, gap: 11,
      borderWidth: 1, borderColor: themeBorder("#EBE2F1"),
      backgroundColor: themeBackground("#FFFDFF"),
      shadowColor: themeShadow("#623A70"), shadowOpacity: 0.075,
      shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2 }}>
      <View pointerEvents="none" style={{ position: "absolute", right: -67, top: -79,
        width: 168, height: 168, borderRadius: 84, backgroundColor: themeTint(tint), opacity: 0.34 }}/>
      {children}
    </View>
  );
}
function PatientHeading({ eyebrow, title, subtitle }: {
  eyebrow: string; title: string; subtitle?: string;
}) {
  return <View style={{ gap: 8 }}>
    <Text style={{ fontFamily: BOLD, letterSpacing: 2.1, color: themeForeground(PURPLE),
      fontSize: 11 }}>{eyebrow.toUpperCase()}</Text>
    <Text style={{ fontFamily: "Lora_500Medium", fontSize: 28, lineHeight: 37,
      color: themeForeground(INK) }}>{title}</Text>
    {subtitle ? <PatientText muted>{subtitle}</PatientText> : null}
  </View>;
}
function PatientAction({ icon, title, detail, onPress, accent = "#F4EAFB" }: {
  icon: string; title: string; detail?: string; onPress: () => void; accent?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityHint={detail || "Open page"} onPress={onPress}
    style={({ pressed }) => ({ opacity: pressed ? 0.74 : 1 })}>
    <PatientGlass tint={accent}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, minHeight: 49 }}>
        <View style={{ width: 52, height: 52, borderRadius: 18,
          backgroundColor: themeBackground(accent), justifyContent: "center", alignItems: "center" }}>
          <Icon name={icon} size={25} color={themeForeground(PURPLE)}/>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: themeForeground(INK), fontFamily: BOLD, fontSize: 16 }}>{title}</Text>
          {detail ? <PatientText muted size={13}>{detail}</PatientText> : null}
        </View>
        <Icon name="chevron-forward-outline" size={19} color={themeForeground(PURPLE)}/>
      </View>
    </PatientGlass>
  </Pressable>;
}
function PatientEmpty({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return <PatientGlass>
    <View style={{ alignItems: "center", paddingVertical: 19, gap: 12 }}>
      <View style={{ width: 76, height: 76, borderRadius: 26,
        alignItems: "center", justifyContent: "center", backgroundColor: themeBackground("#EEE1F8") }}>
        <Icon name={icon} size={33} color={themeForeground(PURPLE)}/>
      </View>
      <Text style={{ fontFamily: BOLD, fontSize: 16, color: themeForeground(INK),
        textAlign: "center" }}>{title}</Text>
      <Text style={{ fontFamily: FONT, fontSize: 14, lineHeight: 21,
        color: themeForeground(MUTED), textAlign: "center", maxWidth: 280 }}>{detail}</Text>
    </View>
  </PatientGlass>;
}
function PatientReveal({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const slide = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) return;
      opacity.setValue(0);
      slide.setValue(11);
      animation = Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }),
        Animated.timing(slide, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]);
      animation.start();
    }).catch(() => {});
    return () => { active = false; animation?.stop(); };
  }, [opacity, slide]);
  return <Animated.View style={{ opacity, transform: [{ translateY: slide }] }}>{children}</Animated.View>;
}
function PatientHeroArt() {
  return <Svg width="100%" height={156} viewBox="0 0 330 156" accessibilityLabel="Decorative caring hands and heart">
    <Defs>
      <LinearGradient id="patientHero" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={themeTint("#E6CDF9")}/>
        <Stop offset="1" stopColor={themeTint("#B89DDA")}/>
      </LinearGradient>
      <LinearGradient id="patientHeart" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor="#F6B5D0"/><Stop offset="1" stopColor="#BF80CC"/>
      </LinearGradient>
    </Defs>
    <Circle cx="166" cy="81" r="64" fill="url(#patientHero)" opacity={0.88}/>
    <Circle cx="78" cy="38" r="10" fill={themeTint("#EFDCF8")}/>
    <Circle cx="268" cy="50" r="17" fill={themeTint("#D8C2ED")}/>
    <Path d="M165 118c-11-10-40-31-40-51 0-20 25-28 40-8 15-20 40-12 40 8 0 20-29 41-40 51Z"
      fill="url(#patientHeart)"/>
    <Path d="M92 108c22-12 37-12 53-6 10 4 16 11 22 20l-19 17-39-9-30-2Z"
      fill={themeTint("#F7E7EE")}/>
    <Path d="M238 108c-22-12-37-12-53-6-10 4-16 11-22 20l19 17 39-9 30-2Z"
      fill={themeTint("#F7E7EE")}/>
    <Path d="M79 128c31-6 57 13 86 13s55-19 86-13" fill="none"
      stroke={themeTint("#FFF9FC")} strokeWidth={7} strokeLinecap="round"/>
    <Path d="M104 38l4-11m-23 9-8-7m151 10 9-9m10 24 13-3"
      stroke={themeTint("#FFF9FC")} strokeWidth={4} strokeLinecap="round"/>
    <Rect x="156" y="16" width="20" height="4" rx="2" fill={themeTint("#FFF9FC")}/>
  </Svg>;
}
function usePatientPlan(recipientId: string | null) {
  const [items, setItems] = useState<CarePlanItem[]>([]);
  const [completions, setCompletions] = useState<CarePlanCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(""); setItems([]); setCompletions([]);
    if (recipientId) {
      loadCarePlan(recipientId).then((data) => {
        if (active) { setItems(data.items); setCompletions(data.completions); }
      }).catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "Care plan unavailable.");
      }).finally(() => { if (active) setLoading(false); });
    } else setLoading(false);
    return () => { active = false; };
  }, [recipientId]));
  return { items, completions, loading, error };
}
function todayItems(items: CarePlanItem[]) {
  const today = new Date();
  const weekday = today.getDay() || 7;
  return items.filter(item => item.daysOfWeek.includes(weekday));
}
function PatientPlanList({ limit }: { limit?: number }) {
  const { state } = useCare();
  const { items, completions, error, loading } = usePatientPlan(state.careRecipientId);
  const today = todayItems(items);
  const completeIds = new Set(completions.filter(c => c.completedOn === dayKey(new Date())).map(c => c.itemId));
  if (loading) return <ActivityIndicator accessibilityLabel="Loading today's care plan" color={C.purple}/>;
  if (error) return <PatientEmpty icon="cloud-offline-outline" title="Could not load today's plan" detail={error}/>;
  if (!today.length) return <PatientEmpty icon="sunny-outline" title="A peaceful day ahead"
    detail="When your care team adds activities to your daily plan, they will appear here."/>;
  return <View style={{ gap: 10 }}>{today.slice(0, limit ?? today.length).map(item => (
    <PatientGlass key={item.id}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Icon name={completeIds.has(item.id) ? "checkmark-circle" : "ellipse-outline"}
          size={28} color={themeForeground(completeIds.has(item.id) ? "#27956D" : PURPLE)}/>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: SEMI, color: themeForeground(INK), fontSize: 15 }}>{item.title}</Text>
          <PatientText muted size={13}>
            {item.localTime || "Flexible time"} · {item.category} · {completeIds.has(item.id) ? "Completed" : "Planned"}
          </PatientText>
          {item.details ? <PatientText muted size={13}>{item.details}</PatientText> : null}
        </View>
      </View>
    </PatientGlass>
  ))}</View>;
}
export function PatientHomeScreen() {
  const n = useNav();
  const { state, refresh, syncError } = useCare();
  const first = state.name.trim().split(/\s+/)[0] || "there";
  const { items, completions } = usePatientPlan(state.careRecipientId);
  const today = todayItems(items);
  const done = completions.filter(c => c.completedOn === dayKey(new Date()) && today.some(item => item.id === c.itemId)).length;
  return <Page>
    <PatientReveal>
      <View style={{ borderRadius: 32, overflow: "hidden", backgroundColor: themeBackground("#F1E3FA"),
        borderColor: themeBorder("#E2CBF1"), borderWidth: 1, padding: 23, gap: 7 }}>
        <Text style={{ fontFamily: BOLD, fontSize: 12, letterSpacing: 2,
          color: themeForeground(PURPLE) }}>YOUR SPACE TO FEEL SUPPORTED</Text>
        <Text style={{ fontFamily: "Lora_500Medium", fontSize: 31, lineHeight: 40,
          color: themeForeground(INK) }}>Hello, {first}.</Text>
        <PatientText>One gentle day at a time. Your care details, together in one place.</PatientText>
        <PatientHeroArt/>
      </View>
    </PatientReveal>
    <PatientHeading eyebrow="TODAY AT A GLANCE" title="My day" subtitle="The care plan shared with you."/>
    <View style={{ flexDirection: "row", gap: 11 }}>
      <View style={{ flex: 1 }}><PatientGlass><Text style={{ fontFamily: BOLD, fontSize: 28,
        color: themeForeground(PURPLE) }}>{today.length}</Text><PatientText muted size={13}>Planned activities</PatientText></PatientGlass></View>
      <View style={{ flex: 1 }}><PatientGlass><Text style={{ fontFamily: BOLD, fontSize: 28,
        color: themeForeground("#248969") }}>{done}</Text><PatientText muted size={13}>Completed today</PatientText></PatientGlass></View>
    </View>
    <PatientPlanList limit={3}/>
    <PatientAction icon="medical-outline" title="My medications"
      detail={state.medications.length ? state.medications.length + " recorded medications" : "View your care team's medication list"}
      onPress={() => n.navigate("PatientMedications")}/>
    <PatientAction icon="calendar-outline" title="My appointments"
      detail={state.appointmentId ? readableDate(state.appointment.date) : "View upcoming visits"}
      onPress={() => n.navigate("PatientAppointments")} accent="#E8F2FF"/>
    <PatientAction icon="chatbubbles-outline" title="Care Team Chat" detail="Message your authorized care team"
      onPress={() => n.navigate("CareTeamChat", { careRecipientId: state.careRecipientId ?? undefined })}/>
    {syncError ? <PatientText muted>{syncError}</PatientText> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Refresh care information"
      onPress={() => void refresh()} style={{ minHeight: 48, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: themeForeground(PURPLE), fontFamily: SEMI }}>Refresh my information</Text>
    </Pressable>
  </Page>;
}
export function PatientCareHubScreen() {
  const n = useNav();
  return <Page>
    <PatientHeading eyebrow="MY CARE" title="Everything in one place"
      subtitle="A clear view of the care information your team has shared."/>
    <PatientAction icon="sunny-outline" title="My Day" detail="See routines, activities, and progress"
      onPress={() => n.navigate("PatientDay")}/>
    <PatientAction icon="medical-outline" title="My Medications" detail="Schedules, instructions, and recorded doses"
      onPress={() => n.navigate("PatientMedications")} accent="#F8EAF4"/>
    <PatientAction icon="calendar-outline" title="My Appointments" detail="Visit times, locations, and preparation"
      onPress={() => n.navigate("PatientAppointments")} accent="#E9F1FF"/>
    <PatientAction icon="pulse-outline" title="My Health" detail="Measurements and simple trends"
      onPress={() => n.navigate("PatientHealth")} accent="#E7F4EF"/>
    <PatientAction icon="time-outline" title="My Care History" detail="Events recorded by your care team"
      onPress={() => n.navigate("PatientHistory")}/>
    <PatientGlass tint="#E9F1F9"><PatientText muted size={13}>
      Your shared care record is for coordination and understanding. For medical decisions, consult your healthcare professional.
    </PatientText></PatientGlass>
  </Page>;
}
export function PatientDayScreen() {
  return <Page>
    <PatientHeading eyebrow="MY DAY" title="A plan made with care"
      subtitle="Your scheduled activities and the actions your care team has marked complete."/>
    <PatientPlanList/>
  </Page>;
}
export function PatientMedicationsScreen() {
  const { state } = useCare();
  return <Page>
    <PatientHeading eyebrow="MY MEDICATIONS" title="A clearer medication list"
      subtitle="Directions recorded by your care team. Check with your clinician before changing any medicine."/>
    {state.medications.length ? state.medications.map(med => (
      <PatientGlass key={med.id} tint="#F6E9F5">
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Icon name="medical-outline" size={30} color={themeForeground(PURPLE)}/>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: BOLD, color: themeForeground(INK), fontSize: 17 }}>{med.name}</Text>
            <PatientText muted size={13}>{med.time || "No schedule recorded"}</PatientText>
          </View>
        </View>
        <PatientText>{med.instructions || "No additional instructions recorded."}</PatientText>
        <PatientText muted size={13}>Recorded doses: {state.medicationRecords.filter(r => r.medication.id === med.id && !r.correctedAt).length}</PatientText>
      </PatientGlass>
    )) : <PatientEmpty icon="medkit-outline" title="No medications listed"
      detail="When your care team records a medication, its schedule and instructions will appear here."/>}
    <PatientGlass><PatientText muted size={13}>This list is a shared caregiver record, not a prescription. Only your authorized care team can change medication instructions. Refill details appear when they are available in the shared record.</PatientText></PatientGlass>
  </Page>;
}
type PatientAppointment = {
  id: string; title: string; starts_at: string | null; appointment_date: string | null;
  appointment_time: string | null; location: string | null; notes: string | null;
};
export function PatientAppointmentsScreen() {
  const { state } = useCare();
  const [items, setItems] = useState<PatientAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    let active = true; setItems([]); setError(""); setLoading(true);
    if (!state.careRecipientId) { setLoading(false); return () => { active = false; }; }
    supabase.from("appointments")
      .select("id,title,starts_at,appointment_date,appointment_time,location,notes")
      .eq("care_recipient_id", state.careRecipientId)
      .order("created_at", { ascending: false }).limit(50)
      .then(({ data, error: problem }) => {
        if (!active) return;
        if (problem) setError(problem.message);
        else setItems((data ?? []) as PatientAppointment[]);
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [state.careRecipientId]));
  const sorted = [...items].sort((a, b) =>
    String(a.appointment_date || a.starts_at || "").localeCompare(String(b.appointment_date || b.starts_at || "")));
  return <Page>
    <PatientHeading eyebrow="MY APPOINTMENTS" title="Looking ahead"
      subtitle="Visit details and preparation notes recorded by your care team."/>
    {loading ? <ActivityIndicator color={C.purple}/> : error ?
      <PatientEmpty icon="cloud-offline-outline" title="Appointments are unavailable" detail={error}/> :
      sorted.length ? sorted.map(item => <PatientGlass key={item.id} tint="#E9F0FD">
        <Text style={{ fontFamily: BOLD, color: themeForeground(INK), fontSize: 17 }}>{item.title}</Text>
        <PatientText>{readableDate(item.appointment_date || item.starts_at)} · {timeLabel(item.appointment_time || (item.starts_at ? item.starts_at.slice(11, 16) : null))}</PatientText>
        <PatientText muted>{item.location || "Location to be confirmed"}</PatientText>
        {item.notes ? <PatientText muted size={13}>{item.notes}</PatientText> : null}
      </PatientGlass>) :
      <PatientEmpty icon="calendar-outline" title="No visits recorded"
        detail="Future appointments will appear when your care team adds them."/>}
  </Page>;
}
function Trend({ values }: { values: number[] }) {
  if (values.length < 2) return <PatientText muted size={13}>A trend appears after at least two measurements.</PatientText>;
  const min = Math.min(...values); const max = Math.max(...values);
  const span = Math.max(1, max - min);
  const points = values.slice(-12).map((value, i, arr) => {
    const x = 16 + i * 272 / Math.max(1, arr.length - 1);
    const y = 99 - (value - min) / span * 74;
    return [x, y];
  });
  const path = points.map(([x, y], index) => (index === 0 ? "M" : "L") + x + " " + y).join(" ");
  return <Svg viewBox="0 0 304 124" width="100%" height={124} accessibilityLabel="Measurement history line chart">
    <Path d="M16 100H290M16 62H290M16 25H290" stroke={themeBorder("#DACBE8")} strokeWidth={1}/>
    <Path d={path} fill="none" stroke={themeForeground(PURPLE)} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"/>
    {points.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={4} fill={themeForeground(PURPLE)}/>)}
  </Svg>;
}
export function PatientHealthScreen() {
  const { state } = useCare();
  const trend = (kind: string, key: string) => state.entries
    .filter(e => e.kind === kind && Number.isFinite(Number(e.values[key])) && e.values[key]?.trim())
    .slice().reverse().map(e => Number(e.values[key]));
  const glucose = trend("Blood sugar", "glucose");
  const systolic = trend("Vitals", "systolic");
  return <Page>
    <PatientHeading eyebrow="MY HEALTH" title="Understanding my record"
      subtitle="Recorded measurements, displayed without interpretation or diagnosis."/>
    <PatientGlass tint="#E8F4F0"><Text style={{ fontFamily: BOLD, color: themeForeground(INK), fontSize: 17 }}>Blood glucose (mg/dL)</Text>
      {glucose.length ? <><PatientText>Latest: {glucose[glucose.length - 1]}</PatientText><Trend values={glucose}/></> :
        <PatientText muted>No blood glucose measurements recorded.</PatientText>}
    </PatientGlass>
    <PatientGlass><Text style={{ fontFamily: BOLD, color: themeForeground(INK), fontSize: 17 }}>Systolic blood pressure (mmHg)</Text>
      {systolic.length ? <><PatientText>Latest: {systolic[systolic.length - 1]}</PatientText><Trend values={systolic}/></> :
        <PatientText muted>No blood pressure measurements recorded.</PatientText>}
    </PatientGlass>
    {state.entries.length ? state.entries.slice(0, 15).map(entry => <PatientGlass key={entry.id}>
      <Text style={{ fontFamily: SEMI, color: themeForeground(INK), fontSize: 15 }}>{entry.kind}</Text>
      <PatientText muted size={13}>{readableDate(entry.recordedAt)}</PatientText>
      {Object.entries(entry.values).filter(([, value]) => Boolean(value)).map(([key, value]) => (
        <PatientText key={key} size={14}>{key.replace(/_/g, " ")}: {value}</PatientText>
      ))}
    </PatientGlass>) : <PatientEmpty icon="heart-outline" title="Your health record is ready"
      detail="Observations added by your care team will appear here."/>}
    <PatientText muted size={13}>Changes in these recordings are not a diagnosis. Discuss questions with your healthcare professional.</PatientText>
  </Page>;
}
export function PatientTeamScreen() {
  const n = useNav();
  const { state } = useCare();
  const [people, setPeople] = useState<ChatPerson[]>([]);
  const [roster, setRoster] = useState<CareTeamMember[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useFocusEffect(useCallback(() => {
    let active = true; setPeople([]); setRoster([]); setError(""); setLoading(true);
    if (!state.careRecipientId) { setLoading(false); return () => { active = false; }; }
    Promise.all([chatPeople(state.careRecipientId), loadCareTeam(state.careRecipientId)
      .then(result => result.members).catch(() => [] as CareTeamMember[])])
      .then(([found, members]) => {
        if (active) { setPeople(found); setRoster(members); }
      }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Care team unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [state.careRecipientId]));
  const roleName = (member: CareTeamMember | undefined) => member?.role === "owner" ? "Primary Advocate"
    : member?.role === "caregiver" ? "Co-Caregiver" : member?.role === "patient" ? "Care Recipient" : "Care team member";
  return <Page>
    <PatientHeading eyebrow="MY CARE TEAM" title="The people beside you"
      subtitle="People currently authorized to participate in your care conversation."/>
    <PatientAction icon="chatbubbles-outline" title="Care Team Chat"
      detail="A private conversation with your authorized care team"
      onPress={() => n.navigate("CareTeamChat", { careRecipientId: state.careRecipientId ?? undefined })}/>
    {loading ? <ActivityIndicator color={C.purple}/> : error ?
      <PatientEmpty icon="cloud-offline-outline" title="Care team unavailable" detail={error}/> :
      people.length ? people.map(person => {
        const member = roster.find(item => item.userId === person.user_id);
        return <PatientGlass key={person.user_id} tint="#E9F1F8">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            {person.avatar_url ? <Image source={{ uri: person.avatar_url }}
              accessibilityLabel={"Profile photo of " + (person.full_name || "care team member")}
              style={{ width: 58, height: 58, borderRadius: 29 }}/> :
              <View style={{ width: 58, height: 58, borderRadius: 29,
                justifyContent: "center", alignItems: "center", backgroundColor: themeBackground("#E9D9F3") }}>
                <Text style={{ fontFamily: BOLD, color: themeForeground(PURPLE), fontSize: 22 }}>{(person.full_name || "?")[0].toUpperCase()}</Text>
              </View>}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontFamily: BOLD, fontSize: 16, color: themeForeground(INK) }}>{person.full_name || "Care team member"}</Text>
              <PatientText muted size={13}>{roleName(member)}</PatientText>
            </View>
          </View>
        </PatientGlass>;
      }) :
      <PatientEmpty icon="people-outline" title="Your care circle"
        detail="Authorized care team members will appear here when available."/>}
  </Page>;
}
export function PatientHistoryScreen() {
  const { state } = useCare();
  const { completions } = usePatientPlan(state.careRecipientId);
  const events = useMemo(() => [
    ...state.entries.map(entry => ({ id: "v" + entry.id, date: entry.recordedAt, title: entry.kind + " recorded", info: "Health observation" })),
    ...state.medicationRecords.filter(item => !item.correctedAt).map(item =>
      ({ id: "m" + item.id, date: item.recordedAt, title: item.medication.name, info: "Medication recorded" })),
    ...completions.map(item => ({ id: "c" + item.id, date: item.completedAt, title: "Care activity completed", info: item.note || "Daily care plan" })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [state.entries, state.medicationRecords, completions]);
  return <Page>
    <PatientHeading eyebrow="MY CARE HISTORY" title="The story of your care"
      subtitle="A timeline of activities and observations already recorded."/>
    {events.length ? events.slice(0, 60).map(event => <PatientGlass key={event.id}>
      <View style={{ flexDirection: "row", gap: 13, alignItems: "center" }}>
        <Icon name="checkmark-circle-outline" size={27} color={themeForeground(PURPLE)}/>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: SEMI, fontSize: 15, color: themeForeground(INK) }}>{event.title}</Text>
          <PatientText muted size={13}>{event.info} · {readableDate(event.date)}</PatientText>
        </View>
      </View>
    </PatientGlass>) : <PatientEmpty icon="time-outline" title="Your care story begins here"
      detail="Once your care team records activities, a timeline will appear."/>}
  </Page>;
}
export function PatientProfileScreen() {
  const n = useNav();
  const { state } = useCare();
  const { signOut } = useAuth();
  const avatar = useProfileAvatar();
  const { dark, setMode, saveError } = useAppearance();
  return <Page>
    <PatientHeading eyebrow="MY PROFILE" title="My personal space"
      subtitle="Your account, comfort settings, and care-sharing preferences."/>
    <PatientGlass>
      <View style={{ alignItems: "center", gap: 12, paddingVertical: 9 }}>
        <ProfileAvatar name={state.name || "Care Recipient"} size={87}/>
        <Text style={{ fontFamily: "Lora_500Medium", fontSize: 23,
          color: themeForeground(INK) }}>{state.name || "Your account"}</Text>
        <PatientText muted size={13}>{state.careRecipientName || "Care Recipient"}</PatientText>
        <Pressable accessibilityRole="button" accessibilityLabel="Change profile picture"
          disabled={avatar.busy} onPress={() => void avatar.pickAndUpload()}
          style={{ minHeight: 48, paddingHorizontal: 19, borderRadius: 24,
            backgroundColor: themeBackground("#E8D8F5"), alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: themeForeground(PURPLE), fontFamily: SEMI }}>{avatar.busy ? "Saving photo…" : "Change profile photo"}</Text>
        </Pressable>
        {avatar.error ? <PatientText muted size={13}>{avatar.error}</PatientText> : null}
      </View>
    </PatientGlass>
    <PatientAction icon="contrast-outline" title={dark ? "Switch to light theme" : "Switch to dark theme"}
      detail="Choose a softer display for your eyes" onPress={() => void setMode(dark ? "light" : "dark")}/>
    {saveError ? <PatientText muted>{saveError}</PatientText> : null}
    <PatientAction icon="accessibility-outline" title="Accessibility & display" detail="Text, motion, and appearance"
      onPress={() => n.navigate("Accessibility")}/>
    <PatientAction icon="notifications-outline" title="Notification preferences" detail="Decide which alerts you receive"
      onPress={() => n.navigate("NotificationSettings")}/>
    <PatientAction icon="shield-checkmark-outline" title="Privacy & care sharing" detail="Understand your information and consent"
      onPress={() => n.navigate("PrivacyData")}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Sign out"
      onPress={() => void signOut()} style={{ minHeight: 56,
        borderRadius: 26, backgroundColor: themeBackground("#F3E9F5"),
        justifyContent: "center", alignItems: "center" }}>
      <Text style={{ color: themeForeground(PURPLE), fontFamily: BOLD, fontSize: 15 }}>Sign out</Text>
    </Pressable>
  </Page>;
}
