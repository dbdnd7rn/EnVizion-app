import React, { useState } from "react";
import { Linking, Pressable, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { RootStack } from "../navigation";
import { useCare } from "../store";
import {
  appointmentLines,
  trackerFields,
  validateAppointment,
  validateEntry,
} from "../domain";
import {
  Button,
  C,
  Card,
  Field,
  Heading,
  Icon,
  Page,
  Row,
  S,
  Safety,
  Section,
  Txt,
} from "../ui";
import { transitionSteps } from "../content";
import { useNav } from "./MainScreens";
import { printResource } from "../printing";
import { medicationLines } from "../medications";
import { addAppointmentToDeviceCalendar } from "../deviceCalendar";
import {
  addAppointmentQuestion,
  correctMedicationDose,
  createMedication,
  recordMedicationDose,
  removeAppointmentQuestion,
  saveAppointment,
  saveObservation,
  setTransitionItem,
  updateMedication,
} from "../backend";


function ReadOnlyCareNotice() {
  return (
    <Card style={{ backgroundColor: C.lavender }}>
      <Icon name="eye-outline" />
      <Text style={S.h3}>Viewer access is read-only.</Text>
      <Txt>
        You can review the shared care record, but only the Owner or a Caregiver
        can make changes.
      </Txt>
    </Card>
  );
}


function VitalsHeroGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 230 180">
      <Defs>
        <LinearGradient id="heartGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F58BB0" />
          <Stop offset="0.52" stopColor="#D56ABE" />
          <Stop offset="1" stopColor="#8C4FC2" />
        </LinearGradient>
        <LinearGradient id="paperGradient" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFDFE" />
          <Stop offset="1" stopColor="#EEE5F7" />
        </LinearGradient>
      </Defs>

      <Path
        d="M85 171C45 139 39 92 56 52C77 4 142-3 190 27C223 48 241 89 221 126C196 170 139 187 85 171Z"
        fill="#F4ECFA"
      />
      <Rect
        x="139"
        y="30"
        width="76"
        height="112"
        rx="15"
        fill="url(#paperGradient)"
        transform="rotate(8 139 30)"
      />
      <Rect x="160" y="48" width="22" height="22" rx="5" fill="#9A62BC" />
      <Path d="M166 59h4l3 5 5-8 3 3" stroke="#FFF" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Rect x="187" y="51" width="18" height="4" rx="2" fill="#C9B3DE" />
      <Rect x="185" y="64" width="22" height="4" rx="2" fill="#D7C7E5" />
      <Rect x="183" y="77" width="26" height="4" rx="2" fill="#D7C7E5" />
      <Path d="M175 112c10-2 13-14 22-15 8-1 10 9 15 7 7-3 8-17 16-18" stroke="#A379C0" strokeWidth="3" fill="none" strokeLinecap="round" />

      <Path
        d="M69 77C69 54 86 42 105 42c16 0 27 9 33 22 6-13 18-22 33-22 20 0 36 13 36 35 0 35-36 61-69 84-33-23-69-49-69-84Z"
        fill="url(#heartGradient)"
      />
      <Path d="M92 95h27l11-25 14 49 12-27 9 14h26" stroke="#FFF" strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />

      <Path d="M118 39v-20" stroke="#8055B0" strokeWidth="3" strokeLinecap="round" />
      <Path d="M118 28c-9-9-14-19-8-27 10 3 15 14 8 27Z" fill="#9D76C4" />
      <Path d="M121 29c10-7 18-14 17-23-11 0-19 8-17 23Z" fill="#7650AD" />
      <Path d="M115 34c-10-5-19-9-23-17 10-3 20 3 23 17Z" fill="#B698D4" />

      <Circle cx="54" cy="107" r="4" fill="#B984D0" />
      <Circle cx="137" cy="154" r="3" fill="#A87AC9" />
      <Path d="M47 80c-5 10-5 19 0 28" stroke="#A06EC4" strokeWidth="2.5" strokeLinecap="round" />
    </Svg>
  );
}

function VitalsEmptyGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 150 100">
      <Circle cx="64" cy="55" r="41" fill="#F1E8FA" />
      <Path d="M38 88c4-18 8-28 20-39" stroke="#8260A2" strokeWidth="2" fill="none" />
      <Path d="M46 69c-9-3-15-1-18 6 8 2 14 0 18-6Z" fill="#9B79BA" />
      <Path d="M52 57c-8-4-15-3-18 3 7 4 13 3 18-3Z" fill="#C0A7D7" />
      <G transform="translate(60 14) rotate(-7 32 38)">
        <Rect x="0" y="0" width="62" height="76" rx="9" fill="#FFF" stroke="#E8DCF1" strokeWidth="2" />
        <Rect x="13" y="17" width="36" height="6" rx="3" fill="#C8AFE0" />
        <Rect x="13" y="31" width="31" height="5" rx="2.5" fill="#D9C8E8" />
        <Rect x="13" y="44" width="35" height="5" rx="2.5" fill="#D9C8E8" />
        <Rect x="13" y="57" width="26" height="5" rx="2.5" fill="#D9C8E8" />
      </G>
      <Path d="M125 19l4-9M134 26l9-3M128 31l5 7" stroke="#F0B85D" strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}

function VitalMetricField({
  label,
  unit,
  icon,
  iconBackground,
  iconColor,
  placeholder,
  value,
  onChange,
  editable,
}: {
  label: string;
  unit: string;
  icon: string;
  iconBackground: string;
  iconColor: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  editable: boolean;
}) {
  return (
    <View
      style={{
        width: "48.5%",
        minWidth: 0,
        paddingVertical: 4,
        gap: 9,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: iconBackground,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={23} color={iconColor} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: "DMSans_600SemiBold",
              fontSize: 12,
              lineHeight: 16,
              color: C.ink,
            }}
          >
            {label}
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 11.5,
              lineHeight: 15,
              color: C.muted,
            }}
          >
            {unit}
          </Text>
        </View>
      </View>

      <TextInput
        accessibilityLabel={label}
        editable={editable}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#A7A0B2"
        value={value}
        onChangeText={onChange}
        style={{
          minHeight: 48,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "#DED3E4",
          backgroundColor: C.white,
          paddingHorizontal: 14,
          fontFamily: "DMSans_400Regular",
          fontSize: 14,
          color: C.ink,
          opacity: editable ? 1 : 0.72,
        }}
      />
    </View>
  );
}

function TrackerTopBar({
  onBack,
  onHelp,
}: {
  onBack: () => void;
  onHelp: () => void;
}) {
  return (
    <View
      style={{
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 2,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F0FD",
          opacity: pressed ? 0.68 : 1,
        })}
      >
        <Icon name="chevron-back-outline" size={25} color="#20164B" />
      </Pressable>

      <Text
        accessibilityRole="header"
        style={{
          fontFamily: "DMSans_700Bold",
          fontSize: 19,
          lineHeight: 24,
          color: C.ink,
        }}
      >
        Daily care
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Daily care help"
        onPress={onHelp}
        style={({ pressed }) => ({
          width: 48,
          height: 48,
          borderRadius: 24,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F5F0FD",
          opacity: pressed ? 0.68 : 1,
        })}
      >
        <Icon name="help-circle-outline" size={25} color="#4A3CB3" />
      </Pressable>
    </View>
  );
}

function BloodSugarHeroGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 230 190">
      <Defs>
        <LinearGradient id="meterBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A66CE8" />
          <Stop offset="0.55" stopColor="#7940C5" />
          <Stop offset="1" stopColor="#5B2AA7" />
        </LinearGradient>
        <LinearGradient id="meterGlow" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FBF9FF" />
          <Stop offset="1" stopColor="#EADFFD" />
        </LinearGradient>
      </Defs>

      <Circle cx="115" cy="96" r="84" fill="#F4EEFF" />
      <Circle cx="175" cy="41" r="42" fill="#EEE4FD" opacity={0.88} />
      <Path d="M16 163C30 128 50 105 78 91C103 79 132 80 156 90C188 104 214 131 223 162H16Z" fill="#F1E8FC" />
      <Path d="M27 158C34 133 49 119 61 111" stroke="#DCCAF3" strokeWidth="6" strokeLinecap="round" />
      <Path d="M196 160C188 131 176 116 162 105" stroke="#D6C2F0" strokeWidth="6" strokeLinecap="round" />

      <G transform="translate(72 23) rotate(7 55 75)">
        <Rect x="8" y="6" width="104" height="130" rx="31" fill="#6E43B8" opacity={0.16} />
        <Rect x="0" y="0" width="104" height="130" rx="31" fill="url(#meterBody)" />
        <Rect x="19" y="18" width="66" height="63" rx="16" fill="url(#meterGlow)" />
        <Rect x="27" y="27" width="50" height="46" rx="12" fill="#FBFAFF" />
        <Text x="52" y="53" textAnchor="middle" fontSize="25" fontWeight="700" fill="#3B3174">
          98
        </Text>
        <Text x="52" y="67" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="#6D6590">
          mg/dL
        </Text>
        <Circle cx="25" cy="99" r="8" fill="#C0A6E9" />
        <Circle cx="52" cy="101" r="13" fill="#D8C7F3" />
        <Circle cx="52" cy="101" r="7" fill="#F5F0FE" />
        <Circle cx="79" cy="99" r="8" fill="#C0A6E9" />
        <Rect x="44" y="120" width="16" height="39" rx="8" fill="#6C35B8" />
        <Rect x="49" y="145" width="6" height="13" rx="3" fill="#9C67E3" />
      </G>

      <G transform="translate(164 34) rotate(7 30 26)">
        <Rect x="0" y="0" width="58" height="48" rx="13" fill="#FFFFFF" opacity={0.96} />
        <Path d="M9 33C17 26 22 17 30 20C38 23 42 35 51 25" fill="none" stroke="#8E4FE0" strokeWidth="3" strokeLinecap="round" />
        <Circle cx="50" cy="24" r="5" fill="#7C40CE" />
      </G>

      <G transform="translate(166 98) rotate(-6 24 22)">
        <Rect x="0" y="0" width="48" height="44" rx="12" fill="#FFFFFF" opacity={0.96} />
        <Path d="M24 33S12 26 12 18C12 12 17 9 21 12C22 13 23 14 24 16C25 14 26 13 27 12C31 9 36 12 36 18C36 26 24 33 24 33Z" fill="#9855DF" />
      </G>
    </Svg>
  );
}

function BloodSugarEmptyGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 155 95">
      <Defs>
        <LinearGradient id="emptyBubble" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#F8F4FF" />
          <Stop offset="1" stopColor="#E9DEFC" />
        </LinearGradient>
      </Defs>
      <Rect x="8" y="12" width="139" height="72" rx="24" fill="url(#emptyBubble)" />
      <G transform="translate(19 17)">
        <Rect x="6" y="5" width="40" height="50" rx="9" fill="#FFFFFF" stroke="#E2D7F3" strokeWidth="2" />
        <Rect x="12" y="13" width="23" height="5" rx="2.5" fill="#B89BE4" />
        <Rect x="12" y="25" width="27" height="4" rx="2" fill="#D6C5EF" />
        <Rect x="12" y="35" width="22" height="4" rx="2" fill="#D6C5EF" />
        <Path d="M39 50C35 43 39 36 45 36C52 36 55 43 51 50C48 55 45 58 45 58C45 58 42 55 39 50Z" fill="#8044C7" />
      </G>
      <G transform="translate(93 28)">
        <Rect x="0" y="0" width="38" height="43" rx="10" fill="#FFFFFF" opacity={0.95} />
        <Path d="M8 28L14 22L19 25L26 14L31 19" fill="none" stroke="#9B55DE" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="30" cy="19" r="4" fill="#7F3FD0" />
      </G>
      <Path d="M59 14L62 8M68 16L73 12M65 22L71 24" stroke="#A87AE1" strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

function BloodSugarField({
  label,
  value,
  onChange,
  icon,
  placeholder,
  numeric,
  multiline = false,
  unit,
  trailing,
  editable,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon: string;
  placeholder: string;
  numeric?: boolean;
  multiline?: boolean;
  unit?: string;
  trailing?: React.ReactNode;
  editable: boolean;
}) {
  return (
    <View style={{ gap: 9 }}>
      <Text
        style={{
          fontFamily: "DMSans_600SemiBold",
          fontSize: 14,
          lineHeight: 19,
          color: C.ink,
        }}
      >
        {label}
      </Text>

      <View
        style={{
          minHeight: multiline ? 116 : 58,
          borderRadius: 20,
          borderWidth: 1,
          borderColor: "#DED5E9",
          backgroundColor: C.white,
          flexDirection: "row",
          alignItems: multiline ? "flex-start" : "center",
          overflow: "hidden",
          opacity: editable ? 1 : 0.72,
        }}
      >
        <View
          style={{
            width: 52,
            alignItems: "center",
            justifyContent: multiline ? "flex-start" : "center",
            paddingTop: multiline ? 17 : 0,
          }}
        >
          <Icon name={icon} size={21} color="#7F3BC0" />
        </View>

        <TextInput
          accessibilityLabel={label}
          editable={editable}
          multiline={multiline}
          keyboardType={numeric ? "decimal-pad" : "default"}
          placeholder={placeholder}
          placeholderTextColor="#A8A1B4"
          value={value}
          onChangeText={onChange}
          style={{
            flex: 1,
            minHeight: multiline ? 114 : 56,
            paddingVertical: multiline ? 15 : 0,
            paddingRight: unit ? 8 : 14,
            fontFamily: "DMSans_400Regular",
            fontSize: 14,
            lineHeight: 20,
            color: C.ink,
            textAlignVertical: multiline ? "top" : "center",
            outlineStyle: "none" as any,
          }}
        />

        {unit && (
          <View
            style={{
              minHeight: 58,
              minWidth: 84,
              paddingHorizontal: 15,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#F6F0FD",
              borderLeftWidth: 1,
              borderLeftColor: "#E7DDF2",
            }}
          >
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 13,
                color: "#7B42B8",
              }}
            >
              {unit}
            </Text>
          </View>
        )}

        {trailing}
      </View>
    </View>
  );
}

