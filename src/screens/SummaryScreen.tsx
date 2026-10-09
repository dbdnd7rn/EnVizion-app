import { themeBackground, themeBorder, themeTint } from "../themeColors";
import { themeForeground, themeShadow } from "../themeColors";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import {
  appointmentCardState,
  careSummaryMedicationLines,
  medicationHistoryLabel,
  recordedAsTakenCount,
  type CareSummaryMedicationRecord,
} from "../careSummaryHelpers";
import { appointmentLines } from "../domain";
import {
  loadMedicationManagement,
  type ManagedMedication,
  type ManagedMedicationRecord,
} from "../medicationManagement";
import { printResource } from "../printing";
import { supabase } from "../supabase";
import { observationLines } from "../summary";
import { useCare } from "../store";
import { C, Icon, Page, S } from "../ui";
import { useNav } from "./MainScreens";

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

function Entrance({
  children,
  delay = 0,
  reducedMotion,
}: {
  children: React.ReactNode;
  delay?: number;
  reducedMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }

    Animated.timing(progress, {
      toValue: 1,
      delay,
      duration: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [delay, progress, reducedMotion]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [12, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function FolderGraphic() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 250 205"
      accessibilityElementsHidden
    >
      <Defs>
        <LinearGradient id="summaryFolderBack" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#E9C8FF")} />
          <Stop offset="0.55" stopColor={themeTint("#AE70ED")} />
          <Stop offset="1" stopColor={themeTint("#7136B5")} />
        </LinearGradient>
        <LinearGradient id="summaryFolderFront" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#F6E9FF")} />
          <Stop offset="0.43" stopColor={themeTint("#D8B7F7")} />
          <Stop offset="1" stopColor={themeTint("#9C63DE")} />
        </LinearGradient>
        <LinearGradient id="summaryFolderPaper" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#FFFFFF")} />
          <Stop offset="1" stopColor={themeTint("#F4EBFA")} />
        </LinearGradient>
        <LinearGradient id="summaryFolderGlass" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#FFFFFF")} stopOpacity="0.72" />
          <Stop offset="1" stopColor={themeTint("#FFFFFF")} stopOpacity="0.06" />
        </LinearGradient>
      </Defs>

      <Ellipse
        cx="133"
        cy="184"
        rx="92"
        ry="14"
        fill={themeTint("#7136B5")}
        opacity={0.14}
      />

      <G transform="translate(25 31) rotate(5 101 72)">
        <Path
          d="M13 31c0-12 9-22 21-22h50c8 0 13 3 18 9l11 14h72c12 0 21 9 21 21v91c0 13-10 23-23 23H34c-13 0-23-10-23-23Z"
          fill="url(#summaryFolderBack)"
          stroke={themeTint("#EEDBFF")}
          strokeWidth="2"
        />

        <G transform="translate(91 -14) rotate(7 54 66)">
          <Rect
            x="0"
            y="0"
            width="113"
            height="133"
            rx="17"
            fill="url(#summaryFolderPaper)"
            stroke={themeTint("#FFFFFF")}
            strokeWidth="2"
          />
          <Rect x="22" y="29" width="58" height="7" rx="3.5" fill={themeTint("#B493DB")} />
          <Rect x="22" y="49" width="76" height="7" rx="3.5" fill={themeTint("#9E76CC")} />
          <Rect x="22" y="69" width="62" height="7" rx="3.5" fill={themeTint("#B493DB")} />
          <Rect x="22" y="89" width="43" height="7" rx="3.5" fill={themeTint("#C6ACE4")} />
        </G>

        <Path
          d="M2 72c0-12 10-22 22-22h157c12 0 22 10 22 22l-8 81c-1 12-11 21-23 21H34c-12 0-22-9-23-21Z"
          fill="url(#summaryFolderFront)"
          stroke={themeTint("#D6B2F6")}
          strokeWidth="2"
        />
        <Path
          d="M14 74c12-10 28-15 47-15h100c15 0 28 5 38 13l-4 31c-34-22-80-30-124-24-24 3-43 10-58 21Z"
          fill="url(#summaryFolderGlass)"
          opacity={0.7}
        />
        <Path
          d="M21 151c37 17 99 22 163 4"
          fill="none"
          stroke={themeTint("#FFFFFF")}
          strokeWidth="4"
          strokeLinecap="round"
          opacity={0.33}
        />
      </G>
    </Svg>
  );
}

function FloatingFolder({ reducedMotion }: { reducedMotion: boolean }) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      float.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [float, reducedMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        width: 210,
        height: 184,
        transform: [
          {
            translateY: float.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -7],
            }),
          },
          {
            rotate: float.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "1.2deg"],
            }),
          },
        ],
      }}
    >
      <FolderGraphic />
    </Animated.View>
  );
}

function GlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return (
    <View
      style={[
        {
          borderRadius: 25,
          borderWidth: 1,
          borderColor: themeBorder("#E8DDF1"),
          backgroundColor: themeBackground("#FFFFFFD6"),
          shadowColor: themeShadow("#56346A"),
          shadowOpacity: 0.055,
          shadowRadius: 17,
          shadowOffset: { width: 0, height: 8 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function MetricCard({
  icon,
  value,
  label,
  accessibilityValue,
}: {
  icon: string;
  value: string;
  label: string;
  accessibilityValue?: string;
}) {
  return (
    <GlassCard
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 132,
        paddingHorizontal: 11,
        paddingVertical: 14,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
      }}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: themeBackground("#F4E9FC"),
          borderWidth: 1,
          borderColor: themeBorder("#FFFFFF"),
        }}
      >
        <Icon name={icon} size={24} color={themeForeground("#71319B")} />
      </View>
      <Text
        accessibilityLabel={accessibilityValue || value + " " + label}
        style={{
          fontFamily: "DMSans_700Bold",
          fontSize: 28,
          lineHeight: 31,
          color: themeForeground("#16143D"),
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          minHeight: 34,
          textAlign: "center",
          fontFamily: "DMSans_400Regular",
          fontSize: 11.5,
          lineHeight: 16,
          color: themeForeground("#6F6B86"),
        }}
      >
        {label}
      </Text>
    </GlassCard>
  );
}

function SummaryAction({
  title,
  icon,
  primary = false,
  disabled = false,
  onPress,
}: {
  title: string;
  icon: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 59,
        borderRadius: 30,
        overflow: "hidden",
        borderWidth: primary ? 0 : 1.3,
        borderColor: themeBorder("#B98CDA"),
        backgroundColor: primary ? "#7B35A8" : "#FFFFFFA6",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: disabled ? 0.42 : pressed ? 0.82 : 1,
        transform: [{ scale: pressed && !disabled ? 0.988 : 1 }],
        shadowColor: primary ? "#6B2E93" : "#593269",
        shadowOpacity: primary ? 0.18 : 0.035,
        shadowRadius: primary ? 16 : 10,
        shadowOffset: { width: 0, height: 7 },
        elevation: primary ? 4 : 1,
      })}
    >
      {primary && (
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 440 60"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
        >
          <Defs>
            <LinearGradient
              id="summaryActionGradient"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <Stop offset="0" stopColor={themeTint("#8A43BC")} />
              <Stop offset="0.5" stopColor={themeTint("#9844CC")} />
              <Stop offset="1" stopColor={themeTint("#7431A7")} />
            </LinearGradient>
          </Defs>
          <Rect
            x="0"
            y="0"
            width="440"
            height="60"
            rx="30"
            fill="url(#summaryActionGradient)"
          />
        </Svg>
      )}
      <Icon
        name={icon}
        size={24}
        color={primary ? "#FFFFFF" : "#71319B"}
      />
      <Text
        style={{
          fontFamily: "DMSans_600SemiBold",
          fontSize: 16,
          color: primary ? "#FFFFFF" : "#71319B",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: "DMSans_700Bold",
        fontSize: 24,
        lineHeight: 30,
        letterSpacing: -0.4,
        color: themeForeground("#17143D"),
      }}
    >
      {children}
    </Text>
  );
}

