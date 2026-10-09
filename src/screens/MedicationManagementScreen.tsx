import { themeBackground, themeForeground, themeBorder, themeShadow, themeTint } from "../themeColors";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Platform, Pressable, Text, TextInput, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Line, Path, Rect, Stop } from "react-native-svg";
import {
  correctManagedMedicationRecord,
  discontinueManagedMedication,
  loadMedicationManagement,
  recordManagedMedicationOutcome,
  reconcileManagedMedicationList,
  saveManagedMedication,
  type ManagedMedication,
  type ManagedMedicationRecord,
  type MedicationOutcome,
  type MedicationReconciliation,
} from "../medicationManagement";
import {
  medicationOutcomeLabel,
  medicationReconciliationLabel,
  medicationRefillState,
} from "../medicationManagementHelpers";
import { supabase } from "../supabase";
import { useCare } from "../store";
import {
  Button,
  C,
  Card,
  Field,
  Heading,
  Icon,
  Page,
  S,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";

type Draft = {
  id: string | null;
  name: string;
  instructions: string;
  time: string;
  dose: string;
  route: string;
  purpose: string;
  prescriber: string;
  pharmacy: string;
  isPrn: boolean;
  refillDueOn: string;
};

const emptyDraft: Draft = {
  id: null,
  name: "",
  instructions: "",
  time: "",
  dose: "",
  route: "",
  purpose: "",
  prescriber: "",
  pharmacy: "",
  isPrn: false,
  refillDueOn: "",
};



function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}

function MotionBlock({
  children,
  delay = 0,
  reducedMotion,
}: {
  children: React.ReactNode;
  delay?: number;
  reducedMotion: boolean;
}) {
  const opacity = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 16)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 430,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 430,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [delay, opacity, reducedMotion, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function MedicationHeroGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 260 210" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="heroCapsulePurple" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#BE8AF6")} />
          <Stop offset="0.48" stopColor={themeTint("#8B4AD0")} />
          <Stop offset="1" stopColor={themeTint("#6327A0")} />
        </LinearGradient>
        <LinearGradient id="heroCapsuleLight" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#FFFFFF")} />
          <Stop offset="0.52" stopColor={themeTint("#F1E5FF")} />
          <Stop offset="1" stopColor={themeTint("#CFB0F3")} />
        </LinearGradient>
        <LinearGradient id="heroCapsulePink" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#F6DEFF")} />
          <Stop offset="1" stopColor={themeTint("#C99AEF")} />
        </LinearGradient>
      </Defs>

      <Circle cx="143" cy="101" r="92" fill={themeTint("#F4EAFE")} />
      <Circle cx="206" cy="55" r="50" fill={themeTint("#E8D6FB")} opacity={0.72} />
      <Ellipse cx="165" cy="185" rx="72" ry="12" fill={themeTint("#B98BDA")} opacity={0.16} />

      <G transform="translate(83 27) rotate(39 44 68)">
        <Rect x="0" y="0" width="88" height="136" rx="44" fill={themeTint("#6530A4")} opacity={0.14} />
        <Rect x="-2" y="-3" width="88" height="136" rx="44" fill="url(#heroCapsulePurple)" />
        <Path d="M0 67H86V89C86 113 67 133 43 133C19 133 0 113 0 89V67Z" fill="url(#heroCapsuleLight)" />
        <Path d="M17 13C31 2 49 1 61 8" stroke={themeTint("#E9D2FF")} strokeWidth="7" strokeLinecap="round" opacity={0.55} />
        <Path d="M8 72H78" stroke={themeTint("#D9BEF2")} strokeWidth="2" opacity={0.6} />
      </G>

      <G transform="translate(132 93) rotate(101 34 58)">
        <Rect x="0" y="0" width="68" height="116" rx="34" fill={themeTint("#6A31A5")} opacity={0.12} />
        <Rect x="-2" y="-3" width="68" height="116" rx="34" fill="url(#heroCapsuleLight)" />
        <Path d="M0 57H66V80C66 100 51 116 33 116C15 116 0 100 0 80V57Z" fill="url(#heroCapsulePurple)" />
        <Path d="M13 12C25 5 38 5 48 9" stroke={themeTint("#FFFFFF")} strokeWidth="6" strokeLinecap="round" opacity={0.72} />
      </G>

      <G transform="translate(74 105) rotate(-46 30 50)">
        <Rect x="0" y="0" width="60" height="100" rx="30" fill={themeTint("#7240B0")} opacity={0.10} />
        <Rect x="-2" y="-3" width="60" height="100" rx="30" fill="url(#heroCapsulePink)" />
        <Path d="M0 49H58V70C58 87 45 100 29 100C13 100 0 87 0 70V49Z" fill="url(#heroCapsulePurple)" />
        <Path d="M11 10C20 4 33 4 42 8" stroke={themeTint("#FFFFFF")} strokeWidth="5" strokeLinecap="round" opacity={0.6} />
      </G>
    </Svg>
  );
}