export function TrackerScreen({
  route,
}: NativeStackScreenProps<RootStack, "Tracker">) {
  const { kind } = route.params;
  const { state, dispatch } = useCare();
  const n = useNav();
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const readOnly = state.accessRole === "viewer";
  const history = state.entries.filter((e) => e.kind === kind);

  async function save() {
    const validationMessage = validateEntry(kind, values);
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const entry = await saveObservation(kind, values);
      dispatch({ type: "entry", entry });
      setValues({});
      setSuccess(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save this observation. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (kind === "Vitals") {
    const setVital = (key: string, value: string) => {
      setValues((old) => ({ ...old, [key]: value }));
      setSuccess(false);
    };

    return (
      <Page>
        <TrackerTopBar onBack={() => n.goBack()} onHelp={() => n.navigate("Resources")} />
        <View
          style={{
            minHeight: 214,
            position: "relative",
            overflow: "hidden",
            marginBottom: 2,
          }}
        >
          <View style={{ maxWidth: 245, gap: 8, paddingTop: 4 }}>
            <Text
              style={[
                S.eyebrow,
                { color: "#74328F", fontSize: 10.5, letterSpacing: 2.5 },
              ]}
            >
              DAILY CARE JOURNAL
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 40,
                lineHeight: 45,
                letterSpacing: -0.9,
                color: "#17143D",
              }}
            >
              Vitals
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 15.5,
                lineHeight: 22,
                color: "#747184",
                maxWidth: 245,
              }}
            >
              Notice, record, and share with your healthcare team.
            </Text>
          </View>

          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -12,
              top: 0,
              width: 205,
              height: 190,
            }}
          >
            <VitalsHeroGraphic />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Emergency and warning signs"
          onPress={() => n.navigate("Emergency")}
          style={({ pressed }) => ({
            minHeight: 92,
            borderRadius: 22,
            borderWidth: 1,
            borderColor: "#F3C9D2",
            backgroundColor: "#FFF1F2",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 17,
            gap: 14,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              backgroundColor: "#FFDCE2",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "#E54563",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 22,
                  color: C.white,
                }}
              >
                !
              </Text>
            </View>
          </View>

          <View style={{ flex: 1, gap: 3 }}>
            <Text
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 16,
                lineHeight: 21,
                color: "#A11E39",
              }}
            >
              Emergency & warning signs
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 13,
                lineHeight: 18,
                color: "#B05C6B",
              }}
            >
              Know when to get help.
            </Text>
          </View>
          <Icon name="chevron-forward" size={23} color="#C73250" />
        </Pressable>

        {readOnly && (
          <Card
            style={{
              borderRadius: 22,
              padding: 16,
              minHeight: 106,
              backgroundColor: "#F3ECFA",
              borderColor: "#E8DAF0",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: "#E5D5F4",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="eye-outline" size={28} color="#7D36A1" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 16,
                  lineHeight: 21,
                  color: C.ink,
                }}
              >
                Viewer access is read-only.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: C.muted,
                }}
              >
                You can review the shared care record, but only the Owner or a
                Caregiver can make changes.
              </Text>
            </View>
          </Card>
        )}

        <Card
          style={{
            borderRadius: 26,
            padding: 16,
            gap: 16,
            backgroundColor: "#FFFEFF",
            borderColor: "#EEE8F0",
          }}
        >
          <View style={S.between}>
            <Text
              style={[
                S.eyebrow,
                { color: "#74328F", fontSize: 10.5, letterSpacing: 2.4 },
              ]}
            >
              NEW OBSERVATION
            </Text>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Track progress"
              onPress={() => n.navigate("Insights")}
              style={({ pressed }) => ({
                minHeight: 40,
                borderRadius: 20,
                backgroundColor: "#F3ECFA",
                paddingHorizontal: 13,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Icon name="bar-chart-outline" size={18} color="#7C3AA0" />
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 12,
                  color: C.ink,
                }}
              >
                Track progress
              </Text>
              <Icon name="chevron-forward" size={15} color="#7C3AA0" />
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              columnGap: 10,
              rowGap: 14,
            }}
          >
            <VitalMetricField
              label="Systolic blood pressure"
              unit="mmHg"
              icon="heart-outline"
              iconBackground="#FFF0F4"
              iconColor="#EB4772"
              placeholder="e.g. 120"
              value={values.systolic || ""}
              onChange={(value) => setVital("systolic", value)}
              editable={!readOnly && !saving}
            />
            <VitalMetricField
              label="Diastolic blood pressure"
              unit="mmHg"
              icon="heart-circle-outline"
              iconBackground="#F2E9FA"
              iconColor="#7E3AA3"
              placeholder="e.g. 80"
              value={values.diastolic || ""}
              onChange={(value) => setVital("diastolic", value)}
              editable={!readOnly && !saving}
            />
            <VitalMetricField
              label="Pulse"
              unit="bpm"
              icon="pulse-outline"
              iconBackground="#F2E9FA"
              iconColor="#8537A7"
              placeholder="e.g. 72"
              value={values.pulse || ""}
              onChange={(value) => setVital("pulse", value)}
              editable={!readOnly && !saving}
            />
            <VitalMetricField
              label="Temperature"
              unit="°F"
              icon="thermometer-outline"
              iconBackground="#EAF2FF"
              iconColor="#3578C7"
              placeholder="e.g. 98.6"
              value={values.temperature || ""}
              onChange={(value) => setVital("temperature", value)}
              editable={!readOnly && !saving}
            />
          </View>

          <View style={{ height: 1, backgroundColor: "#EEE8F0" }} />

          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#F3E8FB",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="document-text-outline" size={22} color="#7C3AA0" />
            </View>
            <View style={{ flex: 1, gap: 8 }}>
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 13,
                  color: C.ink,
                }}
              >
                Additional notes (optional)
              </Text>
              <TextInput
                accessibilityLabel="Additional notes"
                editable={!readOnly && !saving}
                multiline
                placeholder="Write here..."
                placeholderTextColor="#A7A0B2"
                value={values.notes || ""}
                onChangeText={(value) => setVital("notes", value)}
                style={{
                  minHeight: 94,
                  borderRadius: 15,
                  borderWidth: 1,
                  borderColor: "#DED3E4",
                  backgroundColor: C.white,
                  paddingHorizontal: 14,
                  paddingTop: 13,
                  fontFamily: "DMSans_400Regular",
                  fontSize: 14,
                  lineHeight: 20,
                  color: C.ink,
                  textAlignVertical: "top",
                  opacity: readOnly ? 0.72 : 1,
                }}
              />
            </View>
          </View>

          {Boolean(error) && (
            <Text
              accessibilityRole="alert"
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 12.5,
                lineHeight: 18,
                color: C.rose,
              }}
            >
              {error}
            </Text>
          )}

          {success && (
            <Text
              accessibilityRole="alert"
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 13,
                color: C.green,
              }}
            >
              Observation saved securely.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save observation"
            accessibilityState={{ disabled: saving || readOnly }}
            disabled={saving || readOnly}
            onPress={() => void save()}
            style={({ pressed }) => ({
              minHeight: 56,
              borderRadius: 28,
              backgroundColor: "#8138A3",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: readOnly || saving ? 0.56 : pressed ? 0.82 : 1,
              shadowColor: "#5B276E",
              shadowOpacity: 0.14,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 7 },
              elevation: 3,
            })}
          >
            <Icon
              name={saving ? "hourglass-outline" : "add-outline"}
              size={22}
              color={C.white}
            />
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 15,
                color: C.white,
              }}
            >
              {saving ? "Saving observation…" : "Save observation"}
            </Text>
          </Pressable>
        </Card>

        <View style={S.between}>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 25,
              lineHeight: 31,
              letterSpacing: -0.45,
              color: C.ink,
            }}
          >
            Recent observations
          </Text>

          <View
            style={{
              minHeight: 44,
              borderRadius: 22,
              paddingHorizontal: 14,
              backgroundColor: "#F6F1F9",
              borderWidth: 1,
              borderColor: "#E8E0ED",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Icon name="calendar-outline" size={18} color="#5C2E72" />
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 12.5,
                color: C.ink,
              }}
            >
              Today
            </Text>
            <Icon name="chevron-down" size={15} color="#5C2E72" />
          </View>
        </View>

        {!history.length ? (
          <Card
            style={{
              minHeight: 154,
              borderRadius: 24,
              padding: 16,
              borderColor: "#DDD0E7",
              backgroundColor: "#FBF8FD",
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
            }}
          >
            <View style={{ width: 132, height: 98 }}>
              <VitalsEmptyGraphic />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 16,
                  lineHeight: 21,
                  color: C.ink,
                }}
              >
                A fresh page for today.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: C.muted,
                }}
              >
                Your saved observations will appear here. No readings have been
                added yet.
              </Text>
            </View>
          </Card>
        ) : (
          history.map((entry) => (
            <Card key={entry.id} style={{ borderRadius: 22, gap: 11 }}>
              <Text style={S.eyebrow}>
                {new Date(entry.recordedAt).toLocaleString()}
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  flexWrap: "wrap",
                  columnGap: 12,
                  rowGap: 12,
                }}
              >
                {trackerFields[kind]
                  .filter((field) => entry.values[field.key])
                  .map((field) => (
                    <View
                      key={field.key}
                      style={{
                        width: "47%",
                        backgroundColor: "#FAF6FC",
                        borderRadius: 16,
                        padding: 12,
                      }}
                    >
                      <Text style={S.small}>{field.label}</Text>
                      <Text style={[S.h3, { marginTop: 3 }]}>
                        {entry.values[field.key]}
                      </Text>
                    </View>
                  ))}
              </View>
              {Boolean(entry.values.notes) && <Txt>{entry.values.notes}</Txt>}
            </Card>
          ))
        )}
      </Page>
    );
  }

  if (kind === "Blood sugar") {
    const setBloodSugar = (key: string, value: string) => {
      setValues((old) => ({ ...old, [key]: value }));
      setSuccess(false);
    };

    const todayLabel = new Date().toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    return (
      <Page>
        <TrackerTopBar onBack={() => n.goBack()} onHelp={() => n.navigate("Resources")} />

        <View
          style={{
            minHeight: 250,
            position: "relative",
            overflow: "hidden",
            marginHorizontal: -20,
            paddingHorizontal: 20,
            paddingTop: 18,
          }}
        >
          <Svg
            width="100%"
            height="100%"
            viewBox="0 0 440 250"
            preserveAspectRatio="none"
            style={{ position: "absolute", inset: 0 }}
            accessibilityElementsHidden
          >
            <Defs>
              <LinearGradient id="bloodHeroBg" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFFFFF" />
                <Stop offset="0.64" stopColor="#FCFAFF" />
                <Stop offset="1" stopColor="#F1E8FD" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="440" height="250" fill="url(#bloodHeroBg)" />
            <Circle cx="410" cy="58" r="92" fill="#F4EEFF" opacity={0.84} />
          </Svg>

          <View style={{ maxWidth: 245, gap: 9, paddingTop: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 13,
                  backgroundColor: "#E9D8FF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="water-outline" size={23} color="#813DCA" />
              </View>
              <Text
                style={[
                  S.eyebrow,
                  { color: "#74328F", fontSize: 10.5, letterSpacing: 2.35 },
                ]}
              >
                DAILY CARE JOURNAL
              </Text>
            </View>

            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 41,
                lineHeight: 45,
                letterSpacing: -1.05,
                color: "#17143D",
              }}
            >
              Blood sugar
            </Text>

            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 15.5,
                lineHeight: 22,
                color: "#747184",
                maxWidth: 250,
              }}
            >
              Notice, record, and share with your healthcare team.
            </Text>
          </View>

          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -4,
              top: 15,
              width: 206,
              height: 192,
            }}
          >
            <BloodSugarHeroGraphic />
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Emergency and warning signs"
          onPress={() => n.navigate("Emergency")}
          style={({ pressed }) => ({
            minHeight: 94,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "#F3C8D0",
            backgroundColor: "#FFF2F2",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 18,
            gap: 14,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <View
            style={{
              width: 54,
              height: 54,
              borderRadius: 27,
              backgroundColor: "#FFE0E4",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="warning-outline" size={29} color="#D83354" />
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 16,
                lineHeight: 21,
                color: "#A4243C",
              }}
            >
              Emergency & warning signs
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 13,
                lineHeight: 18,
                color: "#B05C6B",
              }}
            >
              Know when to get help and what to watch for.
            </Text>
          </View>

          <Icon name="chevron-forward" size={22} color="#CF3552" />
        </Pressable>

        {readOnly && <ReadOnlyCareNotice />}

        <Card
          style={{
            borderRadius: 28,
            padding: 18,
            gap: 18,
            backgroundColor: "#FFFEFF",
            borderColor: "#EDE6F2",
            shadowColor: "#382840",
            shadowOpacity: 0.045,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 9 },
            elevation: 2,
          }}
        >
          <View style={S.between}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  backgroundColor: "#F0E4FF",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="document-text-outline" size={22} color="#7C3ABE" />
              </View>
              <Text style={[S.h2, { fontSize: 20, lineHeight: 25 }]}>New observation</Text>
            </View>

            <View
              style={{
                minHeight: 38,
                borderRadius: 19,
                backgroundColor: "#F3EAFE",
                paddingHorizontal: 12,
                flexDirection: "row",
                alignItems: "center",
                gap: 7,
              }}
            >
              <Icon name="time-outline" size={17} color="#7E3BBE" />
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 11.5,
                  color: "#6F35A5",
                }}
              >
                {todayLabel}
              </Text>
            </View>
          </View>

          <BloodSugarField
            label="Blood glucose (mg/dL) *"
            value={values.glucose || ""}
            onChange={(value) => setBloodSugar("glucose", value)}
            icon="water-outline"
            placeholder="Enter reading"
            numeric
            unit="mg/dL"
            editable={!readOnly && !saving}
          />

          <BloodSugarField
            label="Timing, such as before breakfast *"
            value={values.timing || ""}
            onChange={(value) => setBloodSugar("timing", value)}
            icon="alarm-outline"
            placeholder="Select timing"
            editable={!readOnly && !saving}
            trailing={
              <View
                pointerEvents="none"
                style={{
                  width: 48,
                  height: 58,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="chevron-down-outline" size={19} color="#2D2852" />
              </View>
            }
          />

          <BloodSugarField
            label="Additional notes (optional)"
            value={values.notes || ""}
            onChange={(value) => setBloodSugar("notes", value)}
            icon="document-text-outline"
            placeholder="Write any notes..."
            multiline
            editable={!readOnly && !saving}
            trailing={
              <Text
                style={{
                  position: "absolute",
                  right: 15,
                  bottom: 12,
                  fontFamily: "DMSans_400Regular",
                  fontSize: 11.5,
                  color: "#9B93A8",
                }}
              >
                {(values.notes || "").length}/300
              </Text>
            }
          />

          {Boolean(error) && (
            <Text
              accessibilityRole="alert"
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 12.5,
                lineHeight: 18,
                color: C.rose,
              }}
            >
              {error}
            </Text>
          )}

          {success && (
            <Text
              accessibilityRole="alert"
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 13,
                color: C.green,
              }}
            >
              Observation saved securely.
            </Text>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save observation"
            accessibilityState={{ disabled: saving || readOnly }}
            disabled={saving || readOnly}
            onPress={() => void save()}
            style={({ pressed }) => ({
              minHeight: 58,
              borderRadius: 29,
              overflow: "hidden",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: readOnly || saving ? 0.55 : pressed ? 0.82 : 1,
              shadowColor: "#6B2A93",
              shadowOpacity: 0.14,
              shadowRadius: 13,
              shadowOffset: { width: 0, height: 7 },
              elevation: 3,
            })}
          >
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 400 58"
              preserveAspectRatio="none"
              style={{ position: "absolute", inset: 0 }}
              accessibilityElementsHidden
            >
              <Defs>
                <LinearGradient id="saveGradient" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#8B3FC7" />
                  <Stop offset="0.5" stopColor="#9C45D2" />
                  <Stop offset="1" stopColor="#7130A8" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="400" height="58" rx="29" fill="url(#saveGradient)" />
            </Svg>
            <Icon
              name={saving ? "hourglass-outline" : "checkmark-outline"}
              size={23}
              color={C.white}
            />
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 15,
                color: C.white,
              }}
            >
              {saving ? "Saving observation…" : "Save observation"}
            </Text>
          </Pressable>

          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 12,
              lineHeight: 18,
              color: "#77758B",
            }}
          >
            * Required. Readings are stored with your account and are not interpreted as a diagnosis.
          </Text>
        </Card>

        <View style={S.between}>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 25,
              lineHeight: 31,
              letterSpacing: -0.45,
              color: C.ink,
            }}
          >
            Your recent observations
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => n.navigate("Insights")}
            style={({ pressed }) => ({
              minHeight: 42,
              paddingHorizontal: 5,
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              opacity: pressed ? 0.65 : 1,
            })}
          >
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 13,
                color: "#7D36B5",
              }}
            >
              View all
            </Text>
            <Icon name="arrow-forward-outline" size={17} color="#7D36B5" />
          </Pressable>
        </View>

        {!history.length ? (
          <View
            style={{
              minHeight: 154,
              borderRadius: 26,
              padding: 16,
              borderWidth: 1,
              borderColor: "#EAE4F0",
              backgroundColor: "#F8F4FE",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              overflow: "hidden",
            }}
          >
            <View style={{ width: 112, height: 88 }}>
              <BloodSugarEmptyGraphic />
            </View>
            <View style={{ flex: 1, gap: 6 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 16,
                  lineHeight: 21,
                  color: C.ink,
                }}
              >
                A fresh page for today.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: C.muted,
                }}
              >
                Your saved observations will appear here. No readings have been added yet.
              </Text>
            </View>
          </View>
        ) : (
          history.map((entry) => (
            <Card key={entry.id} style={{ borderRadius: 22, gap: 11 }}>
              <Text style={S.eyebrow}>
                {new Date(entry.recordedAt).toLocaleString()}
              </Text>
              {trackerFields[kind]
                .filter((field) => entry.values[field.key])
                .map((field) => (
                  <View
                    key={field.key}
                    style={{
                      backgroundColor: "#F8F4FC",
                      borderRadius: 16,
                      padding: 12,
                    }}
                  >
                    <Text style={S.small}>{field.label}</Text>
                    <Text style={[S.h3, { marginTop: 3 }]}>{entry.values[field.key]}</Text>
                  </View>
                ))}
              {Boolean(entry.values.notes) && <Txt>{entry.values.notes}</Txt>}
            </Card>
          ))
        )}

        <View
          style={{
            minHeight: 86,
            borderRadius: 24,
            backgroundColor: "#F7F3FD",
            paddingHorizontal: 16,
            paddingVertical: 15,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Icon name="information-circle-outline" size={24} color="#6657B1" />
          <Text
            style={{
              flex: 1,
              fontFamily: "DMSans_400Regular",
              fontSize: 12.5,
              lineHeight: 18,
              color: "#68647A",
            }}
          >
            Readings are recorded without diagnostic interpretation. Follow the individual care plan provided by the healthcare team.
          </Text>
        </View>
      </Page>
    );
  }

  return (
    <Page>
      <TrackerTopBar onBack={() => n.goBack()} onHelp={() => n.navigate("Resources")} />
      <Heading
        eyebrow="DAILY CARE JOURNAL"
        title={kind}
        body="Notice, record, and share with your healthcare team."
      />
      <Safety onPress={() => n.navigate("Emergency")} />
      {readOnly && <ReadOnlyCareNotice />}
      {(kind === "Red-flag symptoms" || kind === "Behavior & memory") && (
        <Card style={{ backgroundColor: C.redBg }}>
          <Text style={[S.h3, { color: C.rose }]}>
            Getting help comes before logging.
          </Text>
          <Txt>
            For sudden confusion or a concerning change, seek prompt medical
            help. For a possible emergency, call your local emergency number. Do
            not wait to complete this form.
          </Txt>
        </Card>
      )}
      <Card>
        <Text style={S.eyebrow}>NEW OBSERVATION</Text>
        {trackerFields[kind].map((field) => (
          <Field
            key={field.key}
            label={field.label + (field.required ? " *" : "")}
            value={values[field.key] || ""}
            numeric={field.numeric}
            onChange={(value) => {
              setValues((old) => ({ ...old, [field.key]: value }));
              setSuccess(false);
            }}
          />
        ))}
        <Field
          label="Additional notes (optional)"
          value={values.notes || ""}
          onChange={(value) =>
            setValues((old) => ({ ...old, notes: value }))
          }
          multiline
        />
        {Boolean(error) && (
          <Text accessibilityRole="alert" style={{ color: C.rose }}>
            {error}
          </Text>
        )}
        {success && (
          <Text accessibilityRole="alert" style={[S.h3, { color: C.green }]}>
            Observation saved securely.
          </Text>
        )}
        <Button
          title={
            readOnly
              ? "Viewer access — read only"
              : saving
                ? "Saving observation…"
                : "Save observation"
          }
          icon="checkmark-outline"
          disabled={saving || readOnly}
          onPress={() => void save()}
        />
        <Text style={S.small}>
          * Required. Readings are stored with your account and are not
          interpreted as a diagnosis.
        </Text>
      </Card>

      <Section title="Your recent observations" />
      {!history.length ? (
        <Card>
          <Icon name="journal-outline" />
          <Text style={S.h3}>A fresh page for today.</Text>
          <Txt>
            Your saved observations will appear here. No readings have been
            added yet.
          </Txt>
        </Card>
      ) : (
        history.map((entry) => (
          <Card key={entry.id}>
            <Text style={S.eyebrow}>
              {new Date(entry.recordedAt).toLocaleString()}
            </Text>
            {trackerFields[kind]
              .filter((field) => entry.values[field.key])
              .map((field) => (
                <View key={field.key}>
                  <Text style={S.small}>{field.label}</Text>
                  <Text style={S.h3}>{entry.values[field.key]}</Text>
                </View>
              ))}
            {Boolean(entry.values.notes) && <Txt>{entry.values.notes}</Txt>}
          </Card>
        ))
      )}
      <Txt style={S.small}>
        Readings are recorded without diagnostic interpretation. Follow the
        individual care plan provided by the healthcare team.
      </Txt>
    </Page>
  );
}