function SummaryDisclosure({
  expanded,
  onToggle,
  reducedMotion,
}: {
  expanded: boolean;
  onToggle: () => void;
  reducedMotion: boolean;
}) {
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(expanded ? 1 : 0);
      return;
    }

    Animated.timing(progress, {
      toValue: expanded ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expanded, progress, reducedMotion]);

  return (
    <GlassCard style={{ overflow: "hidden", borderRadius: 26 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="About this summary"
        onPress={onToggle}
        style={({ pressed }) => ({
          minHeight: 88,
          paddingHorizontal: 17,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 21,
            borderWidth: 2,
            borderColor: themeBorder("#77728D"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="information-outline" size={22} color={themeForeground("#68647D")} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: "DMSans_600SemiBold",
              fontSize: 13.5,
              color: themeForeground("#25204B"),
            }}
          >
            Caregiver-entered records.
          </Text>
          <Text style={[S.small, { color: themeForeground("#77728D") }]}>
            Review with your healthcare team.
          </Text>
        </View>
        <Text
          style={{
            fontFamily: "DMSans_600SemiBold",
            fontSize: 12,
            color: themeForeground("#6E3A91"),
          }}
        >
          About this summary
        </Text>
        <Animated.View
          style={{
            transform: [
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "90deg"],
                }),
              },
            ],
          }}
        >
          <Icon name="chevron-forward" size={18} color={themeForeground("#7A6E86")} />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={{
          maxHeight: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 310],
          }),
          opacity: progress,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: themeBorder("#EEE6F3"),
            paddingHorizontal: 18,
            paddingVertical: 16,
            gap: 9,
          }}
        >
          <Text style={S.body}>
            This summary reflects caregiver-entered information saved to this
            care profile, without clinical interpretation.
          </Text>
          <Text style={S.body}>
            “Recorded as taken” means someone logged that dose in EnVizion. It
            is not verified medication adherence.
          </Text>
          <Text style={S.body}>
            Printed summaries include medication history and corrections.
            Review all details with your healthcare team; this is not a
            complete medical record.
          </Text>
        </View>
      </Animated.View>
    </GlassCard>
  );
}

