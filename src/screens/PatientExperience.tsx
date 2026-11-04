import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo, ActivityIndicator, Animated, Image, Platform, Pressable, Text, View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useCare } from "../store";
import { useAuth } from "../auth";
import { useAppearance } from "../appearance";
import { loadCarePlan, type CarePlanItem, type CarePlanCompletion } from "../carePlan";
import { loadMedicationManagement, type ManagedMedication, type ManagedMedicationRecord } from "../medicationManagement";
import { loadCareTeam, type CareTeamMember } from "../careTeam";
import { chatPeople, type ChatPerson } from "../careChat";
import { supabase } from "../supabase";
import { ProfileAvatar, useProfileAvatar } from "../profileAvatar";
import { themeBackground, themeBorder, themeForeground, themeShadow, themeTint } from "../themeColors";
import { Brand, C, Icon, Page } from "../ui";
import { NotificationBell } from "../notifications";
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
    lineHeight: Math.round(size * 1.48), fontFamily: FONT }}>{children}</Text>;
}
/** Shared quiet surfaces across every Care Recipient screen. */
function PatientGlass({ children, tint = "#F4EDFA", compact = false }: {
  children: React.ReactNode; tint?: string; compact?: boolean;
}) {
  return <View style={{
    borderRadius: 23, borderWidth: 1, borderColor: themeBorder("#EAE1EF"),
    backgroundColor: themeBackground("#FFFEFF"), padding: compact ? 15 : 19,
    gap: compact ? 9 : 12, overflow: "hidden",
    shadowColor: themeShadow("#6C4B83"), shadowOpacity: 0.045,
    shadowRadius: 13, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  }}>
    <View pointerEvents="none" style={{ position: "absolute", top: -76, right: -72,
      width: 156, height: 156, borderRadius: 78,
      backgroundColor: themeTint(tint), opacity: 0.26 }}/>
    {children}
  </View>;
}
function PatientHeading({ eyebrow, title, subtitle }: {
  eyebrow: string; title: string; subtitle?: string;
}) {
  return <View style={{ gap: 6, paddingTop: 4 }}>
    <Text style={{ fontFamily: SEMI, letterSpacing: 1.25, fontSize: 10.5,
      color: themeForeground(PURPLE) }}>{eyebrow.toUpperCase()}</Text>
    <Text accessibilityRole="header" style={{ fontFamily: "Lora_500Medium",
      fontSize: 25, letterSpacing: -0.5, lineHeight: 33,
      color: themeForeground(INK) }}>{title}</Text>
    {subtitle ? <PatientText muted size={13.5}>{subtitle}</PatientText> : null}
  </View>;
}
function PatientAction({ icon, title, detail, onPress, accent = "#F2E8FA" }: {
  icon: string; title: string; detail?: string; onPress: () => void; accent?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityHint={detail || "Open page"} onPress={onPress}
    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
    <View style={{
      minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12,
      paddingHorizontal: 14, paddingVertical: 12, borderRadius: 21,
      borderWidth: 1, borderColor: themeBorder("#E9DFF0"),
      backgroundColor: themeBackground("#FFFFFF"),
    }}>
      <View style={{ width: 44, height: 44, borderRadius: 15,
        backgroundColor: themeBackground(accent), alignItems: "center", justifyContent: "center" }}>
        <Icon name={icon} size={22} color={themeForeground(PURPLE)}/>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={{ color: themeForeground(INK), fontFamily: SEMI, fontSize: 14.5 }}>{title}</Text>
        {detail ? <PatientText muted size={12.5}>{detail}</PatientText> : null}
      </View>
      <Icon name="chevron-forward-outline" size={17} color={themeForeground("#8D70A4")}/>
    </View>
  </Pressable>;
}
function PatientTile({ icon, title, detail, onPress, accent = "#F2E8FA" }: {
  icon: string; title: string; detail: string; onPress: () => void; accent?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityHint={detail} onPress={onPress}
    style={({ pressed }) => ({
      flexBasis: "46%", flexGrow: 1, minWidth: 130, minHeight: 142,
      borderRadius: 23, padding: 15, gap: 9, borderWidth: 1,
      borderColor: themeBorder("#E9DFF0"), backgroundColor: themeBackground("#FFFFFF"),
      opacity: pressed ? 0.75 : 1,
    })}>
    <View style={{ width: 44, height: 44, borderRadius: 16,
      alignItems: "center", justifyContent: "center",
      backgroundColor: themeBackground(accent) }}>
      <Icon name={icon} size={22} color={themeForeground(PURPLE)}/>
    </View>
    <Text style={{ color: themeForeground(INK), fontFamily: SEMI, fontSize: 14.5 }}>{title}</Text>
    <Text style={{ color: themeForeground(MUTED), fontFamily: FONT, fontSize: 12.5, lineHeight: 18 }}>{detail}</Text>
  </Pressable>;
}
function PatientEmpty({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return <PatientGlass tint="#F1E8FA">
    <View style={{ alignItems: "center", paddingVertical: 17, gap: 9 }}>
      <View style={{ width: 54, height: 54, borderRadius: 19,
        alignItems: "center", justifyContent: "center", backgroundColor: themeBackground("#F0E6F8") }}>
        <Icon name={icon} size={25} color={themeForeground(PURPLE)}/>
      </View>
      <Text style={{ fontFamily: SEMI, fontSize: 15, color: themeForeground(INK),
        textAlign: "center" }}>{title}</Text>
      <Text style={{ fontFamily: FONT, fontSize: 13, lineHeight: 20,
        color: themeForeground(MUTED), textAlign: "center", maxWidth: 285 }}>{detail}</Text>
    </View>
  </PatientGlass>;
}
function PatientCount({ value, label, icon }: { value: number; label: string; icon: string }) {
  return <View style={{ flex: 1, borderRadius: 20, padding: 16, gap: 7,
    borderWidth: 1, borderColor: themeBorder("#EADDED"),
    backgroundColor: themeBackground("#FFFDFF") }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text style={{ fontFamily: "Lora_500Medium", fontSize: 28, color: themeForeground(PURPLE) }}>{value}</Text>
      <Icon name={icon} size={20} color={themeForeground("#A27CB7")}/>
    </View>
    <PatientText muted size={12.5}>{label}</PatientText>
  </View>;
}
function PatientInfo({ icon, text }: { icon: string; text: string }) {
  return <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10,
    borderRadius: 17, padding: 14, backgroundColor: themeBackground("#F5EFF9") }}>
    <Icon name={icon} size={19} color={themeForeground(PURPLE)}/>
    <View style={{ flex: 1 }}><PatientText muted size={12.5}>{text}</PatientText></View>
  </View>;
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
        Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: Platform.OS !== "web" }),
        Animated.timing(slide, { toValue: 0, duration: 350, useNativeDriver: Platform.OS !== "web" }),
      ]);
      animation.start();
    }).catch(() => {});
    return () => { active = false; animation?.stop(); };
  }, [opacity, slide]);
  return <Animated.View style={{ opacity, transform: [{ translateY: slide }] }}>{children}</Animated.View>;
}
function PatientHeroArt() {
  return <Svg width="100%" height={122} viewBox="0 0 330 122" accessible={false}>
    <Defs>
      <LinearGradient id="patientHero" x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={themeTint("#F9EEFF")}/>
        <Stop offset="1" stopColor={themeTint("#CFA8E7")}/>
      </LinearGradient>
      <LinearGradient id="patientFlow" x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor={themeTint("#D6B1ED")}/>
        <Stop offset="1" stopColor={themeTint("#9F72C4")}/>
      </LinearGradient>
    </Defs>
    <Circle cx="266" cy="46" r="45" fill="url(#patientHero)" opacity={0.94}/>
    <Circle cx="266" cy="46" r="29" fill="none" stroke={themeTint("#FFFFFF")} strokeWidth={2.3} opacity={0.8}/>
    <Path d="M265 17l5 13 13 5-13 5-5 13-5-13-13-5 13-5Z" fill={themeTint("#7946A1")}/>
    <Circle cx="215" cy="25" r="4" fill={themeTint("#C498DE")}/>
    <Circle cx="313" cy="89" r="6" fill={themeTint("#DFC7EF")}/>
    <Path d="M4 102C64 68 99 113 152 91S251 63 331 95" stroke="url(#patientFlow)" strokeWidth={20} strokeLinecap="round" opacity={0.34} fill="none"/>
    <Path d="M0 108C69 80 106 115 154 98S254 73 330 102" stroke={themeTint("#FFFDFE")} strokeWidth={4} opacity={0.82} fill="none"/>
    <Path d="M25 54l4-9 4 9 9 4-9 4-4 9-4-9-9-4Z" fill={themeTint("#D1A9E9")} opacity={0.76}/>
    <Rect x="74" y="43" width="42" height="3" rx="2" fill={themeTint("#E3CEEE")}/>
    <Rect x="89" y="55" width="61" height="3" rx="2" fill={themeTint("#E3CEEE")} opacity={0.7}/>
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
type PatientPlanData = ReturnType<typeof usePatientPlan>;
function PatientPlanContent({ plan, limit }: { plan: PatientPlanData; limit?: number }) {
  const { items, completions, error, loading } = plan;
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
function PatientPlanList({ limit }: { limit?: number }) {
  const { state } = useCare();
  const plan = usePatientPlan(state.careRecipientId);
  return <PatientPlanContent plan={plan} limit={limit}/>;
}
export function PatientHomeScreen() {
  const n = useNav();
  const { state, refresh, syncError } = useCare();
  const first = state.name.trim().split(/\s+/)[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  const plan = usePatientPlan(state.careRecipientId);
  const today = todayItems(plan.items);
  const done = plan.completions.filter(c => c.completedOn === dayKey(new Date()) &&
    today.some(item => item.id === c.itemId)).length;
  const percent = today.length ? Math.max(0, Math.min(100, done / today.length * 100)) : 0;
  return <Page>
    <PatientReveal>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
        marginTop: -10, marginBottom: -10, gap: 8 }}>
        <Brand/>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
          <NotificationBell onPress={() => n.navigate("Notifications")}/>
          <Pressable accessibilityRole="button" accessibilityLabel="Open my profile"
            onPress={() => n.navigate("PatientProfile")}
            style={{ padding: 3, borderRadius: 26, borderWidth: 1,
              backgroundColor: themeBackground("#F2E9F8"), borderColor: themeBorder("#E7D8F0") }}>
            <ProfileAvatar name={state.name || "Care Recipient"} size={39}/>
          </Pressable>
        </View>
      </View>
    </PatientReveal>
    <PatientReveal>
      <View style={{ borderRadius: 29, overflow: "hidden", backgroundColor: themeBackground("#F4E9FA"),
        borderColor: themeBorder("#E4D5EF"), borderWidth: 1, padding: 20, gap: 3 }}>
        <Text style={{ fontFamily: SEMI, fontSize: 10, letterSpacing: 1.5,
          color: themeForeground(PURPLE) }}>MY ENVIZION SPACE · {todayLabel.toUpperCase()}</Text>
        <Text style={{ fontFamily: "Lora_500Medium", fontSize: 30, lineHeight: 40,
          color: themeForeground(INK), marginTop: 7 }}>{greeting}, {first}.</Text>
        <PatientText muted size={13.5}>Your day, your care, and your people. All together.</PatientText>
        <PatientHeroArt/>
        <Pressable accessibilityRole="button" accessibilityLabel="Open my daily care plan"
          onPress={() => n.navigate("PatientDay")} style={{ flexDirection: "row",
            alignItems: "center", alignSelf: "flex-start", gap: 8, minHeight: 43,
            paddingHorizontal: 16, borderRadius: 22, backgroundColor: themeBackground("#70338F") }}>
          <Text style={{ fontFamily: SEMI, color: themeForeground("#FFFFFF"), fontSize: 12.5 }}>View my day</Text>
          <Icon name="arrow-forward-outline" size={16} color={themeForeground("#FFFFFF")}/>
        </Pressable>
      </View>
    </PatientReveal>
    <PatientHeading eyebrow="TODAY'S CARE" title="Your day at a glance"
      subtitle="Only the activities shared by your care team."/>
    {!plan.loading && !plan.error && state.careRecipientId ? <>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <PatientCount value={today.length} label="On today's plan" icon="calendar-outline"/>
        <PatientCount value={done} label="Completed" icon="checkmark-circle-outline"/>
      </View>
      {today.length > 0 && <View accessibilityLabel={done + " of " + today.length + " care activities completed"}
        style={{ height: 6, backgroundColor: themeBackground("#EBE1F1"), borderRadius: 5, overflow: "hidden" }}>
        <View style={{ width: percent + "%", height: "100%", backgroundColor: themeBackground(PURPLE), borderRadius: 5 }}/>
      </View>}
    </> : null}
    <PatientPlanContent plan={plan} limit={2}/>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <PatientHeading eyebrow="ONE TAP AWAY" title="Your care essentials"/>
      <Pressable accessibilityRole="button" accessibilityLabel="View all care features"
        onPress={() => n.navigate("PatientCare")} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ fontFamily: SEMI, color: themeForeground(PURPLE), fontSize: 12.5 }}>View all</Text>
      </Pressable>
    </View>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <PatientTile title="Medications" detail="Schedules & guidance" icon="medical-outline"
        onPress={() => n.navigate("PatientMedications")}/>
      <PatientTile title="Appointments" detail="Visits & next steps" icon="calendar-outline" accent="#E9E9FA"
        onPress={() => n.navigate("PatientAppointments")}/>
      <PatientTile title="My health" detail="Saved measurements" icon="pulse-outline" accent="#E7F4EF"
        onPress={() => n.navigate("PatientHealth")}/>
      <PatientTile title="Care history" detail="Your recorded timeline" icon="time-outline" accent="#F8EDF1"
        onPress={() => n.navigate("PatientHistory")}/>
    </View>
    <PatientAction title="Message my care team" icon="chatbubbles-outline"
      detail="A private chat with your authorized caregivers"
      onPress={() => n.navigate("CareTeamChat", { careRecipientId: state.careRecipientId ?? undefined })}/>
    {syncError ? <PatientInfo icon="cloud-offline-outline" text={syncError}/> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Refresh care information"
      onPress={() => void refresh()} style={{ minHeight: 46, flexDirection: "row", gap: 8,
        justifyContent: "center", alignItems: "center" }}>
      <Icon name="refresh-outline" color={themeForeground(PURPLE)} size={18}/>
      <Text style={{ color: themeForeground(PURPLE), fontFamily: SEMI, fontSize: 13 }}>Refresh my information</Text>
    </Pressable>
  </Page>;
}
export function PatientCareHubScreen() {
  const n = useNav();
  return <Page>
    <PatientHeading eyebrow="MY CARE" title="Everything you need."
      subtitle="Your information, thoughtfully organised in one place."/>
    <PatientGlass tint="#E9DBF5">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
        <View style={{ width: 49, height: 49, borderRadius: 17,
          justifyContent: "center", alignItems: "center", backgroundColor: themeBackground("#F0E5FA") }}>
          <Icon name="sparkles-outline" size={24} color={themeForeground(PURPLE)}/>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: SEMI, fontSize: 15, color: themeForeground(INK) }}>Your personal care space</Text>
          <PatientText muted size={12.5}>Choose what you want to see. Your record remains read-only.</PatientText>
        </View>
      </View>
    </PatientGlass>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
      <PatientTile title="My day" detail="Routines and activities" icon="sunny-outline"
        onPress={() => n.navigate("PatientDay")}/>
      <PatientTile title="Medications" detail="My current medication list" icon="medical-outline" accent="#F8EAF4"
        onPress={() => n.navigate("PatientMedications")}/>
      <PatientTile title="Appointments" detail="Visit plans and details" icon="calendar-outline" accent="#E9E9FA"
        onPress={() => n.navigate("PatientAppointments")}/>
      <PatientTile title="My health" detail="Measurements & history" icon="pulse-outline" accent="#E6F2EB"
        onPress={() => n.navigate("PatientHealth")}/>
    </View>
    <PatientAction icon="time-outline" title="My care history"
      detail="See the recorded events in your care journey"
      onPress={() => n.navigate("PatientHistory")}/>
    <PatientInfo icon="information-circle-outline"
      text="This shared care record helps you stay informed. For medical decisions, speak with your healthcare professional."/>
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
  const [medications, setMedications] = useState<ManagedMedication[]>([]);
  const [records, setRecords] = useState<ManagedMedicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError(""); setMedications([]); setRecords([]);
    if (!state.careRecipientId) { setLoading(false); return () => { active = false; }; }
    loadMedicationManagement(state.careRecipientId).then(data => {
      if (active) {
        setMedications(data.medications.filter(m => m.active));
        setRecords(data.records);
      }
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : "Medication list unavailable.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [state.careRecipientId]));
  return <Page>
    <PatientHeading eyebrow="MY MEDICATIONS" title="A clearer medication list"
      subtitle="The schedules and directions your care team has recorded. Always consult a clinician before changing medication."/>
    {loading ? <ActivityIndicator color={C.purple} accessibilityLabel="Loading medications"/> : error ?
      <PatientEmpty icon="cloud-offline-outline" title="Medication list unavailable" detail={error}/> :
      medications.length ? medications.map(med => {
        const logged = records.filter(record => record.medicationId === med.id && !record.correctedAt);
        return <PatientGlass key={med.id} tint="#F6E9F5">
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Icon name="medical-outline" size={30} color={themeForeground(PURPLE)}/>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: BOLD, color: themeForeground(INK), fontSize: 17 }}>{med.name}</Text>
              <PatientText muted size={13}>{med.isPrn ? "As needed (PRN)" : med.time || "No schedule recorded"}</PatientText>
            </View>
          </View>
          {med.dose || med.route ? <PatientText>{[med.dose, med.route].filter(Boolean).join(" · ")}</PatientText> : null}
          <PatientText>{med.instructions || "No additional instructions recorded."}</PatientText>
          {med.purpose ? <PatientText muted size={13}>Purpose: {med.purpose}</PatientText> : null}
          {med.prescriber ? <PatientText muted size={13}>Recorded prescriber: {med.prescriber}</PatientText> : null}
          {med.pharmacy ? <PatientText muted size={13}>Pharmacy: {med.pharmacy}</PatientText> : null}
          {med.refillDueOn ? <PatientText muted size={13}>Refill date on record: {readableDate(med.refillDueOn)}</PatientText> : null}
          <PatientText muted size={13}>Medication activity: {logged.length} recorded event{logged.length === 1 ? "" : "s"}</PatientText>
        </PatientGlass>;
      }) : <PatientEmpty icon="medkit-outline" title="No medications listed"
        detail="When your care team records a medication, its schedule and instructions will appear here."/>}
    <PatientGlass><PatientText muted size={13}>This shared medication list is not a prescription or dosing recommendation. Patients cannot change clinician instructions or medication records from this page.</PatientText></PatientGlass>
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
    Promise.resolve(supabase.from("appointments")
      .select("id,title,starts_at,appointment_date,appointment_time,location,notes")
      .eq("care_recipient_id", state.careRecipientId)
      .order("created_at", { ascending: false }).limit(50))
      .then(({ data, error: problem }) => {
        if (!active) return;
        if (problem) setError(problem.message);
        else setItems((data ?? []) as PatientAppointment[]);
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [state.careRecipientId]));
  const sorted = [...items].sort((a, b) =>
    String(a.appointment_date || a.starts_at || "9999").localeCompare(String(b.appointment_date || b.starts_at || "9999")));
  const upcoming = sorted.filter(item => !item.appointment_date && !item.starts_at ||
    String(item.appointment_date || item.starts_at).slice(0, 10) >= dayKey(new Date()));
  const past = sorted.filter(item => item.appointment_date || item.starts_at)
    .filter(item => String(item.appointment_date || item.starts_at).slice(0, 10) < dayKey(new Date()));
  const appointmentCard = (item: PatientAppointment) => <PatientGlass key={item.id} tint="#E9F0FD">
    <Text style={{ fontFamily: BOLD, color: themeForeground(INK), fontSize: 17 }}>{item.title}</Text>
    <PatientText>{readableDate(item.appointment_date || item.starts_at)} · {timeLabel(item.appointment_time || (item.starts_at ? item.starts_at.slice(11, 16) : null))}</PatientText>
    <PatientText muted>{item.location || "Location to be confirmed"}</PatientText>
    {item.notes ? <PatientText muted size={13}>{item.notes}</PatientText> : null}
  </PatientGlass>;
  return <Page>
    <PatientHeading eyebrow="MY APPOINTMENTS" title="Looking ahead"
      subtitle="Visit details and preparation notes recorded by your care team."/>
    {loading ? <ActivityIndicator color={C.purple}/> : error ?
      <PatientEmpty icon="cloud-offline-outline" title="Appointments are unavailable" detail={error}/> :
      upcoming.length ? upcoming.map(appointmentCard) :
      <PatientEmpty icon="calendar-outline" title="No upcoming visits"
        detail="Future appointments will appear when your care team adds them."/>}
    {!loading && !error && past.length ? <>
      <PatientHeading eyebrow="PREVIOUS VISITS" title="Earlier appointments"
        subtitle="Past appointments recorded by your care team."/>
      {past.slice(-10).reverse().map(appointmentCard)}
    </> : null}
  </Page>;
}
function Trend({ values }: { values: number[] }) {
  if (values.length < 2) return <PatientText muted size={13}>A trend appears after at least two measurements.</PatientText>;
  const recent = values.slice(-12);
  const min = Math.min(...recent); const max = Math.max(...recent);
  const span = Math.max(1, max - min);
  const points = recent.map((value, i, arr) => {
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
  const [visits, setVisits] = useState<PatientAppointment[]>([]);
  useFocusEffect(useCallback(() => {
    let active = true; setVisits([]);
    if (state.careRecipientId) {
      Promise.resolve(supabase.from("appointments")
        .select("id,title,starts_at,appointment_date,appointment_time,location,notes")
        .eq("care_recipient_id", state.careRecipientId).limit(100))
        .then(({ data }) => { if (active) setVisits((data ?? []) as PatientAppointment[]); })
        .catch(() => { if (active) setVisits([]); });
    }
    return () => { active = false; };
  }, [state.careRecipientId]));
  const events = useMemo(() => [
    ...state.entries.map(entry => ({ id: "v" + entry.id, date: entry.recordedAt, title: entry.kind + " recorded", info: "Health observation" })),
    ...state.medicationRecords.filter(item => !item.correctedAt).map(item =>
      ({ id: "m" + item.id, date: item.recordedAt, title: item.medication.name, info: "Medication recorded" })),
    ...completions.map(item => ({ id: "c" + item.id, date: item.completedAt, title: "Care activity completed", info: item.note || "Daily care plan" })),
    ...visits.filter(visit => visit.appointment_date || visit.starts_at)
      .filter(visit => String(visit.appointment_date || visit.starts_at).slice(0, 10) < dayKey(new Date()))
      .map(visit => ({ id: "a" + visit.id, date: visit.starts_at ||
        String(visit.appointment_date) + "T" + (visit.appointment_time || "12:00:00"),
        title: visit.title, info: "Appointment (scheduled, not attendance-confirmed)" })),
  ].sort((a, b) => b.date.localeCompare(a.date)), [state.entries, state.medicationRecords, completions, visits]);
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
  const { signOut, session } = useAuth();
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
        {session?.user.email ? <PatientText muted size={13}>{session.user.email}</PatientText> : null}
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