export function MedicationScreen() {
  const { state, dispatch } = useCare();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [time, setTime] = useState("");
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const readOnly = state.accessRole === "viewer";

  const closeForm = () => {
    setAdding(false);
    setEditingId(null);
    setName("");
    setInstructions("");
    setTime("");
  };

  const activeRecords = state.medicationRecords.filter(
    (record) => !record.correctedAt,
  );

  async function saveMedicationDetails() {
    setMessage("");
    setBusyId(editingId ?? "new");
    try {
      const medication = editingId
        ? await updateMedication({
            id: editingId,
            name: name.trim(),
            instructions: instructions.trim(),
            time: time.trim(),
          })
        : await createMedication({
            name: name.trim(),
            instructions: instructions.trim(),
            time: time.trim(),
          });

      dispatch({
        type: editingId ? "edit-med" : "add-med",
        medication,
      });
      closeForm();
      setMessage("Medication list updated securely.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update the medication list.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="DAILY CARE"
        title="A clearer medication routine"
        body="Keep your list, record each dose, and bring your notes to the care team."
      />
      {readOnly && <ReadOnlyCareNotice />}
      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.eyebrow}>YOUR MEDICATION RECORD</Text>
        <Text style={S.h2}>{activeRecords.length} active dose records</Text>
        <Txt>
          Times show when you recorded each entry. This caregiver log does not
          change the prescribed medication plan.
        </Txt>
      </Card>

      <Section title="Your medication list" />
      {!state.medications.length && (
        <Card>
          <Icon name="medical-outline" />
          <Text style={S.h3}>No medications added yet.</Text>
          <Txt>
            Add medications from the pharmacy label so your caregiver record is
            ready when you need it.
          </Txt>
        </Card>
      )}

      {state.medications.map((medication) => (
        <Card key={medication.id}>
          <View style={S.row}>
            <Icon name="medical-outline" />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={S.h3}>{medication.name}</Text>
              <Text style={S.small}>
                Scheduled: {medication.time || "Not specified"}
              </Text>
            </View>
          </View>
          <Txt>{medication.instructions}</Txt>
          <Button
            title={
              busyId === `dose-${medication.id}`
                ? "Recording dose…"
                : "Record dose: " + medication.name
            }
            icon="checkmark-circle-outline"
            disabled={busyId !== null || readOnly}
            onPress={async () => {
              setBusyId(`dose-${medication.id}`);
              setMessage("");
              try {
                const record = await recordMedicationDose(medication);
                dispatch({ type: "record-med", record });
                setMessage(
                  medication.name +
                    ": recorded as taken. You can correct this entry below.",
                );
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "We could not record this dose.",
                );
              } finally {
                setBusyId(null);
              }
            }}
          />
          <Button
            title={"Edit " + medication.name}
            secondary
            icon="create-outline"
            disabled={busyId !== null || readOnly}
            onPress={() => {
              setEditingId(medication.id);
              setAdding(true);
              setName(medication.name);
              setInstructions(medication.instructions);
              setTime(medication.time);
              setMessage("");
            }}
          />
        </Card>
      ))}

      <Button
        title={adding ? "Cancel medication changes" : "Add medication"}
        secondary
        icon={adding ? "close-outline" : "add-outline"}
        disabled={busyId !== null || readOnly}
        onPress={() => {
          if (adding) closeForm();
          else {
            closeForm();
            setAdding(true);
          }
        }}
      />

      {adding && (
        <Card>
          <Text style={S.h3}>
            {editingId ? "Edit medication details" : "Add to your list"}
          </Text>
          <Field label="Medication name" value={name} onChange={setName} />
          <Field
            label="Directions exactly as prescribed"
            value={instructions}
            onChange={setInstructions}
            multiline
          />
          <Field label="Scheduled time" value={time} onChange={setTime} />
          <Txt style={S.small}>
            Copy the pharmacy label carefully. This record is for organization;
            it does not alter the prescription.
          </Txt>
          <Button
            title={
              busyId
                ? "Saving medication…"
                : editingId
                  ? "Save medication details"
                  : "Add to my medication log"
            }
            disabled={
              busyId !== null ||
              readOnly ||
              !name.trim() ||
              !instructions.trim() ||
              !time.trim()
            }
            onPress={() => void saveMedicationDetails()}
          />
        </Card>
      )}

      {Boolean(message) && (
        <Text accessibilityRole="alert" style={S.body}>
          {message}
        </Text>
      )}

      <Section title="Medication history" />
      {!state.medicationRecords.length && (
        <Card>
          <Icon name="journal-outline" />
          <Text style={S.h3}>Your record starts here.</Text>
          <Txt>
            Dose records will appear here with the time they were entered.
          </Txt>
        </Card>
      )}

      {state.medicationRecords.map((record) => (
        <Card key={record.id}>
          <Text
            style={[
              S.eyebrow,
              { color: record.correctedAt ? C.muted : C.green },
            ]}
          >
            {record.correctedAt ? "CORRECTED / WITHDRAWN" : "RECORDED AS TAKEN"}
          </Text>
          <Text style={S.h3}>{record.medication.name}</Text>
          <Txt>{record.medication.instructions}</Txt>
          <Text style={S.small}>
            Entry recorded: {new Date(record.recordedAt).toLocaleString()}
          </Text>
          {record.correctedAt ? (
            <Text style={S.small}>
              Withdrawn: {new Date(record.correctedAt).toLocaleString()}. Kept
              here for clarity.
            </Text>
          ) : (
            <Button
              title={"Correct entry for " + record.medication.name}
              secondary
              disabled={busyId !== null || readOnly}
              onPress={async () => {
                setBusyId(`correct-${record.id}`);
                setMessage("");
                try {
                  const at = await correctMedicationDose(record.id);
                  dispatch({ type: "correct-med", id: record.id, at });
                  setMessage(
                    "Entry withdrawn. The original record remains visible in history.",
                  );
                } catch (error) {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : "We could not correct this record.",
                  );
                } finally {
                  setBusyId(null);
                }
              }}
            />
          )}
        </Card>
      ))}

      <Button
        title="Print medication list and history"
        icon="print-outline"
        disabled={readOnly}
        onPress={async () => {
          try {
            await printResource(
              "My medication record",
              medicationLines(state.medications, state.medicationRecords),
            );
            setMessage(
              "Print or share requested. Check your browser or device window.",
            );
          } catch {
            setMessage(
              "Printing could not open. Please try again on a supported browser or device.",
            );
          }
        }}
      />
      <Text style={S.small}>
        These are caregiver records, not reminders or dose recommendations.
        Follow the pharmacy label and ask a pharmacist or clinician about
        medication questions.
      </Text>
    </Page>
  );
}