export function SummaryScreen() {
  const n = useNav();
  const {
    state,
    refresh: refreshCare,
    loading: careLoading,
    syncError,
  } = useCare();
  const reducedMotion = useReducedMotionPreference();
  const viewer =
    state.accessRole === "viewer" || state.accessRole === "patient";
  const careRecipientId = state.careRecipientId;

  const [medications, setMedications] = useState<ManagedMedication[]>([]);
  const [records, setRecords] = useState<ManagedMedicationRecord[]>([]);
  const [medLoading, setMedLoading] = useState(true);
  const [medLoaded, setMedLoaded] = useState(false);
  const [medError, setMedError] = useState("");
  const [message, setMessage] = useState("");
  const [printing, setPrinting] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  const refreshMedications = useCallback(async () => {
    if (!careRecipientId) {
      setMedications([]);
      setRecords([]);
      setMedLoading(false);
      setMedLoaded(false);
      setMedError("");
      return;
    }

    setMedLoading(true);
    setMedError("");
    try {
      const result = await loadMedicationManagement(careRecipientId);
      setMedications(result.medications);
      setRecords(result.records);
      setMedLoaded(true);
    } catch (error) {
      setMedLoaded(false);
      setMedError(
        error instanceof Error
          ? error.message
          : "Medication history could not be loaded.",
      );
    } finally {
      setMedLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refreshCare();
  }, [refreshCare]);

  useEffect(() => {
    void refreshMedications();
  }, [refreshMedications]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`care-summary-medications:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medications",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refreshMedications(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_records",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refreshMedications(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refreshMedications]);

  const appointment = useMemo(
    () => appointmentCardState(state.appointmentId, state.appointment),
    [state.appointment, state.appointmentId],
  );

  const recordedTaken = useMemo(
    () => (medLoaded ? recordedAsTakenCount(records) : null),
    [medLoaded, records],
  );

  const activeMedications = useMemo(
    () =>
      medLoaded
        ? medications.filter((medication) => medication.active)
        : state.medications.map((medication) => ({
            ...medication,
            careRecipientId: careRecipientId || "",
            dose: "",
            route: "",
            purpose: "",
            prescriber: "",
            pharmacy: "",
            isPrn: false,
            refillDueOn: "",
            lastReconciledAt: null,
            reconciliationNote: "",
            active: true,
            discontinuedAt: null,
          })),
    [careRecipientId, medLoaded, medications, state.medications],
  );

  const medicationNameById = useMemo(
    () => new Map(medications.map((medication) => [medication.id, medication.name])),
    [medications],
  );

  const historyRecords: CareSummaryMedicationRecord[] = useMemo(
    () =>
      medLoaded
        ? records
        : state.medicationRecords.map((record) => ({
            id: record.id,
            medicationId: record.medication.id,
            status: record.correctedAt ? "corrected" : "recorded",
            recordedAt: record.recordedAt,
            correctedAt: record.correctedAt ?? null,
          })),
    [medLoaded, records, state.medicationRecords],
  );

  const historyNameById = useMemo(() => {
    const map = new Map(medicationNameById);
    state.medicationRecords.forEach((record) => {
      if (!map.has(record.medication.id)) {
        map.set(record.medication.id, record.medication.name);
      }
    });
    return map;
  }, [medicationNameById, state.medicationRecords]);

  async function printSummary() {
    if (viewer || printing) return;

    setPrinting(true);
    setMessage("");
    try {
      const printMedications = medLoaded
        ? medications
        : state.medications.map((medication) => ({
            ...medication,
            active: true,
          }));
      const printRecords: CareSummaryMedicationRecord[] = medLoaded
        ? records
        : state.medicationRecords.map((record) => ({
            id: record.id,
            medicationId: record.medication.id,
            status: record.correctedAt ? "corrected" : "recorded",
            recordedAt: record.recordedAt,
            correctedAt: record.correctedAt ?? null,
          }));

      const lines = [
        "Caregiver-entered records saved to this account. Not a diagnosis, verified clinical medical record, complete care plan, or proof of medication adherence.",
        "APPOINTMENT PREPARATION",
        ...(state.appointmentId
          ? appointmentLines(state.appointment, state.questions)
          : [
              "No upcoming appointment recorded.",
              ...state.questions.map(
                (question, index) => `Question ${index + 1}: ${question}`,
              ),
            ]),
        "OBSERVATIONS",
        ...(state.entries.length
          ? state.entries.flatMap(observationLines)
          : ["No observations recorded yet."]),
        ...careSummaryMedicationLines(printMedications, printRecords),
        "Review this summary with your healthcare team.",
      ];

      await printResource("My care conversation summary", lines);
      setMessage(
        "Print or save requested. Check the window on your browser or device.",
      );
    } catch {
      setMessage(
        "The print window could not open. Please try again on a supported browser or device.",
      );
    } finally {
      setPrinting(false);
    }
  }

  const initialLoading = careLoading && !state.hydrated;

  return (
    <Page>
      <View
        style={{
          marginHorizontal: -20,
          marginTop: -18,
          marginBottom: -42,
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 48,
          gap: 20,
          overflow: "hidden",
          backgroundColor: themeBackground("#FBF7FF"),
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 480 2100"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
        >
          <Defs>
            <LinearGradient id="summaryPageBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={themeTint("#FCF9FF")} />
              <Stop offset="0.36" stopColor={themeTint("#F7EEFE")} />
              <Stop offset="0.7" stopColor={themeTint("#FFFDFE")} />
              <Stop offset="1" stopColor={themeTint("#F0E2FC")} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="480" height="2100" fill="url(#summaryPageBg)" />
          <Circle cx="430" cy="-5" r="150" fill={themeTint("#FFFFFF")} opacity={0.48} />
          <Circle cx="486" cy="220" r="155" fill={themeTint("#E6CCF9")} opacity={0.33} />
          <Circle cx="-38" cy="730" r="118" fill={themeTint("#F4E4FE")} opacity={0.34} />
          <Circle cx="450" cy="1710" r="140" fill={themeTint("#ECD8FB")} opacity={0.35} />
        </Svg>

        <Entrance reducedMotion={reducedMotion}>
          <View
            style={{
              minHeight: 56,
              flexDirection: "row",
              alignItems: "center",
              gap: 15,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => n.goBack()}
              style={({ pressed }) => ({
                width: 52,
                height: 52,
                borderRadius: 26,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: themeBackground("#FFFFFFB5"),
                borderWidth: 1,
                borderColor: themeBorder("#E7D7F0"),
                opacity: pressed ? 0.68 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
                shadowColor: themeShadow("#573369"),
                shadowOpacity: 0.045,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 1,
              })}
            >
              <Icon name="arrow-back-outline" size={26} color={themeForeground("#71319B")} />
            </Pressable>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 19,
                color: themeForeground("#17143D"),
              }}
            >
              Care summary
            </Text>
          </View>
        </Entrance>

        {initialLoading ? (
          <Entrance delay={50} reducedMotion={reducedMotion}>
            <GlassCard
              style={{
                minHeight: 240,
                alignItems: "center",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <ActivityIndicator color={themeForeground("#7839A2")} />
              <Text style={S.body}>Loading care summary…</Text>
            </GlassCard>
          </Entrance>
        ) : !careRecipientId ? (
          <Entrance delay={50} reducedMotion={reducedMotion}>
            <GlassCard style={{ padding: 20, gap: 12 }}>
              <Text style={S.h2}>Choose a care profile first.</Text>
              <Text style={S.body}>
                Your care summary appears after a care profile is selected.
              </Text>
              <SummaryAction
                title="Back to care"
                icon="grid-outline"
                onPress={() => n.navigate("Main", { screen: "Toolkit" })}
              />
            </GlassCard>
          </Entrance>
        ) : (
          <>
            <Entrance delay={45} reducedMotion={reducedMotion}>
              <View
                style={{
                  minHeight: 206,
                  position: "relative",
                  justifyContent: "center",
                }}
              >
                <View style={{ maxWidth: 250, zIndex: 2, gap: 8 }}>
                  <Text
                    style={{
                      fontFamily: "DMSans_700Bold",
                      fontSize: 41,
                      lineHeight: 44,
                      letterSpacing: -1.25,
                      color: themeForeground("#12103B"),
                    }}
                  >
                    Your care,{"\n"}together.
                  </Text>
                  <Text
                    style={{
                      fontFamily: "DMSans_400Regular",
                      fontSize: 18,
                      lineHeight: 25,
                      color: themeForeground("#77738E"),
                    }}
                  >
                    Ready for your next visit.
                  </Text>
                </View>
                <View style={{ position: "absolute", right: -18, top: 4 }}>
                  <FloatingFolder reducedMotion={reducedMotion} />
                </View>
              </View>
            </Entrance>

            <Entrance delay={85} reducedMotion={reducedMotion}>
              <View style={{ flexDirection: "row", gap: 9 }}>
                <MetricCard
                  icon="clipboard-outline"
                  value={String(state.entries.length)}
                  label="Observations"
                />
                <MetricCard
                  icon="medkit-outline"
                  value={
                    medLoading && !medLoaded
                      ? "…"
                      : recordedTaken === null
                        ? "—"
                        : String(recordedTaken)
                  }
                  label={"Doses recorded\nas taken"}
                  accessibilityValue={
                    recordedTaken === null
                      ? "Medication dose total unavailable"
                      : recordedTaken + " doses recorded as taken"
                  }
                />
                <MetricCard
                  icon="chatbubble-outline"
                  value={String(state.questions.length)}
                  label="Questions"
                />
              </View>
            </Entrance>

            <Entrance delay={120} reducedMotion={reducedMotion}>
              <SummaryAction
                title={printing ? "Preparing summary…" : "Print / save summary"}
                icon="print-outline"
                primary
                disabled={printing || viewer}
                onPress={() => void printSummary()}
              />
            </Entrance>

            <Entrance delay={145} reducedMotion={reducedMotion}>
              <SummaryAction
                title="Build visit packet"
                icon="document-text-outline"
                disabled={viewer}
                onPress={() => n.navigate("CarePacket")}
              />
            </Entrance>

            {viewer && (
              <Entrance delay={165} reducedMotion={reducedMotion}>
                <GlassCard
                  style={{
                    paddingHorizontal: 15,
                    paddingVertical: 13,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <Icon name="eye-outline" size={20} color={themeForeground("#74359C")} />
                  <Text style={[S.small, { flex: 1 }]}>
                    View-only access. Print and packet export are available to
                    Owner and Caregiver roles.
                  </Text>
                </GlassCard>
              </Entrance>
            )}

            {Boolean(syncError) && (
              <Entrance delay={170} reducedMotion={reducedMotion}>
                <GlassCard
                  style={{
                    padding: 15,
                    gap: 10,
                    borderColor: themeBorder("#E7D2A9"),
                    backgroundColor: themeBackground("#FFF9ECDF"),
                  }}
                >
                  <Text accessibilityRole="alert" style={S.small}>
                    Showing the care information currently available. Live care
                    data could not be refreshed.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Retry care summary refresh"
                    onPress={() => void refreshCare()}
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <Text
                      style={[
                        S.h3,
                        { fontSize: 13, color: themeForeground("#71319B") },
                      ]}
                    >
                      Try again
                    </Text>
                  </Pressable>
                </GlassCard>
              </Entrance>
            )}

            {Boolean(message) && (
              <Entrance delay={170} reducedMotion={reducedMotion}>
                <GlassCard style={{ padding: 15 }}>
                  <Text accessibilityRole="alert" style={S.small}>
                    {message}
                  </Text>
                </GlassCard>
              </Entrance>
            )}

            <Entrance delay={180} reducedMotion={reducedMotion}>
              <View style={{ gap: 11 }}>
                <SectionTitle>Next visit</SectionTitle>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    appointment.title + ". " + appointment.subtitle
                  }
                  onPress={() => n.navigate("Appointments")}
                  style={({ pressed }) => ({
                    minHeight: 94,
                    borderRadius: 25,
                    borderWidth: 1,
                    borderColor: themeBorder("#E7DCEE"),
                    backgroundColor: themeBackground("#FFFFFFD5"),
                    paddingHorizontal: 16,
                    paddingVertical: 15,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    opacity: pressed ? 0.76 : 1,
                    transform: [{ scale: pressed ? 0.993 : 1 }],
                    shadowColor: themeShadow("#56346A"),
                    shadowOpacity: 0.045,
                    shadowRadius: 15,
                    shadowOffset: { width: 0, height: 7 },
                    elevation: 1,
                  })}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 19,
                      backgroundColor: themeBackground("#F1E6FB"),
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="calendar-outline" size={27} color={themeForeground("#71319B")} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[S.h3, { fontSize: 17 }]}>
                      {appointment.title}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={[S.body, { lineHeight: 20 }]}
                    >
                      {appointment.subtitle}
                    </Text>
                  </View>
                  <Icon name="chevron-forward" size={21} color={themeForeground("#827A92")} />
                </Pressable>
              </View>
            </Entrance>

            <Entrance delay={205} reducedMotion={reducedMotion}>
              <View style={{ gap: 11 }}>
                <SectionTitle>Questions to bring</SectionTitle>
                <GlassCard style={{ padding: 16, gap: 0 }}>
                  {state.questions.length ? (
                    state.questions.map((question, index) => (
                      <View
                        key={state.questionIds[index] || index + "-" + question}
                        style={{
                          minHeight: 58,
                          flexDirection: "row",
                          alignItems: "flex-start",
                          gap: 12,
                          paddingVertical: 10,
                          borderTopWidth: index ? 1 : 0,
                          borderTopColor: themeBorder("#EEE8F2"),
                        }}
                      >
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 16,
                            backgroundColor: themeBackground("#F2E8FA"),
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "DMSans_700Bold",
                              fontSize: 12,
                              color: themeForeground("#71319B"),
                            }}
                          >
                            {String(index + 1).padStart(2, "0")}
                          </Text>
                        </View>
                        <Text
                          style={[
                            S.body,
                            { flex: 1, color: themeForeground("#302852"), paddingTop: 7 },
                          ]}
                        >
                          {question}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View
                      style={{
                        minHeight: 72,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 13,
                      }}
                    >
                      <View
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 19,
                          backgroundColor: themeBackground("#F2E8FA"),
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon
                          name="chatbubble-outline"
                          size={25}
                          color={themeForeground("#71319B")}
                        />
                      </View>
                      <Text style={[S.body, { flex: 1 }]}>
                        No questions added yet.
                      </Text>
                    </View>
                  )}
                </GlassCard>
              </View>
            </Entrance>

            <Entrance delay={230} reducedMotion={reducedMotion}>
              <View style={{ gap: 11 }}>
                <SectionTitle>Recorded observations</SectionTitle>
                <GlassCard style={{ padding: 16, gap: 0 }}>
                  {state.entries.length ? (
                    state.entries.map((entry, index) => {
                      const lines = observationLines(entry);
                      return (
                        <View
                          key={entry.id}
                          style={{
                            paddingVertical: 12,
                            gap: 5,
                            borderTopWidth: index ? 1 : 0,
                            borderTopColor: themeBorder("#EEE8F2"),
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 11,
                            }}
                          >
                            <View
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 17,
                                backgroundColor: themeBackground("#F1E6FB"),
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Icon
                                name="document-text-outline"
                                size={22}
                                color={themeForeground("#71319B")}
                              />
                            </View>
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={S.h3}>{entry.kind}</Text>
                              <Text style={S.small}>
                                {new Date(entry.recordedAt).toLocaleString()}
                              </Text>
                            </View>
                          </View>
                          {lines.slice(1).map((line, lineIndex) => (
                            <Text
                              key={lineIndex}
                              style={[
                                S.small,
                                { color: themeForeground("#6D687E"), marginLeft: 55 },
                              ]}
                            >
                              {line}
                            </Text>
                          ))}
                        </View>
                      );
                    })
                  ) : (
                    <View
                      style={{
                        minHeight: 78,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 13,
                      }}
                    >
                      <View
                        style={{
                          width: 50,
                          height: 50,
                          borderRadius: 19,
                          backgroundColor: themeBackground("#F1E6FB"),
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Icon
                          name="document-text-outline"
                          size={25}
                          color={themeForeground("#71319B")}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Text style={S.h3}>No observations yet.</Text>
                        <Text style={S.small}>
                          Your saved entries will appear here.
                        </Text>
                      </View>
                    </View>
                  )}

                  <View
                    style={{
                      height: 1,
                      backgroundColor: themeBackground("#EEE8F2"),
                      marginVertical: 10,
                    }}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add observation"
                    disabled={viewer}
                    onPress={() =>
                      n.navigate("Main", { screen: "Toolkit" })
                    }
                    style={({ pressed }) => ({
                      minHeight: 48,
                      borderRadius: 21,
                      backgroundColor: themeBackground("#F3E7FB"),
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 9,
                      opacity: viewer ? 0.44 : pressed ? 0.72 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 29,
                        height: 29,
                        borderRadius: 15,
                        backgroundColor: themeBackground("#7531A0"),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="add" size={19} color={themeForeground("#FFFFFF")} />
                    </View>
                    <Text
                      style={{
                        fontFamily: "DMSans_600SemiBold",
                        fontSize: 14,
                        color: themeForeground("#71319B"),
                      }}
                    >
                      Add observation
                    </Text>
                  </Pressable>
                </GlassCard>
              </View>
            </Entrance>

            <Entrance delay={255} reducedMotion={reducedMotion}>
              <View style={{ gap: 11 }}>
                <SectionTitle>Medication list</SectionTitle>
                <GlassCard style={{ padding: 16, gap: 13 }}>
                  {activeMedications.length ? (
                    <View style={{ gap: 10 }}>
                      {activeMedications.map((medication, index) => (
                        <View
                          key={medication.id}
                          style={{
                            paddingTop: index ? 10 : 0,
                            borderTopWidth: index ? 1 : 0,
                            borderTopColor: themeBorder("#EEE8F2"),
                            gap: 2,
                          }}
                        >
                          <Text style={S.h3}>{medication.name}</Text>
                          <Text style={S.small}>
                            {[medication.instructions, medication.time]
                              .filter(Boolean)
                              .join(" · ") || "Details not fully recorded"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={S.body}>No active medications recorded.</Text>
                  )}

                  <View style={{ height: 1, backgroundColor: themeBackground("#EEE8F2") }} />

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Open full medication history"
                    onPress={() => n.navigate("Medications")}
                    style={({ pressed }) => ({
                      minHeight: 64,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 13,
                      opacity: pressed ? 0.72 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 50,
                        height: 50,
                        borderRadius: 19,
                        backgroundColor: themeBackground("#F1E6FB"),
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name="journal-outline" size={25} color={themeForeground("#71319B")} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={S.h3}>Medication history</Text>
                      <Text style={S.small}>
                        Timestamps & withdrawn entries
                      </Text>
                    </View>
                    <Icon
                      name="chevron-forward"
                      size={20}
                      color={themeForeground("#827A92")}
                    />
                  </Pressable>

                  {medLoading && !historyRecords.length ? (
                    <View
                      style={{
                        minHeight: 64,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ActivityIndicator color={themeForeground("#7839A2")} />
                    </View>
                  ) : medError && !historyRecords.length ? (
                    <View style={{ gap: 8 }}>
                      <Text accessibilityRole="alert" style={S.small}>
                        Medication history could not be refreshed.
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void refreshMedications()}
                        style={{ minHeight: 44, justifyContent: "center" }}
                      >
                        <Text
                          style={[
                            S.h3,
                            { fontSize: 13, color: themeForeground("#71319B") },
                          ]}
                        >
                          Try again
                        </Text>
                      </Pressable>
                    </View>
                  ) : historyRecords.length ? (
                    <View style={{ gap: 0 }}>
                      {historyRecords.slice(0, 5).map((record) => {
                        const withdrawn =
                          Boolean(record.correctedAt) ||
                          record.status === "corrected";
                        const taken =
                          record.status === "taken" ||
                          record.status === "prn_taken";
                        return (
                          <View
                            key={record.id}
                            style={{
                              paddingVertical: 11,
                              gap: 3,
                              borderTopWidth: 1,
                              borderTopColor: themeBorder("#EEE8F2"),
                            }}
                          >
                            <View
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                gap: 8,
                              }}
                            >
                              <Text
                                style={[
                                  S.h3,
                                  { flex: 1, fontSize: 14.5 },
                                ]}
                              >
                                {historyNameById.get(record.medicationId) ||
                                  "Medication"}
                              </Text>
                              <Text
                                style={[
                                  S.small,
                                  {
                                    fontFamily: "DMSans_600SemiBold",
                                    color: withdrawn
                                      ? "#A64A63"
                                      : taken
                                        ? "#267B62"
                                        : "#6E687D",
                                  },
                                ]}
                              >
                                {medicationHistoryLabel(record)}
                              </Text>
                            </View>
                            <Text style={S.small}>
                              {new Date(record.recordedAt).toLocaleString()}
                            </Text>
                            {Boolean(record.correctedAt) && (
                              <Text
                                style={[
                                  S.small,
                                  { color: themeForeground("#A64A63") },
                                ]}
                              >
                                Withdrawn:{" "}
                                {new Date(
                                  record.correctedAt as string,
                                ).toLocaleString()}
                              </Text>
                            )}
                            {Boolean(record.note?.trim()) && (
                              <Text style={S.small}>{record.note}</Text>
                            )}
                          </View>
                        );
                      })}
                      {historyRecords.length > 5 && (
                        <Text
                          style={[
                            S.small,
                            { paddingTop: 8, color: themeForeground("#71319B") },
                          ]}
                        >
                          + {historyRecords.length - 5} more in medication
                          history
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={S.small}>No medication history yet.</Text>
                  )}
                </GlassCard>
              </View>
            </Entrance>

            <Entrance delay={280} reducedMotion={reducedMotion}>
              <SummaryDisclosure
                expanded={aboutOpen}
                onToggle={() => setAboutOpen((value) => !value)}
                reducedMotion={reducedMotion}
              />
            </Entrance>
          </>
        )}
      </View>
    </Page>
  );
}
