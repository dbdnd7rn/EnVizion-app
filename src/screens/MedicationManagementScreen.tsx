import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
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


function MedicationHeroGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 360 250">
      <Defs>
        <LinearGradient id="medHeroBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FBF3FD" />
          <Stop offset="1" stopColor="#EEE4FB" />
        </LinearGradient>
        <LinearGradient id="medPurple" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#9D66D3" />
          <Stop offset="1" stopColor="#6D35A0" />
        </LinearGradient>
        <LinearGradient id="medPink" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF9FBB" />
          <Stop offset="1" stopColor="#F86C92" />
        </LinearGradient>
      </Defs>

      <Path d="M28 202c-6-53 15-108 63-143 49-36 116-41 168-11 45 26 61 72 49 118-11 42-48 66-100 70H75c-26 0-44-10-47-34Z" fill="url(#medHeroBg)" />
      <Ellipse cx="301" cy="180" rx="18" ry="60" fill="#8C5CC9" transform="rotate(22 301 180)" />
      <Ellipse cx="322" cy="190" rx="15" ry="53" fill="#B18BDF" transform="rotate(34 322 190)" />
      <Ellipse cx="285" cy="115" rx="15" ry="51" fill="#A779D6" transform="rotate(-8 285 115)" />

      <Path d="M132 83c-17-27-55-10-43 18 10 22 43 38 43 38s33-17 43-39c12-28-26-44-43-17Z" fill="url(#medPink)" />

      <G transform="translate(182 64) rotate(6 62 78)">
        <Rect x="0" y="0" width="122" height="156" rx="16" fill="#7441A8" />
        <Rect x="10" y="13" width="102" height="132" rx="11" fill="#FFFDFE" />
        <Rect x="42" y="-8" width="40" height="24" rx="8" fill="#8E5BC0" />
        <Path d="M33 29h12c9 0 14 4 14 11 0 6-4 10-10 11l12 16h-11L39 52h-6v15h-9V29h9Zm0 8v8h10c5 0 7-1 7-4s-2-4-7-4H33Z" fill="#854AB2" />
        <Path d="M34 49h21" stroke="#D2BDE8" strokeWidth="6" strokeLinecap="round" />
        <Path d="M34 68h58" stroke="#DCCDEA" strokeWidth="6" strokeLinecap="round" />
        <Path d="M34 87h49" stroke="#DCCDEA" strokeWidth="6" strokeLinecap="round" />
        <Path d="M34 106h61" stroke="#DCCDEA" strokeWidth="6" strokeLinecap="round" />
        <Path d="M34 125h38" stroke="#DCCDEA" strokeWidth="6" strokeLinecap="round" />
        <Path d="M31 28c8-13 22-10 24 0-2 13-24 13-24 0Z" fill="#D9C0ED" opacity="0.45" />
        <Path d="M35 37l9-22M51 37l-3-21" stroke="#7F4CB3" strokeWidth="4" strokeLinecap="round" />
      </G>

      <G transform="translate(111 96)">
        <Rect x="0" y="28" width="78" height="98" rx="17" fill="#EFE9F7" />
        <Rect x="4" y="36" width="70" height="90" rx="14" fill="#FFFDFE" />
        <Rect x="5" y="10" width="68" height="34" rx="10" fill="url(#medPurple)" />
        <Rect x="12" y="17" width="54" height="3" rx="1.5" fill="#6E379E" opacity="0.7" />
        <Rect x="13" y="22" width="52" height="3" rx="1.5" fill="#6E379E" opacity="0.7" />
        <Path d="M39 62v29M25 76h28" stroke="#7F42AE" strokeWidth="12" strokeLinecap="round" />
      </G>

      <G transform="translate(64 129) rotate(-12 35 35)">
        <Rect x="0" y="0" width="62" height="84" rx="15" fill="#EEE5F9" />
        <Circle cx="19" cy="18" r="11" fill="#FFFFFF" stroke="#D8C7EA" strokeWidth="3" />
        <Circle cx="43" cy="26" r="11" fill="#FFFFFF" stroke="#D8C7EA" strokeWidth="3" />
        <Circle cx="18" cy="48" r="11" fill="#FFFFFF" stroke="#D8C7EA" strokeWidth="3" />
        <Circle cx="43" cy="58" r="11" fill="#FFFFFF" stroke="#D8C7EA" strokeWidth="3" />
      </G>

      <G transform="translate(50 200) rotate(-28 30 10)">
        <Rect x="0" y="0" width="60" height="20" rx="10" fill="#7C40AF" />
        <Rect x="30" y="0" width="30" height="20" rx="10" fill="#6D319B" />
      </G>

      <G transform="translate(221 200) rotate(-38 31 10)">
        <Rect x="0" y="0" width="62" height="20" rx="10" fill="#7E49B6" />
        <Rect x="31" y="0" width="31" height="20" rx="10" fill="#FF7299" />
      </G>
      <Ellipse cx="278" cy="222" rx="18" ry="10" fill="#FFF" stroke="#E5DAED" strokeWidth="2" />
      <Line x1="34" y1="234" x2="331" y2="234" stroke="#EEE4F2" strokeWidth="2" />
      <Path d="M222 95c0-17 13-30 30-30" stroke="#7E43AF" strokeWidth="6" fill="none" strokeLinecap="round" />
    </Svg>
  );
}

function MedicationEmptyGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 220 120">
      <Path d="M27 102c8-39 34-70 77-70 47 0 79 31 87 70H27Z" fill="#F4ECFB" />
      <Ellipse cx="58" cy="88" rx="12" ry="36" fill="#A97ED5" transform="rotate(-34 58 88)" />
      <Ellipse cx="82" cy="90" rx="10" ry="31" fill="#C8ADE5" transform="rotate(20 82 90)" />
      <Ellipse cx="151" cy="88" rx="11" ry="34" fill="#B38ADA" transform="rotate(35 151 88)" />
      <G transform="translate(81 10)">
        <Rect x="0" y="24" width="58" height="74" rx="14" fill="#FFF" stroke="#E8DDF1" strokeWidth="2" />
        <Rect x="2" y="5" width="54" height="28" rx="9" fill="#8A4FB8" />
        <Path d="M29 48v25M17 61h24" stroke="#8A4FB8" strokeWidth="10" strokeLinecap="round" />
      </G>
      <G transform="translate(128 84) rotate(-28 25 8)">
        <Rect x="0" y="0" width="50" height="16" rx="8" fill="#7840A8" />
        <Rect x="25" y="0" width="25" height="16" rx="8" fill="#5F2B8C" />
      </G>
    </Svg>
  );
}

function MedicationActivityGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 120 90">
      <Path d="M8 75c8-33 26-54 54-54 30 0 47 20 50 54H8Z" fill="#F1E8FA" />
      <G transform="translate(24 12)">
        <Path d="M0 0h45l17 17v54H0Z" fill="#8C55BC" />
        <Path d="M45 0v18h18" fill="#B786D8" />
        <Rect x="10" y="26" width="31" height="5" rx="2.5" fill="#DABEEA" />
        <Rect x="10" y="39" width="27" height="5" rx="2.5" fill="#DABEEA" />
        <Rect x="10" y="52" width="23" height="5" rx="2.5" fill="#DABEEA" />
      </G>
      <Circle cx="83" cy="66" r="19" fill="#6E36A2" />
      <Path d="M83 54v12l8 5" stroke="#FFF" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
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

  const refresh = useCallback(async () => {
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
          minHeight: 248,
          flexDirection: "row",
          alignItems: "center",
          gap: 2,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            flex: 1,
            minWidth: 0,
            gap: 9,
            paddingTop: 3,
          }}
        >
          <Text
            style={[
              S.eyebrow,
              { color: "#74329A", fontSize: 10.5, letterSpacing: 2.4 },
            ]}
          >
            MEDICATION MANAGEMENT
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 36,
              lineHeight: 40,
              letterSpacing: -0.9,
              color: "#17143D",
              maxWidth: 260,
            }}
          >
            Your medications, all in one place.
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 15.5,
              lineHeight: 22,
              color: "#787288",
              maxWidth: 245,
            }}
          >
            Keep track, stay organized, and be ready for care transitions.
          </Text>
        </View>

        <View
          pointerEvents="none"
          style={{
            width: 194,
            height: 220,
            marginRight: -8,
          }}
        >
          <MedicationHeroGraphic />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Medication safety"
        onPress={() => n.navigate("Emergency")}
        style={({ pressed }) => ({
          minHeight: 108,
          borderRadius: 25,
          borderWidth: 1,
          borderColor: "#F5CFD7",
          backgroundColor: "#FFF1F2",
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 5,
            borderColor: "#FFE2E6",
          }}
        >
          <Icon name="shield-checkmark-outline" size={29} color="#D74361" />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 16,
              color: "#BA3A57",
            }}
          >
            Medication safety
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 12.5,
              lineHeight: 18,
              color: "#8F7080",
            }}
          >
            EnVizion records your information; it does not prescribe or change
            medications.
          </Text>
        </View>
        <Icon name="chevron-forward" size={22} color="#C73857" />
      </Pressable>

      <View style={{ flexDirection: "row", gap: 9 }}>
        {[
          {
            label: "ACTIVE",
            value: String(active.length),
            sub: "medications",
            icon: "medical-outline",
            bg: "#F1E5FA",
            color: "#7D3BB1",
            ring: "#EEE4F8",
          },
          {
            label: "REFILL ATTENTION",
            value: String(refillAttention.length),
            sub: "due / overdue",
            icon: "notifications-outline",
            bg: "#FFECEF",
            color: "#D63857",
            ring: "#FCE4E9",
          },
          {
            label: "RECONCILED",
            value: latestReconciliation ? "Yes" : "Not yet",
            sub: "",
            icon: "document-text-outline",
            bg: "#F1E5FA",
            color: "#7D3BB1",
            ring: "#EEE4F8",
          },
        ].map((stat) => (
          <View
            key={stat.label}
            style={{
              flex: 1,
              minWidth: 0,
              minHeight: 154,
              borderRadius: 23,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#ECE7EF",
              padding: 14,
              gap: 8,
              shadowColor: "#3F294B",
              shadowOpacity: 0.025,
              shadowRadius: 8,
              shadowOffset: { width: 0, height: 4 },
              elevation: 1,
            }}
          >
            <View style={S.between}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  backgroundColor: stat.bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={stat.icon} size={24} color={stat.color} />
              </View>
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 19,
                  borderWidth: 7,
                  borderColor: stat.ring,
                }}
              />
            </View>
            <Text
              style={[
                S.eyebrow,
                {
                  fontSize: 8.5,
                  lineHeight: 11,
                  letterSpacing: 1.5,
                  color: "#6A477F",
                },
              ]}
            >
              {stat.label}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: stat.value === "Not yet" ? 17 : 26,
                lineHeight: stat.value === "Not yet" ? 21 : 30,
                color: "#17143D",
              }}
            >
              {stat.value}
            </Text>
            {Boolean(stat.sub) && (
              <Text style={[S.small, { fontSize: 11.5 }]}>{stat.sub}</Text>
            )}
          </View>
        ))}
      </View>

      {Boolean(message) && (
        <Card style={{ borderRadius: 20, padding: 14 }}>
          <Text accessibilityRole="alert" style={[S.small, { color: C.ink }]}>
            {message}
          </Text>
        </Card>
      )}

      <View style={{ gap: 12 }}>
        <View style={S.between}>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 25,
              lineHeight: 31,
              color: "#17143D",
            }}
          >
            Active medications
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => n.navigate("CarePlan")}
            style={({ pressed }) => ({
              minHeight: 44,
              borderRadius: 22,
              paddingHorizontal: 14,
              backgroundColor: "#F4ECFA",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Icon name="list-outline" size={18} color="#72369A" />
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 12.5,
                color: "#72369A",
              }}
            >
              Open daily care plan
            </Text>
            <Icon name="chevron-forward" size={16} color="#72369A" />
          </Pressable>
        </View>

        {loading ? (
          <Card
            style={{
              minHeight: 150,
              borderRadius: 24,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ActivityIndicator color={C.purple} />
          </Card>
        ) : !active.length ? (
          <View
            style={{
              borderRadius: 26,
              borderWidth: 1,
              borderColor: "#E8E1EB",
              backgroundColor: "#FFFFFF",
              padding: 14,
              gap: 12,
            }}
          >
            <View
              style={{
                minHeight: 110,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
              }}
            >
              <View style={{ width: 150, height: 105 }}>
                <MedicationEmptyGraphic />
              </View>
              <View style={{ flex: 1, gap: 5 }}>
                <Text
                  style={{
                    fontFamily: "DMSans_700Bold",
                    fontSize: 16,
                    lineHeight: 20,
                    color: "#17143D",
                  }}
                >
                  No active medications yet.
                </Text>
                <Text
                  style={{
                    fontFamily: "DMSans_400Regular",
                    fontSize: 12.5,
                    lineHeight: 18,
                    color: "#7B7489",
                  }}
                >
                  Add medications from the pharmacy label or current care-team list.
                </Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={readOnly || busyId !== null}
              onPress={() => startEdit()}
              style={({ pressed }) => ({
                minHeight: 56,
                borderRadius: 28,
                backgroundColor: "#7E38A2",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                opacity: readOnly || busyId !== null ? 0.5 : pressed ? 0.84 : 1,
              })}
            >
              <Icon name="add-outline" size={23} color="#FFFFFF" />
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 15,
                  color: "#FFFFFF",
                }}
              >
                Add medication
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {active.map((medication) => {
              const refillState = medicationRefillState(medication);
              return (
                <Card key={medication.id} style={{ borderRadius: 24, gap: 12 }}>
                  <View style={S.between}>
                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[S.h2, { fontSize: 20 }]}>
                        {medication.name}
                      </Text>
                      <Txt style={S.small}>
                        {[medication.dose, medication.route, medication.time]
                          .filter(Boolean)
                          .join(" · ") || "Details not fully recorded"}
                      </Txt>
                    </View>
                    {medication.isPrn && (
                      <View style={[S.pill, { backgroundColor: C.lavender }]}>
                        <Txt style={S.small}>PRN</Txt>
                      </View>
                    )}
                  </View>

                  <Txt>{medication.instructions}</Txt>
                  {Boolean(medication.refillDueOn) && (
                    <Txt
                      style={[
                        S.small,
                        refillState === "overdue" || refillState === "soon"
                          ? { color: C.rose }
                          : null,
                      ]}
                    >
                      Refill: {medication.refillDueOn}
                    </Txt>
                  )}

                  <Field
                    label="Optional note"
                    value={recordNotes[medication.id] ?? ""}
                    onChange={(value) =>
                      setRecordNotes((current) => ({
                        ...current,
                        [medication.id]: value,
                      }))
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

                  <Button
                    title="Edit medication"
                    secondary
                    icon="create-outline"
                    disabled={readOnly || busyId !== null}
                    onPress={() => startEdit(medication)}
                  />
                  <Button
                    title="Mark no longer active"
                    secondary
                    disabled={readOnly || busyId !== null}
                    onPress={async () => {
                      setBusyId("stop-" + medication.id);
                      try {
                        await discontinueManagedMedication(
                          careRecipientId,
                          medication.id,
                        );
                        dispatch({ type: "remove-med", id: medication.id });
                        await refresh();
                        setMessage(
                          medication.name +
                            " moved out of the active list. This records the list change; it is not medical advice.",
                        );
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : "We could not update the active medication list.",
                        );
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                </Card>
              );
            })}

            <Pressable
              accessibilityRole="button"
              disabled={readOnly || busyId !== null}
              onPress={() => startEdit()}
              style={({ pressed }) => ({
                minHeight: 54,
                borderRadius: 27,
                backgroundColor: "#F4ECFA",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                opacity: readOnly || busyId !== null ? 0.5 : pressed ? 0.78 : 1,
              })}
            >
              <Icon name="add-outline" size={21} color="#72369A" />
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 14,
                  color: "#72369A",
                }}
              >
                Add medication
              </Text>
            </Pressable>
          </View>
        )}

        {editing && (
          <Card style={{ borderRadius: 24 }}>
            <Text style={S.h3}>
              {draft.id ? "Edit medication" : "Add medication"}
            </Text>
            <Field
              label="Medication name"
              value={draft.name}
              onChange={(name) => setDraft((current) => ({ ...current, name }))}
            />
            <Field
              label="Dose"
              value={draft.dose}
              onChange={(dose) => setDraft((current) => ({ ...current, dose }))}
            />
            <Field
              label="Route"
              value={draft.route}
              onChange={(route) => setDraft((current) => ({ ...current, route }))}
            />
            <Field
              label="Directions"
              value={draft.instructions}
              onChange={(instructions) =>
                setDraft((current) => ({ ...current, instructions }))
              }
              multiline
            />
            <Field
              label="Scheduled time"
              value={draft.time}
              onChange={(time) => setDraft((current) => ({ ...current, time }))}
            />
            <Field
              label="Purpose (optional)"
              value={draft.purpose}
              onChange={(purpose) =>
                setDraft((current) => ({ ...current, purpose }))
              }
            />
            <Field
              label="Prescriber (optional)"
              value={draft.prescriber}
              onChange={(prescriber) =>
                setDraft((current) => ({ ...current, prescriber }))
              }
            />
            <Field
              label="Pharmacy (optional)"
              value={draft.pharmacy}
              onChange={(pharmacy) =>
                setDraft((current) => ({ ...current, pharmacy }))
              }
            />
            <Field
              label="Refill date (YYYY-MM-DD)"
              value={draft.refillDueOn}
              onChange={(refillDueOn) =>
                setDraft((current) => ({ ...current, refillDueOn }))
              }
            />

            <View style={{ flexDirection: "row", gap: 8 }}>
              {[false, true].map((value) => (
                <View key={String(value)} style={{ flex: 1 }}>
                  <Button
                    title={value ? "PRN" : "Scheduled"}
                    secondary={draft.isPrn !== value}
                    onPress={() =>
                      setDraft((current) => ({ ...current, isPrn: value }))
                    }
                  />
                </View>
              ))}
            </View>

            <Button
              title={busyId === "save" ? "Saving…" : "Save medication"}
              disabled={
                readOnly ||
                busyId !== null ||
                !draft.name.trim() ||
                !draft.instructions.trim()
              }
              onPress={() => void save()}
            />
            <Button
              title="Cancel"
              secondary
              onPress={() => {
                setEditing(false);
                setDraft(emptyDraft);
              }}
            />
          </Card>
        )}
      </View>

      <View style={{ gap: 12 }}>
        <Text
          style={{
            fontFamily: "DMSans_700Bold",
            fontSize: 25,
            lineHeight: 31,
            color: "#17143D",
          }}
        >
          Medication reconciliation
        </Text>

        <View
          style={{
            borderRadius: 26,
            backgroundColor: "#F4ECFA",
            borderWidth: 1,
            borderColor: "#E7DDF0",
            padding: 17,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: "#E9D9F7",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="git-compare-outline" size={25} color="#793BA5" />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 16,
                  color: "#17143D",
                }}
              >
                Confirm your current list
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: "#777187",
                }}
              >
                Take a quick snapshot to help with care transitions.
              </Text>
            </View>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 6,
            }}
          >
            {[
              ["document-text-outline", "Current list", "Your medications"],
              ["search-outline", "Review", "Check for changes"],
              ["checkmark-outline", "Snapshot", "Save and share"],
            ].map((step, index) => (
              <React.Fragment key={step[1]}>
                <View style={{ flex: 1, alignItems: "center", gap: 5 }}>
                  <View
                    style={{
                      width: 49,
                      height: 49,
                      borderRadius: 25,
                      backgroundColor: index === 0 ? "#7E38A2" : "#E9D9F7",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name={step[0]}
                      size={24}
                      color={index === 0 ? "#FFFFFF" : "#6E30A0"}
                    />
                  </View>
                  <Text
                    style={{
                      fontFamily: "DMSans_600SemiBold",
                      fontSize: 11.5,
                      color: "#17143D",
                      textAlign: "center",
                    }}
                  >
                    {step[1]}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "DMSans_400Regular",
                      fontSize: 10,
                      lineHeight: 13,
                      color: "#7C7489",
                      textAlign: "center",
                    }}
                  >
                    {step[2]}
                  </Text>
                </View>
                {index < 2 && (
                  <View
                    style={{
                      width: 54,
                      height: 2,
                      backgroundColor: "#9B63BD",
                      marginTop: -22,
                    }}
                  />
                )}
              </React.Fragment>
            ))}
          </View>

          <Field
            label=""
            placeholder="Add a note (optional)…"
            value={reconciliationNote}
            onChange={setReconciliationNote}
            multiline
          />

          <Pressable
            accessibilityRole="button"
            disabled={readOnly || busyId !== null}
            onPress={() => void reconcile()}
            style={({ pressed }) => ({
              minHeight: 56,
              borderRadius: 28,
              backgroundColor: "#7E38A2",
              alignItems: "center",
              justifyContent: "center",
              opacity: readOnly || busyId !== null ? 0.5 : pressed ? 0.84 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 15,
                color: "#FFFFFF",
              }}
            >
              {busyId === "reconcile"
                ? "Saving reconciliation…"
                : "Reconcile current list"}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Text
          style={{
            fontFamily: "DMSans_700Bold",
            fontSize: 25,
            lineHeight: 31,
            color: "#17143D",
          }}
        >
          Recent medication activity
        </Text>

        {!records.length ? (
          <View
            style={{
              minHeight: 112,
              borderRadius: 24,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#E8E1EB",
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <View style={{ width: 122, height: 84 }}>
              <MedicationActivityGraphic />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 15,
                  color: "#17143D",
                }}
              >
                No recent activity yet.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12,
                  lineHeight: 17,
                  color: "#7B7489",
                }}
              >
                Your medication updates and reconciliation history will appear here.
              </Text>
            </View>
          </View>
        ) : (
          records.slice(0, 30).map((record) => {
            const medication = medications.find(
              (item) => item.id === record.medicationId,
            );
            return (
              <Card key={record.id} style={{ borderRadius: 22 }}>
                <Text style={S.eyebrow}>
                  {medicationOutcomeLabel(record.status).toUpperCase()}
                </Text>
                <Text style={S.h3}>{medication?.name ?? "Medication"}</Text>
                <Txt style={S.small}>
                  {new Date(record.recordedAt).toLocaleString()}
                </Txt>
                {Boolean(record.note) && <Txt>{record.note}</Txt>}
                {record.correctedAt ? (
                  <Txt style={S.small}>
                    Withdrawn / corrected{" "}
                    {new Date(record.correctedAt).toLocaleString()}
                  </Txt>
                ) : (
                  <Button
                    title="Correct / withdraw this record"
                    secondary
                    disabled={readOnly || busyId !== null}
                    onPress={async () => {
                      setBusyId("correct-" + record.id);
                      try {
                        const at = await correctManagedMedicationRecord(
                          careRecipientId,
                          record.id,
                        );
                        dispatch({ type: "correct-med", id: record.id, at });
                        await refresh();
                        setMessage(
                          "Medication record withdrawn. The original entry remains visible for clarity.",
                        );
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : "We could not correct this medication record.",
                        );
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                )}
              </Card>
            );
          })
        )}
      </View>
    </Page>
  );
}
