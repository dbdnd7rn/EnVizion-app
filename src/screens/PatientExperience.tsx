import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo, ActivityIndicator, Animated, Image, Platform, Pressable, Text, View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useCare } from "../store";
import { useAuth } from "../auth";
import { loadCarePlan, type CarePlanItem, type CarePlanCompletion } from "../carePlan";
import { loadMedicationManagement, type ManagedMedication, type ManagedMedicationRecord } from "../medicationManagement";
import { loadCareTeam, type CareTeamMember } from "../careTeam";
import { chatPeople, type ChatPerson } from "../careChat";
import { supabase } from "../supabase";
import { ProfileAvatar, useProfileAvatar } from "../profileAvatar";
import { AccountCareAccessPanel } from "./FamilyProfileScreen";
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
  icon: string; title: string; detail?: string; onPress: () => void; accent?: string;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityHint={detail || "Open " + title} onPress={onPress}
    style={({ pressed }) => ({
      flexBasis: "46%", flexGrow: 1, minWidth: 132, minHeight: 128,
      borderRadius: 23, padding: 15, gap: 12, borderWidth: 1,
      borderColor: themeBorder("#E8DDEE"), backgroundColor: themeBackground("#FFFEFF"),
      overflow: "hidden", opacity: pressed ? 0.72 : 1,
    })}>
    <Svg width={95} height={92} viewBox="0 0 95 92" style={{
      position: "absolute", top: -16, right: -19, opacity: 0.62,
    }} pointerEvents="none">
      <Circle cx={61} cy={31} r={36} fill={themeTint(accent)}/>
      <Circle cx={61} cy={31} r={23} stroke={themeTint("#CBA5E1")} strokeWidth={2.5} fill="none"/>
      <Circle cx={24} cy={62} r={6} fill={themeTint("#DEBDEC")}/>
    </Svg>
    <View style={{ width: 47, height: 47, borderRadius: 17,
      alignItems: "center", justifyContent: "center", backgroundColor: themeBackground(accent) }}>
      <Icon name={icon} size={24} color={themeForeground(PURPLE)}/>
    </View>
    <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
      <Text style={{ color: themeForeground(INK), fontFamily: SEMI, fontSize: 14.5, flex: 1 }}>{title}</Text>
      <Icon name="arrow-forward-outline" size={15} color={themeForeground(PURPLE)}/>
    </View>
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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const today = todayItems(items);
  const completeIds = new Set(completions.filter(c => c.completedOn === dayKey(new Date())).map(c => c.itemId));
  if (loading) return <ActivityIndicator accessibilityLabel="Loading today's care plan" color={C.purple}/>;
  if (error) return <PatientEmpty icon="cloud-offline-outline" title="Plan unavailable" detail={error}/>;
  if (!today.length) return <PatientEmpty icon="sunny-outline" title="No activities today"
    detail="Your care team has not scheduled any activities for today."/>;
  return <View style={{ gap: 9 }}>{today.slice(0, limit ?? today.length).map(item => {
    const completed = completeIds.has(item.id);
    const expanded = expandedId === item.id;
    return <PatientGlass key={item.id} compact tint={completed ? "#E8F6EF" : "#EEE5FA"}>
      <Pressable accessibilityRole="button" accessibilityLabel={item.title}
        accessibilityHint={item.details ? "Show or hide care activity details" : "Care activity"}
        accessibilityState={{ expanded }} disabled={!item.details}
        onPress={() => setExpandedId(expanded ? null : item.id)}
        style={{ flexDirection: "row", alignItems: "center", gap: 11, minHeight: 48 }}>
        <View style={{ width: 43, height: 43, borderRadius: 16, alignItems: "center",
          justifyContent: "center", backgroundColor: themeBackground(completed ? "#E4F4EB" : "#F2E9FA") }}>
          <Icon name={completed ? "checkmark-circle" : "ellipse-outline"} size={25}
            color={themeForeground(completed ? "#24896B" : PURPLE)}/>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: SEMI, color: themeForeground(INK), fontSize: 14.5 }}>{item.title}</Text>
          <PatientText muted size={12}>{item.localTime || "Flexible time"}</PatientText>
        </View>
        <View style={{ borderRadius: 13, paddingHorizontal: 9, paddingVertical: 6,
          backgroundColor: themeBackground(completed ? "#E3F4E9" : "#F0E4FA") }}>
          <Text style={{ fontFamily: SEMI, color: themeForeground(completed ? "#24896B" : PURPLE),
            fontSize: 11 }}>{completed ? "Done" : "Planned"}</Text>
        </View>
        {item.details && <Icon name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
          size={16} color={themeForeground(MUTED)}/>}
      </Pressable>
      {expanded && item.details && <View style={{ backgroundColor: themeBackground("#F8F4FB"),
        borderRadius: 13, padding: 12 }}>
        <PatientText muted size={12.5}>{item.details}</PatientText>
      </View>}
    </PatientGlass>;
  })}</View>;
}
export function PatientHomeScreen() {
  const n = useNav();
  const { state, refresh, syncError } = useCare();
  const first = state.name.trim().split(/\s+/)[0] || "there";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  const todayLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
  const plan = usePatientPlan(state.careRecipientId);
  const today = todayItems(plan.items);
  const doneIds = new Set(plan.completions.filter(c => c.completedOn === dayKey(new Date())).map(c => c.itemId));
  const done = today.filter(item => doneIds.has(item.id)).length;
  const percent = today.length ? Math.round(done / today.length * 100) : 0;
  return <Page>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between",
      marginTop: -12, marginBottom: -12 }}>
      <Brand/>
      <NotificationBell onPress={() => n.navigate("Notifications")}/>
    </View>
    <PatientReveal>
      <View style={{ borderRadius: 29, overflow: "hidden", backgroundColor: themeBackground("#F3E8FA"),
        borderColor: themeBorder("#E6D7EF"), borderWidth: 1, padding: 19, gap: 3 }}>
        <Text style={{ fontFamily: SEMI, fontSize: 11, letterSpacing: 0.8,
          color: themeForeground(PURPLE) }}>{todayLabel}</Text>
        <Text style={{ fontFamily: "Lora_500Medium", fontSize: 30, lineHeight: 41,
          color: themeForeground(INK), marginTop: 3 }}>{greeting}, {first}.</Text>
        <PatientHeroArt/>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name="sparkles-outline" color={themeForeground(PURPLE)} size={17}/>
          <Text style={{ fontFamily: FONT, fontSize: 12.5, color: themeForeground(MUTED) }}>
            One day at a time
          </Text>
        </View>
      </View>
    </PatientReveal>
    <PatientHeading eyebrow="TODAY" title="Your progress"/>
    {!plan.loading && !plan.error && state.careRecipientId ? <>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <PatientCount value={today.length} label="Planned" icon="calendar-outline"/>
        <PatientCount value={done} label="Completed" icon="checkmark-circle-outline"/>
      </View>
      <View accessibilityLabel={done + " of " + today.length + " activities completed"}
        style={{ height: 8, backgroundColor: themeBackground("#EBE0F2"), borderRadius: 6, overflow: "hidden" }}>
        <View style={{ width: `${percent}%` as const, height: "100%",
          backgroundColor: themeBackground(PURPLE), borderRadius: 6 }}/>
      </View>
    </> : null}
    <PatientPlanContent plan={plan} limit={1}/>
    {syncError ? <PatientInfo icon="cloud-offline-outline" text={syncError}/> : null}
    <Pressable accessibilityRole="button" accessibilityLabel="Refresh home care information"
      onPress={() => void refresh()} style={{ width: 45, minHeight: 45,
        alignSelf: "flex-end", alignItems: "center", justifyContent: "center",
        borderRadius: 18, backgroundColor: themeBackground("#F1E8F8") }}>
      <Icon name="refresh-outline" color={themeForeground(PURPLE)} size={19}/>
    </Pressable>
  </Page>;
}
export function PatientCareHubScreen() {
  const n = useNav();
  return <Page>
    <PatientHeading eyebrow="EXPLORE" title="My care"/>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 11 }}>
      <PatientTile title="My day" detail="Daily plan" icon="sunny-outline"
        onPress={() => n.navigate("PatientDay")}/>
      <PatientTile title="Medications" detail="Prescriptions and schedules" icon="medical-outline"
        accent="#F8EAF4" onPress={() => n.navigate("PatientMedications")}/>
      <PatientTile title="Appointments" detail="Visits" icon="calendar-outline"
        accent="#E9E9FA" onPress={() => n.navigate("PatientAppointments")}/>
      <PatientTile title="My health" detail="Measurements" icon="pulse-outline"
        accent="#E6F2EB" onPress={() => n.navigate("PatientHealth")}/>
      <PatientTile title="History" detail="Recorded activity" icon="time-outline"
        accent="#F7EEF3" onPress={() => n.navigate("PatientHistory")}/>
      <PatientTile title="EnVizion AI" detail="Private care toolkit" icon="sparkles-outline"
        accent="#EAE2F8" onPress={() => n.navigate("Assistant")}/>
    </View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4 }}>
      <Icon name="lock-closed-outline" color={themeForeground(PURPLE)} size={16}/>
      <Text style={{ fontFamily: FONT, color: themeForeground(MUTED), fontSize: 12 }}>
        Shared records · Read only
      </Text>
    </View>
  </Page>;
}
export function PatientDayScreen() {
  const { state } = useCare();
  const plan = usePatientPlan(state.careRecipientId);
  const today = todayItems(plan.items);
  const completed = new Set(plan.completions.filter(c => c.completedOn === dayKey(new Date())).map(c => c.itemId));
  const done = today.filter(item => completed.has(item.id)).length;
  return <Page>
    <PatientHeading eyebrow="TODAY" title="My day"/>
    {!plan.loading && !plan.error && Boolean(state.careRecipientId) && <PatientGlass tint="#E9DDF5" compact>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <PatientText muted size={12.5}>Recorded progress today</PatientText>
          <Text style={{ fontFamily: "Lora_500Medium", fontSize: 24, color: themeForeground(INK) }}>
            {done} of {today.length} completed
          </Text>
        </View>
        <Icon name="checkmark-circle-outline" size={29} color={themeForeground(PURPLE)}/>
      </View>
      <View style={{ height: 7, borderRadius: 5, overflow: "hidden",
        backgroundColor: themeBackground("#EDE2F2") }}>
        <View style={{ width: `${Math.round(today.length ? Math.min(100, done / today.length * 100) : 0)}%` as const,
          height: "100%", backgroundColor: themeBackground(PURPLE), borderRadius: 5 }}/>
      </View>
    </PatientGlass>}
    <PatientPlanContent plan={plan}/>
    <PatientInfo icon="information-circle-outline"
      text="Your care team updates this plan."/>
  </Page>;
}
export function PatientMedicationsScreen() {
  const { state } = useCare();
  const [detailMedId, setDetailMedId] = useState<string | null>(null);
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
    <PatientHeading eyebrow="MY CARE" title="Medications"/>
    <PatientInfo icon="shield-checkmark-outline"
      text="Read only · Follow your clinician's directions."/>
    {!loading && !error && medications.length > 0 && <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      <View style={{ borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7,
        backgroundColor: themeBackground("#F0E5F8") }}>
        <Text style={{ fontFamily: SEMI, fontSize: 12, color: themeForeground(PURPLE) }}>
          {medications.length} current medication{medications.length === 1 ? "" : "s"}
        </Text>
      </View>
    </View>}
    {loading ? <ActivityIndicator color={C.purple} accessibilityLabel="Loading medications"/> : error ?
      <PatientEmpty icon="cloud-offline-outline" title="Medication list unavailable" detail={error}/> :
      medications.length ? medications.map(med => {
        const logged = records.filter(record => record.medicationId === med.id && !record.correctedAt);
        return <PatientGlass key={med.id} tint="#F1E4F6">
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ width: 46, height: 46, borderRadius: 16,
              alignItems: "center", justifyContent: "center",
              backgroundColor: themeBackground("#F1E5F9") }}>
              <Icon name="medical-outline" size={23} color={themeForeground(PURPLE)}/>
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ fontFamily: SEMI, fontSize: 16, color: themeForeground(INK) }}>{med.name}</Text>
              <PatientText muted size={12.5}>{med.isPrn ? "As needed (PRN)" : med.time || "Time not recorded"}</PatientText>
            </View>
          </View>
          {(med.dose || med.route) && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {[med.dose, med.route].filter(Boolean).map((value, index) => <View key={index}
              style={{ borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7,
                backgroundColor: themeBackground("#F2EAF8") }}>
              <Text style={{ fontFamily: SEMI, fontSize: 12, color: themeForeground(PURPLE) }}>{value}</Text>
            </View>)}
          </View>}
          <View style={{ padding: 12, borderRadius: 15, backgroundColor: themeBackground("#FAF6FC") }}>
            <PatientText size={13.5}>{med.instructions || "No additional instructions recorded."}</PatientText>
          </View>
          {(med.purpose || med.prescriber || med.pharmacy) && <>
            <Pressable accessibilityRole="button" accessibilityLabel={"More details for " + med.name}
              accessibilityState={{ expanded: detailMedId === med.id }}
              onPress={() => setDetailMedId(detailMedId === med.id ? null : med.id)}
              style={{ flexDirection: "row", alignItems: "center", gap: 7, minHeight: 43 }}>
              <Icon name="information-circle-outline" size={18} color={themeForeground(PURPLE)}/>
              <Text style={{ fontFamily: SEMI, fontSize: 12.5, color: themeForeground(PURPLE) }}>
                {detailMedId === med.id ? "Hide details" : "More details"}
              </Text>
              <Icon name={detailMedId === med.id ? "chevron-up-outline" : "chevron-down-outline"}
                size={16} color={themeForeground(PURPLE)}/>
            </Pressable>
            {detailMedId === med.id && <View style={{ gap: 6 }}>
              {med.purpose ? <PatientText muted size={12.5}>Purpose: {med.purpose}</PatientText> : null}
              {med.prescriber ? <PatientText muted size={12.5}>Prescriber: {med.prescriber}</PatientText> : null}
              {med.pharmacy ? <PatientText muted size={12.5}>Pharmacy: {med.pharmacy}</PatientText> : null}
            </View>}
          </>}
          {med.refillDueOn ? <PatientText muted size={12.5}>Refill date: {readableDate(med.refillDueOn)}</PatientText> : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Icon name="time-outline" size={15} color={themeForeground(PURPLE)}/>
            <PatientText muted size={12}>Medication records: {logged.length} event{logged.length === 1 ? "" : "s"}</PatientText>
          </View>
        </PatientGlass>;
      }) : <PatientEmpty icon="medkit-outline" title="No medications listed yet"
        detail="Your care team will add your medication list."/>}
  </Page>;
}
type PatientAppointment = {
  id: string; title: string; starts_at: string | null; appointment_date: string | null;
  appointment_time: string | null; location: string | null; notes: string | null;
};
export function PatientAppointmentsScreen() {
  const { state } = useCare();
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null);
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
      }).catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load appointments. Please try again.");
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [state.careRecipientId]));
  const sorted = [...items].sort((a, b) =>
    String(a.appointment_date || a.starts_at || "9999").localeCompare(String(b.appointment_date || b.starts_at || "9999")));
  const upcoming = sorted.filter(item => !item.appointment_date && !item.starts_at ||
    String(item.appointment_date || item.starts_at).slice(0, 10) >= dayKey(new Date()));
  const past = sorted.filter(item => item.appointment_date || item.starts_at)
    .filter(item => String(item.appointment_date || item.starts_at).slice(0, 10) < dayKey(new Date()));
  const appointmentCard = (item: PatientAppointment) => {
    const value = item.appointment_date || item.starts_at;
    const parsed = value ? new Date(value.length === 10 ? value + "T12:00:00" : value) : null;
    const valid = parsed && Number.isFinite(parsed.getTime());
    const expanded = expandedVisitId === item.id;
    return <PatientGlass key={item.id} tint="#ECEAF9" compact>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <View style={{ width: 60, minHeight: 68, borderRadius: 18,
          justifyContent: "center", alignItems: "center", gap: 2,
          backgroundColor: themeBackground("#F0E6F8") }}>
          {valid ? <>
            <Text style={{ fontFamily: SEMI, color: themeForeground(PURPLE), fontSize: 10.5 }}>
              {parsed.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}
            </Text>
            <Text style={{ fontFamily: "Lora_500Medium", color: themeForeground(PURPLE), fontSize: 27 }}>
              {parsed.getDate()}
            </Text>
          </> : <Icon name="calendar-outline" size={26} color={themeForeground(PURPLE)}/>}
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={{ fontFamily: SEMI, fontSize: 15, color: themeForeground(INK) }}>{item.title}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Icon name="time-outline" size={14} color={themeForeground(PURPLE)}/>
            <PatientText muted size={12.5}>
              {timeLabel(item.appointment_time || (item.starts_at ? item.starts_at.slice(11, 16) : null))}
            </PatientText>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Icon name="location-outline" size={14} color={themeForeground(PURPLE)}/>
            <PatientText muted size={12.5}>{item.location || "Location pending"}</PatientText>
          </View>
        </View>
      </View>
      {item.notes && <>
        <Pressable accessibilityRole="button" accessibilityLabel={"Visit notes for " + item.title}
          accessibilityState={{ expanded }} onPress={() => setExpandedVisitId(expanded ? null : item.id)}
          style={{ minHeight: 44, alignItems: "center", flexDirection: "row", gap: 8 }}>
          <Icon name="document-text-outline" size={18} color={themeForeground(PURPLE)}/>
          <Text style={{ fontFamily: SEMI, color: themeForeground(PURPLE), fontSize: 12.5 }}>
            {expanded ? "Hide notes" : "Visit notes"}
          </Text>
          <Icon name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
            color={themeForeground(PURPLE)} size={16}/>
        </Pressable>
        {expanded && <View style={{ borderRadius: 13, padding: 11,
          backgroundColor: themeBackground("#F8F4FB") }}>
          <PatientText muted size={12.5}>{item.notes}</PatientText>
        </View>}
      </>}
    </PatientGlass>;
  };
  return <Page>
    <PatientHeading eyebrow="MY CARE" title="Appointments"/>
    {!loading && !error && <View style={{ flexDirection: "row", gap: 9, flexWrap: "wrap" }}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 17,
        backgroundColor: themeBackground("#F0E7F7") }}>
        <Text style={{ fontFamily: SEMI, fontSize: 12, color: themeForeground(PURPLE) }}>
          {upcoming.length} upcoming
        </Text>
      </View>
      {past.length > 0 && <View style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 17,
        backgroundColor: themeBackground("#F5F0F8") }}>
        <Text style={{ fontFamily: FONT, fontSize: 12, color: themeForeground(MUTED) }}>{past.length} previous</Text>
      </View>}
    </View>}
    {loading ? <ActivityIndicator color={C.purple} accessibilityLabel="Loading appointments"/> : error ?
      <PatientEmpty icon="cloud-offline-outline" title="Appointments unavailable" detail={error}/> :
      upcoming.length ? upcoming.map(appointmentCard) :
      <PatientEmpty icon="calendar-outline" title="No upcoming appointments"
        detail="Visits will appear once scheduled."/>}
    {!loading && !error && past.length > 0 && <>
      <PatientHeading eyebrow="HISTORY" title="Past visits"/>
      <PatientInfo icon="information-circle-outline" text="Scheduled visits do not confirm attendance."/>
      {past.slice(-10).reverse().map(appointmentCard)}
    </>}
  </Page>;
}
function Trend({ values }: { values: number[] }) {
  if (values.length < 2) return null;
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
    <PatientHeading eyebrow="MY CARE" title="My health"/>
    {glucose.length > 0 && <PatientGlass tint="#E8F5F0">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="water-outline" size={20} color={themeForeground(PURPLE)}/>
        <Text style={{ fontFamily: SEMI, color: themeForeground(INK), fontSize: 15 }}>Blood glucose</Text>
      </View>
      {glucose.length ? <>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7 }}>
          <Text style={{ fontFamily: "Lora_500Medium", fontSize: 28, color: themeForeground(PURPLE) }}>
            {glucose[glucose.length - 1]}
          </Text>
          <PatientText muted size={12.5}>mg/dL · latest saved</PatientText>
        </View>
        <Trend values={glucose}/>
      </> : null}
    </PatientGlass>}
    {systolic.length > 0 && <PatientGlass tint="#F2E8FA">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="pulse-outline" size={20} color={themeForeground(PURPLE)}/>
        <Text style={{ fontFamily: SEMI, color: themeForeground(INK), fontSize: 15 }}>Systolic blood pressure</Text>
      </View>
      {systolic.length ? <>
        <View style={{ flexDirection: "row", alignItems: "baseline", gap: 7 }}>
          <Text style={{ fontFamily: "Lora_500Medium", fontSize: 28, color: themeForeground(PURPLE) }}>
            {systolic[systolic.length - 1]}
          </Text>
          <PatientText muted size={12.5}>mmHg · latest saved</PatientText>
        </View>
        <Trend values={systolic}/>
      </> : null}
    </PatientGlass>}
    {!glucose.length && !systolic.length && <PatientEmpty icon="pulse-outline"
      title="No trends yet" detail="Your saved readings will appear here."/>}
    {state.entries.length > 0 && <PatientHeading eyebrow="SAVED" title="Recent readings"/>}
    {state.entries.length ? state.entries.slice(0, 15).map(entry => <PatientGlass key={entry.id} compact>
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
        <Text style={{ fontFamily: SEMI, color: themeForeground(INK), fontSize: 14.5 }}>{entry.kind}</Text>
        <PatientText muted size={12}>{readableDate(entry.recordedAt)}</PatientText>
      </View>
      {Object.entries(entry.values).filter(([, value]) => Boolean(value)).map(([key, value]) => (
        <PatientText key={key} size={13}>{key.replace(/_/g, " ")}: {value}</PatientText>
      ))}
    </PatientGlass>) : null}
    <PatientInfo icon="information-circle-outline"
      text="Readings are not a diagnosis. Ask your clinician about concerns."/>
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
    <PatientHeading eyebrow="CONNECTED" title="Your people"/>
    <Pressable accessibilityRole="button" accessibilityLabel="Open private Care Team Chat"
      accessibilityHint="Talk with your authorized care team"
      onPress={() => n.navigate("CareTeamChat", { careRecipientId: state.careRecipientId ?? undefined })}
      style={({ pressed }) => ({
        minHeight: 100, borderRadius: 24, padding: 17, borderWidth: 1,
        borderColor: themeBorder("#DAC8EB"), backgroundColor: themeBackground("#EEE2F8"),
        flexDirection: "row", alignItems: "center", gap: 13,
        overflow: "hidden", opacity: pressed ? 0.75 : 1,
      })}>
      <Svg width={99} height={105} viewBox="0 0 99 105" pointerEvents="none"
        style={{ position: "absolute", right: -14, top: -14, opacity: 0.7 }}>
        <Circle cx={64} cy={37} r={47} fill={themeTint("#E4CDF3")}/>
        <Circle cx={64} cy={37} r={30} stroke={themeTint("#BB94D6")} strokeWidth={2} fill="none"/>
      </Svg>
      <View style={{ width: 55, height: 55, borderRadius: 20,
        backgroundColor: themeBackground("#E0C9F0"), alignItems: "center", justifyContent: "center" }}>
        <Icon name="chatbubbles-outline" size={29} color={themeForeground(PURPLE)}/>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontFamily: SEMI, fontSize: 16, color: themeForeground(INK) }}>Team chat</Text>
        <View style={{ flexDirection: "row", gap: 5, alignItems: "center" }}>
          <Icon name="lock-closed-outline" size={13} color={themeForeground(PURPLE)}/>
          <Text style={{ fontFamily: FONT, fontSize: 12, color: themeForeground(MUTED) }}>Private</Text>
        </View>
      </View>
      <Icon name="arrow-forward-outline" size={21} color={themeForeground(PURPLE)}/>
    </Pressable>
    {loading ? <ActivityIndicator color={C.purple} accessibilityLabel="Loading care team"/> : error ?
      <PatientEmpty icon="cloud-offline-outline" title="Team unavailable" detail={error}/> :
      people.length ? people.map(person => {
        const member = roster.find(item => item.userId === person.user_id);
        return <PatientGlass key={person.user_id} compact tint="#EDE6F8">
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            {person.avatar_url ? <Image source={{ uri: person.avatar_url }}
              accessibilityLabel={"Profile photo of " + (person.full_name || "care team member")}
              style={{ width: 52, height: 52, borderRadius: 26 }}/> :
              <View style={{ width: 52, height: 52, borderRadius: 26,
                justifyContent: "center", alignItems: "center",
                backgroundColor: themeBackground("#EEE2F7") }}>
                <Text style={{ fontFamily: SEMI, color: themeForeground(PURPLE), fontSize: 19 }}>
                  {(person.full_name || "?")[0].toUpperCase()}
                </Text>
              </View>}
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={{ fontFamily: SEMI, fontSize: 14.5, color: themeForeground(INK) }}>
                {person.full_name || "Care team member"}
              </Text>
              <View style={{ alignSelf: "flex-start", paddingHorizontal: 9, paddingVertical: 5,
                backgroundColor: themeBackground("#F1E7F8"), borderRadius: 12 }}>
                <Text style={{ fontFamily: SEMI, fontSize: 11.5, color: themeForeground(PURPLE) }}>
                  {roleName(member)}
                </Text>
              </View>
            </View>
            <Icon name="shield-checkmark-outline" size={19} color={themeForeground("#9470AD")}/>
          </View>
        </PatientGlass>;
      }) : <PatientEmpty icon="people-outline" title="Your care circle"
        detail="Team members will appear when available."/>}
  </Page>;
}
export function PatientHistoryScreen() {
  const { state } = useCare();
  const { completions } = usePatientPlan(state.careRecipientId);
  const [visits, setVisits] = useState<PatientAppointment[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(true);
  const [visitsError, setVisitsError] = useState("");
  useFocusEffect(useCallback(() => {
    let active = true;
    setVisits([]); setVisitsError(""); setVisitsLoading(true);
    if (!state.careRecipientId) {
      setVisitsLoading(false);
      return () => { active = false; };
    }
    Promise.resolve(supabase.from("appointments")
      .select("id,title,starts_at,appointment_date,appointment_time,location,notes")
      .eq("care_recipient_id", state.careRecipientId).limit(100))
      .then(({ data, error: problem }) => {
        if (!active) return;
        if (problem) setVisitsError(problem.message);
        else setVisits((data ?? []) as PatientAppointment[]);
      })
      .catch(reason => {
        if (active) setVisitsError(reason instanceof Error ? reason.message : "Appointment history unavailable.");
      })
      .finally(() => { if (active) setVisitsLoading(false); });
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
    <PatientHeading eyebrow="TIMELINE" title="Care history"/>
    {visitsLoading && <ActivityIndicator color={C.purple} accessibilityLabel="Loading appointment history"/>}
    {Boolean(visitsError) && <PatientEmpty icon="cloud-offline-outline"
      title="Some care history is unavailable" detail={visitsError}/>}
    {!events.length && !visitsLoading && !visitsError
      ? <PatientEmpty icon="time-outline" title="Your care story begins here"
          detail="Recorded events will appear here."/> : events.length > 0 ?
      <View style={{ gap: 10 }}>
        {events.slice(0, 60).map((event, index) => <View key={event.id}
          style={{ flexDirection: "row", alignItems: "stretch", gap: 10 }}>
          <View style={{ width: 28, alignItems: "center" }}>
            <View style={{ width: 31, height: 31, borderRadius: 16,
              backgroundColor: themeBackground("#EEDFF7"),
              alignItems: "center", justifyContent: "center" }}>
              <Icon name={event.id.startsWith("v") ? "pulse-outline" : event.id.startsWith("m") ? "medical-outline" : event.id.startsWith("a") ? "calendar-outline" : "checkmark-outline"} size={16} color={themeForeground(PURPLE)}/>
            </View>
            {index < Math.min(events.length, 60) - 1 && <View style={{ width: 2, flex: 1,
              backgroundColor: themeBackground("#E6D6EF"), marginVertical: 4 }}/>}
          </View>
          <View style={{ flex: 1, paddingBottom: 2 }}>
            <PatientGlass compact>
              <Text style={{ fontFamily: SEMI, fontSize: 14.5,
                color: themeForeground(INK) }}>{event.title}</Text>
              <PatientText muted size={12.5}>{event.info}</PatientText>
              <PatientText muted size={12}>{readableDate(event.date)}</PatientText>
            </PatientGlass>
          </View>
        </View>)}
      </View> : null}
  </Page>;
}
export function PatientProfileScreen() {
  const n = useNav();
  const { state } = useCare();
  const { signOut, session } = useAuth();
  const avatar = useProfileAvatar();
  const [careAccessOpen, setCareAccessOpen] = useState(false);
  return <Page>
    <PatientHeading eyebrow="ACCOUNT" title="Profile"/>
    <View style={{ borderRadius: 27, padding: 21, gap: 14, overflow: "hidden",
      borderWidth: 1, borderColor: themeBorder("#E7D9EF"),
      backgroundColor: themeBackground("#F3E9FA") }}>
      <View style={{ flexDirection: "row", gap: 15, alignItems: "center" }}>
        <ProfileAvatar name={state.name || "Care Recipient"} size={77}/>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ fontFamily: "Lora_500Medium", fontSize: 22,
            color: themeForeground(INK) }}>{state.name || "Your account"}</Text>
          <Text style={{ color: themeForeground(PURPLE), fontFamily: SEMI, fontSize: 11.5 }}>
            CARE RECIPIENT
          </Text>
          {session?.user.email ? <PatientText muted size={12}>{session.user.email}</PatientText> : null}
        </View>
      </View>
      {state.careRecipientName && <PatientInfo icon="shield-checkmark-outline"
        text={"Selected care profile: " + state.careRecipientName}/>}
      <Pressable accessibilityRole="button" accessibilityLabel="Change profile picture"
        disabled={avatar.busy} onPress={() => void avatar.pickAndUpload()}
        style={{ minHeight: 45, borderRadius: 18, backgroundColor: themeBackground("#FFFFFF"),
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
          borderWidth: 1, borderColor: themeBorder("#E4D4EC") }}>
        <Icon name="camera-outline" size={17} color={themeForeground(PURPLE)}/>
        <Text style={{ color: themeForeground(PURPLE), fontFamily: SEMI, fontSize: 13 }}>
          {avatar.busy ? "Saving your photo…" : "Change profile photo"}
        </Text>
      </Pressable>
      {avatar.error ? <Text accessibilityRole="alert" style={{ fontFamily: FONT,
        fontSize: 12.5, color: themeForeground("#B34761") }}>{avatar.error}</Text> : null}
    </View>
    <PatientHeading eyebrow="CONTROLS" title="Settings"/>
    <Pressable accessibilityRole="button" accessibilityLabel="Manage care access"
      accessibilityState={{ expanded: careAccessOpen }}
      onPress={() => setCareAccessOpen(value => !value)}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 13, minHeight: 65,
        borderRadius: 20, borderWidth: 1, borderColor: themeBorder("#E9DFF0"),
        backgroundColor: themeBackground("#FFFEFF"), paddingHorizontal: 16,
        opacity: pressed ? 0.75 : 1,
      })}>
      <View style={{ width: 43, height: 43, borderRadius: 15,
        backgroundColor: themeBackground("#EEE4F7"), alignItems: "center", justifyContent: "center" }}>
        <Icon name="people-outline" size={22} color={themeForeground(PURPLE)}/>
      </View>
      <Text style={{ fontFamily: SEMI, fontSize: 14, flex: 1,
        color: themeForeground(INK) }}>Care access</Text>
      <Icon name={careAccessOpen ? "chevron-up-outline" : "chevron-forward-outline"}
        size={19} color={themeForeground(PURPLE)}/>
    </Pressable>
    {careAccessOpen && <AccountCareAccessPanel/>}
    <PatientAction icon="accessibility-outline" title="Display & accessibility"
      onPress={() => n.navigate("Accessibility")}/>
    <PatientAction icon="notifications-outline" title="Notifications"
      onPress={() => n.navigate("NotificationSettings")}/>
    <PatientAction icon="shield-checkmark-outline" title="Privacy"
      onPress={() => n.navigate("PrivacyData")}/>
    <Pressable accessibilityRole="button" accessibilityLabel="Sign out"
      onPress={() => void signOut()} style={{ minHeight: 52, borderRadius: 20,
        backgroundColor: themeBackground("#F5EDF7"), borderWidth: 1,
        borderColor: themeBorder("#EBDDF1"), flexDirection: "row", gap: 9,
        justifyContent: "center", alignItems: "center" }}>
      <Icon name="log-out-outline" size={18} color={themeForeground(PURPLE)}/>
      <Text style={{ color: themeForeground(PURPLE), fontFamily: SEMI, fontSize: 13.5 }}>Sign out</Text>
    </Pressable>
  </Page>;
}