function FloatingMedicationHero({ reducedMotion }: { reducedMotion: boolean }) {
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
          duration: 2100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2100,
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
        width: 205,
        height: 176,
        transform: [
          {
            translateY: float.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -8],
            }),
          },
          {
            rotate: float.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", "1.5deg"],
            }),
          },
        ],
      }}
    >
      <MedicationHeroGraphic />
    </Animated.View>
  );
}

function MedicationEmptyGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 190 130" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="emptyMedOrb" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#F1DFFF")} />
          <Stop offset="1" stopColor={themeTint("#F9E9FA")} />
        </LinearGradient>
      </Defs>
      <Circle cx="95" cy="64" r="53" fill="url(#emptyMedOrb)" />
      <Ellipse cx="95" cy="117" rx="42" ry="7" fill={themeTint("#9A5BC6")} opacity={0.10} />
      <G transform="translate(58 27) rotate(-42 37 37)">
        <Rect x="0" y="0" width="74" height="38" rx="19" fill={themeTint("#FFFFFF")} stroke={themeTint("#8D3FBD")} strokeWidth="4" />
        <Path d="M37 1V37" stroke={themeTint("#8D3FBD")} strokeWidth="4" />
        <Path d="M1 19C1 9 9 1 19 1H37V37H19C9 37 1 29 1 19Z" fill={themeTint("#F2E5FF")} />
      </G>
      <Path d="M29 43V57M22 50H36M153 41V59M144 50H162M42 83V93M37 88H47" stroke={themeTint("#C89AEE")} strokeWidth="4" strokeLinecap="round" />
    </Svg>
  );
}