export function AppointmentScreen() {
  const { state, dispatch } = useCare();
  const n = useNav();
  const [question, setQuestion] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(state.appointment);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const readOnly = state.accessRole === "viewer";

  async function saveVisit() {
    const appointment = {
      title: draft.title.trim(),
      date: draft.date.trim(),
      time: draft.time.trim(),
      location: draft.location.trim(),
      notes: draft.notes.trim(),
    };

    const validationError = validateAppointment(appointment);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError("");
    try {
      const appointmentId = await saveAppointment(
        appointment,
        state.appointmentId,
      );
      dispatch({ type: "appointment", appointment, appointmentId });
      setEditing(false);
      setMessage("Visit details saved securely.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "We could not save the visit details.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="MAKE ROOM FOR YOUR QUESTIONS"
        title="Walk in feeling prepared"
        body="Keep the important things together for your next appointment."
      />
      {readOnly && <ReadOnlyCareNotice />}
      <Card style={{ backgroundColor: C.lavender }}>
        <View style={S.row}>
          <Icon name="calendar-outline" size={28} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={S.eyebrow}>YOUR NEXT VISIT</Text>
            <Text style={S.h3}>{state.appointment.title}</Text>
            <Txt>
              {state.appointment.date || "Date to be confirmed"}
              {state.appointment.time ? ` · ${state.appointment.time}` : ""}
            </Txt>
            {Boolean(state.appointment.location) && (
              <Txt>{state.appointment.location}</Txt>
            )}
            {Boolean(state.appointment.notes) && (
              <Txt>{state.appointment.notes}</Txt>
            )}
          </View>
        </View>
        <Button
          title={editing ? "Cancel editing visit" : "Edit visit details"}
          secondary
          icon="create-outline"
          disabled={saving || readOnly}
          onPress={() => {
            setDraft(state.appointment);
            setError("");
            setEditing(!editing);
          }}
        />
        <Button
          title="Add visit to device calendar"
          secondary
          icon="calendar-outline"
          disabled={saving || !state.appointment.date}
          onPress={async () => {
            setMessage("");
            try {
              await addAppointmentToDeviceCalendar(state.appointment);
              setMessage("Calendar window opened.");
            } catch (calendarError) {
              setMessage(
                calendarError instanceof Error
                  ? calendarError.message
                  : "We could not open the device calendar.",
              );
            }
          }}
        />
      </Card>

      {editing && (
        <Card>
          <Field
            label="Visit title"
            value={draft.title}
            onChange={(title) => setDraft((item) => ({ ...item, title }))}
          />
          <Field
            label="Date (YYYY-MM-DD, optional)"
            value={draft.date}
            onChange={(date) => setDraft((item) => ({ ...item, date }))}
          />
          <Field
            label="Time (HH:MM, 24-hour, optional)"
            value={draft.time}
            onChange={(time) => setDraft((item) => ({ ...item, time }))}
          />
          <Field
            label="Location or joining details (optional)"
            value={draft.location}
            onChange={(location) =>
              setDraft((item) => ({ ...item, location }))
            }
          />
          <Field
            label="Preparation notes (optional)"
            value={draft.notes}
            onChange={(notes) => setDraft((item) => ({ ...item, notes }))}
            multiline
          />
          {Boolean(error) && (
            <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
              {error}
            </Text>
          )}
          <Button
            title={saving ? "Saving visit…" : "Save visit details"}
            disabled={saving}
            onPress={() => void saveVisit()}
          />
        </Card>
      )}

      <Section title="Questions to bring" />
      {state.questions.map((item, index) => (
        <Card key={state.questionIds[index] || `${index}-${item}`} style={{ flexDirection: "row", gap: 14 }}>
          <Text style={[S.h3, { color: C.purple }]}>
            {String(index + 1).padStart(2, "0")}
          </Text>
          <Txt style={{ flex: 1, color: C.ink }}>{item}</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove question ${index + 1}`}
            disabled={saving || readOnly}
            onPress={async () => {
              const questionId = state.questionIds[index];
              if (!questionId) {
                dispatch({ type: "remove-question", index });
                return;
              }

              setSaving(true);
              try {
                await removeAppointmentQuestion(questionId);
                dispatch({ type: "remove-question", index });
              } catch (removeError) {
                setMessage(
                  removeError instanceof Error
                    ? removeError.message
                    : "We could not remove that question.",
                );
              } finally {
                setSaving(false);
              }
            }}
            style={{
              minWidth: 44,
              minHeight: 44,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="close-circle-outline" color={C.muted} />
          </Pressable>
        </Card>
      ))}

      {state.questions.length === 0 && (
        <Card>
          <Txt>
            Your question list is clear. Add anything you want to remember
            below.
          </Txt>
        </Card>
      )}

      {!readOnly && (
        <>
          <Field
            label="What else would you like to ask?"
            value={question}
            onChange={setQuestion}
            multiline
          />
          <Button
            title={saving ? "Saving question…" : "Add my question"}
            disabled={!question.trim() || saving}
            icon="add-outline"
            secondary
            onPress={async () => {
              setSaving(true);
              setMessage("");
              try {
                const result = await addAppointmentQuestion({
                  appointment: state.appointment,
                  appointmentId: state.appointmentId,
                  question: question.trim(),
                  position: state.questions.length,
                });
                dispatch({
                  type: "question",
                  text: question.trim(),
                  id: result.questionId,
                  appointmentId: result.appointmentId,
                });
                setQuestion("");
              } catch (addError) {
                setMessage(
                  addError instanceof Error
                    ? addError.message
                    : "We could not save that question.",
                );
              } finally {
                setSaving(false);
              }
            }}
          />
        </>
      )}

      <Button
        title="Print or save appointment sheet"
        icon="print-outline"
        disabled={readOnly}
        onPress={async () => {
          try {
            await printResource(
              "My appointment plan",
              appointmentLines(state.appointment, state.questions),
            );
            setMessage("Your print or share window has opened.");
          } catch {
            setMessage(
              "Printing could not open. Please try again on a supported browser or device.",
            );
          }
        }}
      />
      <Button
        title="Build a focused visit packet"
        secondary
        icon="reader-outline"
        disabled={readOnly}
        onPress={() => n.navigate("CarePacket")}
      />
      {Boolean(message) && <Txt>{message}</Txt>}
      <Card>
        <Text style={S.h3}>Before you leave</Text>
        <Txt>
          Ask who to contact with follow-up questions, and repeat the next steps
          in your own words to check your understanding.
        </Txt>
      </Card>
    </Page>
  );
}

export function TransitionScreen() {
  const { state, dispatch } = useCare();
  const n = useNav();
  const [message, setMessage] = useState("");
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const readOnly = state.accessRole === "viewer";

  return (
    <Page>
      <Heading
        eyebrow="FROM HOSPITAL TO HOME"
        title="Walking Through the Transition"
        body="You don’t need to remember everything. Take it one step at a time."
      />
      {readOnly && <ReadOnlyCareNotice />}
      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h2}>
          {state.transition.length} of {transitionSteps.length} steps prepared
        </Text>
        <View
          style={{ height: 6, backgroundColor: "#DDCDE6", borderRadius: 4 }}
        >
          <View
            style={{
              height: 6,
              width: `${(state.transition.length / transitionSteps.length) * 100}%`,
              backgroundColor: C.purple,
              borderRadius: 4,
            }}
          />
        </View>
        <Txt>
          Use this checklist alongside your discharge team’s instructions.
        </Txt>
      </Card>

      {transitionSteps.map((step, index) => {
        const completed = state.transition.includes(index);
        return (
          <Pressable
            key={step}
            accessibilityRole="checkbox"
            accessibilityLabel={step}
            accessibilityState={{ checked: completed }}
            disabled={savingIndex !== null || readOnly}
            onPress={async () => {
              setSavingIndex(index);
              setMessage("");
              try {
                await setTransitionItem(index, !completed);
                dispatch({ type: "transition", index });
              } catch (error) {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "We could not update the checklist.",
                );
              } finally {
                setSavingIndex(null);
              }
            }}
            style={[S.card, S.row, { padding: 17 }]}
          >
            <Icon
              name={completed ? "checkmark-circle" : "ellipse-outline"}
              color={completed ? C.green : C.muted}
            />
            <Text style={[S.body, { flex: 1, color: C.ink }]}>{step}</Text>
          </Pressable>
        );
      })}

      {Boolean(message) && <Txt>{message}</Txt>}

      <Card style={{ backgroundColor: C.redBg }}>
        <Text style={[S.h3, { color: C.rose }]}>
          Know who to call before you leave.
        </Text>
        <Txt>
          Ask the discharge team which symptoms need urgent help and which
          number to call after hours.
        </Txt>
        <Button
          title="Review warning signs"
          secondary
          onPress={() => n.navigate("Emergency")}
        />
      </Card>
    </Page>
  );
}

export function EmergencyScreen() {
  const [message, setMessage] = useState("");
  return (
    <Page>
      <Heading
        eyebrow="URGENT SUPPORT"
        title="Emergency & warning signs"
        body="If you think someone may be having a medical emergency, call emergency services now."
      />
      <Card style={{ backgroundColor: C.redBg, borderColor: "#EAC9C9" }}>
        <Icon name="alert-circle" color={C.rose} size={34} />
        <Text style={[S.h2, { color: "#963845" }]}>
          Do not wait for the app.
        </Text>
        <Txt>
          Call your local emergency number for severe trouble breathing, chest
          pain, unresponsiveness, or possible stroke. This list is not
          exhaustive.
        </Txt>
        <Button
          title="Call 911 (United States)"
          icon="call-outline"
          onPress={async () => {
            try {
              await Linking.openURL("tel:911");
            } catch {
              setMessage(
                "Use your phone to dial 911 in the United States, or your local emergency number.",
              );
            }
          }}
        />
        <Txt style={S.small}>
          Outside the United States, use your local emergency number. The app
          does not monitor entries or contact help automatically.
        </Txt>
        {Boolean(message) && (
          <Text accessibilityRole="alert" style={S.h3}>
            {message}
          </Text>
        )}
      </Card>
      <Section title="Know the signs of stroke" />
      <Txt>
        Sudden changes in any of the following can be warning signs. Call
        emergency services even if symptoms go away.
      </Txt>
      {[
        ["B", "Balance", "Sudden loss of balance or trouble walking"],
        ["E", "Eyes", "Sudden trouble seeing"],
        ["F", "Face", "Sudden facial weakness or drooping"],
        ["A", "Arms", "Sudden arm weakness, especially on one side"],
        ["S", "Speech", "Sudden trouble speaking or understanding"],
        ["T", "Time", "Call emergency services. Note when symptoms began."],
      ].map(([letter, title, body]) => (
        <View key={letter} style={S.row}>
          <View
            style={{
              width: 43,
              height: 43,
              borderRadius: 13,
              backgroundColor: C.redBg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={[S.h2, { color: C.rose }]}>{letter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>{title}</Text>
            <Txt>{body}</Txt>
          </View>
        </View>
      ))}
      <Row
        title="Read CDC stroke guidance"
        subtitle="Source: Centers for Disease Control and Prevention"
        icon="open-outline"
        onPress={() =>
          Linking.openURL(
            "https://www.cdc.gov/stroke/signs-symptoms/index.html",
          ).catch(() =>
            setMessage("Could not open the source. Please try again."),
          )
        }
      />
      <Txt style={S.small}>
        Educational guidance, not a complete assessment. Follow dispatcher
        instructions and the care plan from your healthcare team.
      </Txt>
    </Page>
  );
}