function MedicationSummaryPanel({
  activeCount,
  refillCount,
  latestReview,
}: {
  activeCount: number;
  refillCount: number;
  latestReview: MedicationReconciliation | null;
}) {
  const columns = [
    {
      value: String(activeCount),
      label: "Active",
      detail: "",
    },
    {
      value: String(refillCount),
      label: "Refills due",
      detail: "Includes overdue",
    },
    {
      value: latestReview ? "Reviewed" : "Not reviewed",
      label: "List review",
      detail: latestReview ? medicationReconciliationLabel(latestReview) : "",
    },
  ];

  return (
    <View
      style={{
        minHeight: 112,
        borderRadius: 27,
        borderWidth: 1,
        borderColor: themeBorder("#E6D7F2"),
        backgroundColor: themeBackground("#F6EEFC"),
        flexDirection: "row",
        alignItems: "stretch",
        shadowColor: themeShadow("#56366A"),
        shadowOpacity: 0.055,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
        overflow: "hidden",
      }}
    >
      {columns.map((column, index) => (
        <React.Fragment key={column.label}>
          {index > 0 && (
            <View
              style={{
                width: 1,
                marginVertical: 22,
                backgroundColor: themeBackground("#DDD0E8"),
              }}
            />
          )}
          <View
            style={{
              flex: 1,
              minWidth: 0,
              paddingHorizontal: 8,
              paddingVertical: 18,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
              style={{
                fontFamily: "Lora_500Medium",
                fontSize: column.value.length > 7 ? 20 : 33,
                lineHeight: column.value.length > 7 ? 27 : 39,
                color: themeForeground("#14113C"),
                textAlign: "center",
              }}
            >
              {column.value}
            </Text>
            <Text
              style={{
                marginTop: 4,
                fontFamily: "DMSans_600SemiBold",
                fontSize: 13,
                lineHeight: 18,
                color: themeForeground("#77718A"),
                textAlign: "center",
              }}
            >
              {column.label}
            </Text>
            {Boolean(column.detail) && (
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.78}
                style={{
                  marginTop: 2,
                  fontFamily: "DMSans_400Regular",
                  fontSize: 9.5,
                  lineHeight: 13,
                  color: themeForeground("#8C8297"),
                  textAlign: "center",
                }}
              >
                {column.detail}
              </Text>
            )}
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

function SafetyAccordion({
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
      duration: 280,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [expanded, progress, reducedMotion]);

  return (
    <View
      style={{
        borderRadius: 25,
        borderWidth: 1,
        borderColor: themeBorder("#F3D6DE"),
        backgroundColor: themeBackground("#FFF2F5"),
        overflow: "hidden",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel="Medication safety"
        onPress={onToggle}
        style={({ pressed }) => ({
          minHeight: 88,
          paddingHorizontal: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <View
          style={{
            width: 50,
            height: 50,
            borderRadius: 25,
            backgroundColor: themeBackground("#FFF9FA"),
            borderWidth: 2,
            borderColor: themeBorder("#E9A6B6"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="shield-checkmark-outline" size={25} color={themeForeground("#BB3A59")} />
        </View>
        <Text style={{ flex: 1, fontFamily: "DMSans_700Bold", fontSize: 17, color: themeForeground("#B43151") }}>
          Medication safety
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
          <Icon name="chevron-forward-outline" size={22} color={themeForeground("#B94A63")} />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={{
          maxHeight: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 330],
          }),
          opacity: progress,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            paddingHorizontal: 18,
            paddingBottom: 18,
            gap: 10,
            borderTopWidth: 1,
            borderTopColor: themeBorder("#F0D7DE"),
            paddingTop: 14,
          }}
        >
          <Text style={[S.body, { color: themeForeground("#7E6670") }]}>
            EnVizion records caregiver information; it does not prescribe, calculate doses, or tell you to start, stop, hold, or change a medication.
          </Text>
          <Text style={[S.body, { color: themeForeground("#7E6670") }]}>
            Follow the pharmacy label and the healthcare team’s instructions. Confirm medication changes with the appropriate clinician or pharmacist.
          </Text>
          <Text style={[S.body, { color: themeForeground("#7E6670") }]}>
            For a possible medical emergency or serious medication reaction, use the appropriate local emergency service rather than waiting on the app.
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

export function MedicationManagementScreen() {
  const n = useNav();
  const { state, dispatch } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly =
    state.accessRole === "viewer" || state.accessRole === "patient";

  const [medications, setMedications] = useState<ManagedMedication[]>([]);
  const [records, setRecords] = useState<ManagedMedicationRecord[]>([]);
  const [reconciliations, setReconciliations] = useState<
    MedicationReconciliation[]
  >([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState(false);
  const [recordNotes, setRecordNotes] = useState<Record<string, string>>({});
  const [reconciliationNote, setReconciliationNote] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [safetyExpanded, setSafetyExpanded] = useState(false);
  const reducedMotion = useReducedMotionPreference();

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setMedications([]);
      setRecords([]);
      setReconciliations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await loadMedicationManagement(careRecipientId);
      setMedications(result.medications);
      setRecords(result.records);
      setReconciliations(result.reconciliations);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load medication management.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;
    const channel = supabase
      .channel(`medication-management:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medications",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_records",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "medication_reconciliations",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const active = useMemo(
    () => medications.filter((medication) => medication.active),
    [medications],
  );
  const latestReconciliation = reconciliations[0] ?? null;
  const refillAttention = useMemo(
    () =>
      active.filter((medication) => {
        const status = medicationRefillState(medication);
        return status === "soon" || status === "overdue";
      }),
    [active],
  );

  const activity = useMemo(() => {
    const medicationNames = new Map(medications.map((medication) => [medication.id, medication.name]));
    return [
      ...records.map((record) => ({
        id: "record-" + record.id,
        type: "record" as const,
        at: record.recordedAt,
        title: medicationNames.get(record.medicationId) ?? "Medication",
        subtitle: medicationOutcomeLabel(record.status),
        record,
      })),
      ...reconciliations.map((reconciliation) => ({
        id: "reconciliation-" + reconciliation.id,
        type: "reconciliation" as const,
        at: reconciliation.createdAt,
        title: "List review",
        subtitle: reconciliation.medicationCount + " medication" + (reconciliation.medicationCount === 1 ? "" : "s") + " recorded in review",
        reconciliation,
      })),
    ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [medications, reconciliations, records]);

  function startEdit(medication?: ManagedMedication) {
    if (!medication) {
      setDraft(emptyDraft);
    } else {
      setDraft({
        id: medication.id,
        name: medication.name,
        instructions: medication.instructions,
        time: medication.time,
        dose: medication.dose,
        route: medication.route,
        purpose: medication.purpose,
        prescriber: medication.prescriber,
        pharmacy: medication.pharmacy,
        isPrn: medication.isPrn,
        refillDueOn: medication.refillDueOn,
      });
    }
    setEditing(true);
    setMessage("");
  }

  async function save() {
    if (!careRecipientId || readOnly) return;
    setBusyId("save");
    setMessage("");
    try {
      const medication = await saveManagedMedication({
        careRecipientId,
        ...draft,
      });

      dispatch({
        type: draft.id ? "edit-med" : "add-med",
        medication: {
          id: medication.id,
          name: medication.name,
          instructions: medication.instructions,
          time: medication.time,
        },
      });

      setEditing(false);
      setDraft(emptyDraft);
      await refresh();
      setMessage("Medication details saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save the medication.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function record(
    medication: ManagedMedication,
    status: MedicationOutcome,
  ) {
    if (!careRecipientId || readOnly) return;
    setBusyId("record-" + medication.id);
    setMessage("");
    try {
      const record = await recordManagedMedicationOutcome({
        careRecipientId,
        medicationId: medication.id,
        status,
        note: recordNotes[medication.id] ?? "",
      });
      setRecordNotes((current) => ({ ...current, [medication.id]: "" }));

      if (status === "taken" || status === "prn_taken") {
        dispatch({
          type: "record-med",
          record: {
            id: record.id,
            medication: {
              id: medication.id,
              name: medication.name,
              instructions: medication.instructions,
              time: medication.time,
            },
            recordedAt: record.recordedAt,
          },
        });
      }

      await refresh();
      setMessage(medicationOutcomeLabel(status) + ".");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save this medication record.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function reconcile() {
    if (!careRecipientId || readOnly) return;
    setBusyId("reconcile");
    setMessage("");
    try {
      await reconcileManagedMedicationList(
        careRecipientId,
        reconciliationNote,
      );
      setReconciliationNote("");
      await refresh();
      setMessage(
        "List review saved. A point-in-time record was created for future handoffs.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not reconcile this medication list.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="MEDICATION MANAGEMENT"
          title="Choose a care profile first."
        />
      </Page>
    );
  }

  return (
    <Page>
      <View
        style={{
          marginHorizontal: -20,
          marginTop: -18,
          paddingTop: 18,
          paddingHorizontal: 20,
          paddingBottom: 8,
          gap: 18,
          overflow: "hidden",
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 480 520"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
        >
          <Defs>
            <LinearGradient id="medPageTop" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={themeTint("#FFFDFC")} />
              <Stop offset="0.62" stopColor={themeTint("#FFFDFC")} />
              <Stop offset="1" stopColor={themeTint("#F8F0FD")} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="480" height="520" fill="url(#medPageTop)" />
          <Circle cx="454" cy="22" r="112" fill={themeTint("#F3E7FD")} opacity={0.48} />
          <Circle cx="414" cy="180" r="118" fill={themeTint("#EEDAFB")} opacity={0.24} />
        </Svg>

        <MotionBlock reducedMotion={reducedMotion}>
          <View style={{ minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              onPress={() => n.goBack()}
              style={({ pressed }) => ({
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.64 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Icon name="arrow-back-outline" size={29} color={themeForeground("#6F2E99")} />
            </Pressable>

            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 20,
                color: C.ink,
              }}
            >
              Medications
            </Text>
          </View>
        </MotionBlock>

        <MotionBlock reducedMotion={reducedMotion} delay={60}>
          <View style={{ minHeight: 205, position: "relative", justifyContent: "center" }}>
            <View style={{ maxWidth: 315, zIndex: 2 }}>
              <Text
                style={{
                  fontFamily: "Lora_500Medium",
                  fontSize: 40,
                  lineHeight: 47,
                  letterSpacing: -1.15,
                  color: themeForeground("#11103B"),
                }}
              >
                {"Your medications,\nbeautifully organised."}
              </Text>
            </View>

            <View style={{ position: "absolute", right: -20, top: -22, opacity: 0.95 }}>
              <FloatingMedicationHero reducedMotion={reducedMotion} />
            </View>
          </View>
        </MotionBlock>

        <MotionBlock reducedMotion={reducedMotion} delay={120}>
          <MedicationSummaryPanel
            activeCount={active.length}
            refillCount={refillAttention.length}
            latestReview={latestReconciliation}
          />
        </MotionBlock>
      </View>

      <MotionBlock reducedMotion={reducedMotion} delay={150}>
        <Pressable
          accessibilityRole="button"
          disabled={readOnly || busyId !== null}
          onPress={() => startEdit()}
          style={({ pressed }) => ({
            minHeight: 60,
            borderRadius: 30,
            overflow: "hidden",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: readOnly || busyId !== null ? 0.48 : pressed ? 0.82 : 1,
            transform: [{ scale: pressed && !readOnly ? 0.988 : 1 }],
            shadowColor: themeShadow("#6B2C94"),
            shadowOpacity: 0.14,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 7 },
            elevation: 3,
          })}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 440 60"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0 }}
            accessibilityElementsHidden
          >
            <Defs>
              <LinearGradient id="addMedicationGradient" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={themeTint("#8541B5")} />
                <Stop offset="0.5" stopColor={themeTint("#9743C9")} />
                <Stop offset="1" stopColor={themeTint("#7132A2")} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="440" height="60" rx="30" fill="url(#addMedicationGradient)" />
          </Svg>
          <Icon name="add-outline" size={24} color={C.white} />
          <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 16, color: C.white }}>
            Add medication
          </Text>
        </Pressable>
      </MotionBlock>

      {Boolean(message) && (
        <Card style={{ borderRadius: 22 }}>
          <Text accessibilityRole="alert" style={S.body}>{message}</Text>
        </Card>
      )}

      <MotionBlock reducedMotion={reducedMotion} delay={185}>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: "Lora_500Medium",
            fontSize: 32,
            lineHeight: 39,
            letterSpacing: -0.7,
            color: themeForeground("#15113D"),
          }}
        >
          Medication list
        </Text>
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={190}>
        {loading ? (
          <View
            style={{
              minHeight: 245,
              borderRadius: 28,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 1,
              borderColor: themeBorder("#E8DFF0"),
              backgroundColor: themeBackground("#FFFFFFB8"),
            }}
          >
            <ActivityIndicator color={C.purple} />
          </View>
        ) : !active.length ? (
          <View
            style={{
              minHeight: 220,
              borderRadius: 28,
              borderWidth: 1,
              borderColor: themeBorder("#FFFFFFD8"),
              backgroundColor: themeBackground("#FFFFFFB6"),
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 26,
              paddingVertical: 24,
              shadowColor: themeShadow("#5E3B6A"),
              shadowOpacity: 0.04,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <View style={{ width: 122, height: 84 }}>
              <MedicationEmptyGraphic />
            </View>
            <Text style={{ marginTop: 4, fontFamily: "DMSans_700Bold", fontSize: 20, color: C.ink }}>
              No medications yet
            </Text>
            <Text style={{ marginTop: 7, fontFamily: "DMSans_400Regular", fontSize: 14, lineHeight: 20, color: themeForeground("#7C788D"), textAlign: "center" }}>
              Add your first medication to begin.
            </Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {active.map((medication) => {
              const refillState = medicationRefillState(medication);
              return (
                <View
                  key={medication.id}
                  style={{
                    borderRadius: 25,
                    borderWidth: 1,
                    borderColor: themeBorder("#E9E2EF"),
                    backgroundColor: themeBackground("#FFFFFFC9"),
                    padding: 17,
                    gap: 13,
                    shadowColor: themeShadow("#4C3455"),
                    shadowOpacity: 0.035,
                    shadowRadius: 12,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 1,
                  }}
                >
                  <View style={S.between}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[S.h2, { fontSize: 19 }]}>{medication.name}</Text>
                      <Txt style={S.small}>
                        {[medication.dose, medication.route, medication.time].filter(Boolean).join(" · ") || "Details not fully recorded"}
                      </Txt>
                    </View>
                    {medication.isPrn && (
                      <View style={[S.pill, { backgroundColor: themeBackground("#F2E5FB") }]}>
                        <Text style={[S.small, { color: themeForeground("#75339A") }]}>PRN</Text>
                      </View>
                    )}
                  </View>

                  {Boolean(medication.instructions) && <Txt>{medication.instructions}</Txt>}
                  {Boolean(medication.purpose) && <Txt style={S.small}>Purpose: {medication.purpose}</Txt>}
                  {Boolean(medication.prescriber) && <Txt style={S.small}>Prescriber: {medication.prescriber}</Txt>}
                  {Boolean(medication.pharmacy) && <Txt style={S.small}>Pharmacy: {medication.pharmacy}</Txt>}

                  {Boolean(medication.refillDueOn) && (
                    <Text
                      style={[
                        S.small,
                        refillState === "overdue" || refillState === "soon"
                          ? { color: C.rose, fontFamily: "DMSans_600SemiBold" }
                          : null,
                      ]}
                    >
                      {refillState === "overdue"
                        ? "Refill overdue: "
                        : refillState === "soon"
                          ? "Refill due soon: "
                          : "Refill: "}
                      {medication.refillDueOn}
                    </Text>
                  )}

                  <Field
                    label="Optional note"
                    value={recordNotes[medication.id] ?? ""}
                    onChange={(value) =>
                      setRecordNotes((current) => ({ ...current, [medication.id]: value }))
                    }
                    multiline
                  />

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Taken"
                        disabled={readOnly || busyId !== null}
                        onPress={() => void record(medication, "taken")}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Not taken"
                        secondary
                        disabled={readOnly || busyId !== null}
                        onPress={() => void record(medication, "not_taken")}
                      />
                    </View>
                  </View>

                  {medication.isPrn && (
                    <Button
                      title="PRN taken"
                      secondary
                      disabled={readOnly || busyId !== null}
                      onPress={() => void record(medication, "prn_taken")}
                    />
                  )}

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="Edit"
                        secondary
                        icon="create-outline"
                        disabled={readOnly || busyId !== null}
                        onPress={() => startEdit(medication)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        title="No longer active"
                        secondary
                        disabled={readOnly || busyId !== null}
                        onPress={async () => {
                          setBusyId("stop-" + medication.id);
                          try {
                            await discontinueManagedMedication(careRecipientId, medication.id);
                            dispatch({ type: "remove-med", id: medication.id });
                            await refresh();
                            setMessage(medication.name + " moved out of the active list.");
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "We could not update the active medication list.");
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </MotionBlock>

      {editing && (
        <MotionBlock reducedMotion={reducedMotion}>
          <View
            style={{
              borderRadius: 26,
              borderWidth: 1,
              borderColor: themeBorder("#E8E0EE"),
              backgroundColor: themeBackground("#FFFFFFD2"),
              padding: 18,
              gap: 14,
            }}
          >
            <View style={S.between}>
              <Text style={[S.h2, { fontSize: 21 }]}>
                {draft.id ? "Edit medication" : "Add medication"}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close medication form"
                onPress={() => {
                  setEditing(false);
                  setDraft(emptyDraft);
                }}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: themeBackground("#F5ECFA") }}
              >
                <Icon name="close-outline" size={21} />
              </Pressable>
            </View>

            <Field label="Medication name" value={draft.name} onChange={(name) => setDraft((current) => ({ ...current, name }))} />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Dose" value={draft.dose} onChange={(dose) => setDraft((current) => ({ ...current, dose }))} />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Route" value={draft.route} onChange={(route) => setDraft((current) => ({ ...current, route }))} />
              </View>
            </View>
            <Field label="Directions" value={draft.instructions} onChange={(instructions) => setDraft((current) => ({ ...current, instructions }))} multiline />
            <Field label="Scheduled time" value={draft.time} onChange={(time) => setDraft((current) => ({ ...current, time }))} />
            <Field label="Purpose (optional)" value={draft.purpose} onChange={(purpose) => setDraft((current) => ({ ...current, purpose }))} />
            <Field label="Prescriber (optional)" value={draft.prescriber} onChange={(prescriber) => setDraft((current) => ({ ...current, prescriber }))} />
            <Field label="Pharmacy (optional)" value={draft.pharmacy} onChange={(pharmacy) => setDraft((current) => ({ ...current, pharmacy }))} />
            <Field label="Refill date (YYYY-MM-DD)" value={draft.refillDueOn} onChange={(refillDueOn) => setDraft((current) => ({ ...current, refillDueOn }))} />

            <View style={{ flexDirection: "row", gap: 8 }}>
              {[false, true].map((value) => (
                <View key={String(value)} style={{ flex: 1 }}>
                  <Button
                    title={value ? "PRN" : "Scheduled"}
                    secondary={draft.isPrn !== value}
                    onPress={() => setDraft((current) => ({ ...current, isPrn: value }))}
                  />
                </View>
              ))}
            </View>

            <Button
              title={busyId === "save" ? "Saving…" : "Save medication"}
              disabled={readOnly || busyId !== null || !draft.name.trim() || !draft.instructions.trim()}
              onPress={() => void save()}
            />
          </View>
        </MotionBlock>
      )}

      <MotionBlock reducedMotion={reducedMotion} delay={230}>
        <SafetyAccordion
          expanded={safetyExpanded}
          onToggle={() => setSafetyExpanded((value) => !value)}
          reducedMotion={reducedMotion}
        />
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={270}>
        <View style={{ gap: 12 }}>
          <View style={S.between}>
            <Text
              accessibilityRole="header"
              style={{
                flex: 1,
                fontFamily: "Lora_500Medium",
                fontSize: 32,
                lineHeight: 39,
                letterSpacing: -0.7,
                color: themeForeground("#15113D"),
              }}
            >
              Review your list
            </Text>
            <View
              style={{
                minHeight: 38,
                borderRadius: 19,
                paddingHorizontal: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: themeBackground("#F1E6FB"),
              }}
            >
              <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 12.5, color: themeForeground("#75349B") }}>
                {latestReconciliation ? "Reviewed" : "Not reviewed"}
              </Text>
            </View>
          </View>

          <View
            style={{
              borderRadius: 27,
              borderWidth: 1,
              borderColor: themeBorder("#E6DEE9"),
              backgroundColor: themeBackground("#FFFFFFD2"),
              padding: 17,
              gap: 15,
              shadowColor: themeShadow("#5B3967"),
              shadowOpacity: 0.045,
              shadowRadius: 15,
              shadowOffset: { width: 0, height: 8 },
              elevation: 2,
            }}
          >
            <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 14, lineHeight: 21, color: themeForeground("#77738A") }}>
              Check against pharmacy labels or care team records.
            </Text>

            <View style={{ gap: 8 }}>
              <Text style={[S.h3, { fontSize: 14 }]}>Note (optional)</Text>
              <TextInput
                accessibilityLabel="Medication review note"
                multiline
                placeholder="Add a note..."
                placeholderTextColor={themeForeground("#A5A0B0")}
                value={reconciliationNote}
                onChangeText={setReconciliationNote}
                style={{
                  minHeight: 104,
                  borderRadius: 19,
                  borderWidth: 1,
                  borderColor: themeBorder("#DDD4E2"),
                  backgroundColor: themeBackground("#FFFFFF"),
                  paddingHorizontal: 15,
                  paddingTop: 14,
                  fontFamily: "DMSans_400Regular",
                  fontSize: 14,
                  lineHeight: 20,
                  color: C.ink,
                  textAlignVertical: "top",
                }}
              />
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Confirm list review"
              disabled={readOnly || busyId !== null}
              onPress={() => void reconcile()}
              style={({ pressed }) => ({
                minHeight: 58,
                borderRadius: 29,
                overflow: "hidden",
                alignItems: "center",
                justifyContent: "center",
                opacity: readOnly || busyId !== null ? 0.48 : pressed ? 0.82 : 1,
                transform: [{ scale: pressed && !readOnly ? 0.988 : 1 }],
              })}
            >
              <Svg
                width="100%"
                height="100%"
                viewBox="0 0 420 58"
                preserveAspectRatio="none"
                style={{ position: "absolute", inset: 0 }}
                accessibilityElementsHidden
              >
                <Defs>
                  <LinearGradient id="reviewGradient" x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={themeTint("#8841B6")} />
                    <Stop offset="0.52" stopColor={themeTint("#9844C7")} />
                    <Stop offset="1" stopColor={themeTint("#7332A4")} />
                  </LinearGradient>
                </Defs>
                <Rect x="0" y="0" width="420" height="58" rx="29" fill="url(#reviewGradient)" />
              </Svg>
              <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 15.5, color: C.white }}>
                {busyId === "reconcile" ? "Saving review…" : "Confirm list review"}
              </Text>
            </Pressable>
          </View>
        </View>
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={310}>
        <View style={{ gap: 12 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "Lora_500Medium",
              fontSize: 32,
              lineHeight: 39,
              letterSpacing: -0.7,
              color: C.ink,
            }}
          >
            Recent medication activity
          </Text>

          {!activity.length ? (
            <View
              style={{
                minHeight: 112,
                borderRadius: 25,
                borderWidth: 1,
                borderColor: themeBorder("#E9E2EF"),
                backgroundColor: themeBackground("#FFFFFFC8"),
                padding: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: themeBackground("#F0E3FB"),
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="time-outline" size={25} color={themeForeground("#7335A0")} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[S.h3, { fontSize: 15.5 }]}>No activity yet</Text>
                <Txt style={S.small}>Your medication activity will appear here.</Txt>
              </View>
            </View>
          ) : (
            activity.slice(0, 30).map((item) => (
              <View
                key={item.id}
                style={{
                  borderRadius: 23,
                  borderWidth: 1,
                  borderColor: themeBorder("#E9E2EF"),
                  backgroundColor: themeBackground("#FFFFFFC8"),
                  padding: 15,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: item.type === "reconciliation" ? "#EFE4FB" : "#F5ECFA",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={item.type === "reconciliation" ? "checkmark-done-outline" : "medical-outline"}
                      size={21}
                      color={themeForeground("#7435A1")}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={S.h3}>{item.title}</Text>
                    <Txt style={S.small}>{item.subtitle}</Txt>
                    <Txt style={S.small}>{new Date(item.at).toLocaleString()}</Txt>
                  </View>
                </View>

                {item.type === "record" && item.record.note ? <Txt>{item.record.note}</Txt> : null}
                {item.type === "reconciliation" && item.reconciliation.note ? <Txt>{item.reconciliation.note}</Txt> : null}

                {item.type === "record" && !item.record.correctedAt && (
                  <Button
                    title="Correct / withdraw this record"
                    secondary
                    disabled={readOnly || busyId !== null}
                    onPress={async () => {
                      setBusyId("correct-" + item.record.id);
                      try {
                        const at = await correctManagedMedicationRecord(careRecipientId, item.record.id);
                        dispatch({ type: "correct-med", id: item.record.id, at });
                        await refresh();
                        setMessage("Medication record withdrawn. The original entry remains visible for clarity.");
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "We could not correct this medication record.");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                )}
              </View>
            ))
          )}
        </View>
      </MotionBlock>

      <View
        style={{
          marginTop: 4,
          paddingTop: 15,
          borderTopWidth: 1,
          borderTopColor: themeBorder("#E8E1EB"),
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "DMSans_400Regular",
            fontSize: 12.5,
            lineHeight: 18,
            color: themeForeground("#77738A"),
            textAlign: "center",
          }}
        >
          Follow your healthcare team’s instructions.
        </Text>
      </View>
    </Page>
  );
}
