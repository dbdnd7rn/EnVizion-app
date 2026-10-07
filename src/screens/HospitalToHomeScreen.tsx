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
  TextInput,
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
import { setTransitionItem } from "../backend";
import {
  completeCareTransitionPlan,
  createTransitionFollowUp,
  loadCareTransitionWorkspace,
  saveCareTransitionPlan,
  setTransitionFollowUpStatus,
  type CareTransitionFollowUp,
  type CareTransitionPlan,
} from "../careTransition";
import {
  transitionFollowUpCounts,
  transitionFollowUpTiming,
} from "../careTransitionHelpers";
import { transitionSteps } from "../content";
import { supabase } from "../supabase";
import { useCare } from "../store";
import { C, Heading, Icon, Page, S, Txt } from "../ui";
import { useNav } from "./MainScreens";

type PlanDraft = {
  hospitalName: string;
  dischargeDate: string;
  dischargeSummary: string;
  primaryDiagnosis: string;
  medicationChanges: string;
  followUpPlan: string;
  equipmentPlan: string;
  transportPlan: string;
  warningSigns: string;
  afterHoursContact: string;
};

type NoticeTone = "success" | "error" | "info";

const PURPLE = "#70338F";
const NAVY = "#15123D";
const MUTED = "#746E89";
const GLASS_BORDER = "#E6D9F0";

const emptyPlan: PlanDraft = {
  hospitalName: "",
  dischargeDate: "",
  dischargeSummary: "",
  primaryDiagnosis: "",
  medicationChanges: "",
  followUpPlan: "",
  equipmentPlan: "",
  transportPlan: "",
  warningSigns: "",
  afterHoursContact: "",
};

const sectionMeta = [
  {
    title: "Stay & discharge",
    subtitle: "Hospital, date, reason, key instructions",
    icon: "business-outline",
  },
  {
    title: "Medications & follow-ups",
    subtitle: "Changes, new meds, and appointments",
    icon: "medical-outline",
  },
  {
    title: "Equipment & transport",
    subtitle: "Supplies, home support, and getting home",
    icon: "car-outline",
  },
  {
    title: "Warning signs & contacts",
    subtitle: "What to watch for and who to call",
    icon: "warning-outline",
  },
] as const;

const checklistLabels = [
  "Confirm discharge instructions with the care team",
  "Review the medication list and what changed",
  "Record follow-up appointments",
  "Check equipment, transport & home support",
  "Know warning signs & who to call",
  "Share with your loved one & care partners",
] as const;

const checklistIcons = [
  "document-text-outline",
  "medical-outline",
  "calendar-outline",
  "car-outline",
  "warning-outline",
  "people-outline",
] as const;

function planToDraft(plan: CareTransitionPlan): PlanDraft {
  return {
    hospitalName: plan.hospitalName,
    dischargeDate: plan.dischargeDate,
    dischargeSummary: plan.dischargeSummary,
    primaryDiagnosis: plan.primaryDiagnosis,
    medicationChanges: plan.medicationChanges,
    followUpPlan: plan.followUpPlan,
    equipmentPlan: plan.equipmentPlan,
    transportPlan: plan.transportPlan,
    warningSigns: plan.warningSigns,
    afterHoursContact: plan.afterHoursContact,
  };
}

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
  const translateY = useRef(
    new Animated.Value(reducedMotion ? 0 : 12),
  ).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 280,
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

function HospitalToHomeArtwork({ reducedMotion }: { reducedMotion: boolean }) {
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      drift.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );

    loop.start();
    return () => loop.stop();
  }, [drift, reducedMotion]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        height: 180,
        marginHorizontal: -8,
        transform: [
          {
            translateY: drift.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -3],
            }),
          },
        ],
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 440 190"
        accessibilityElementsHidden
      >
        <Defs>
          <LinearGradient id="transitionGround" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFF9F4" />
            <Stop offset="0.55" stopColor="#F5ECFB" />
            <Stop offset="1" stopColor="#E9DCF8" />
          </LinearGradient>
          <LinearGradient id="transitionHospital" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="1" stopColor="#E4D4F1" />
          </LinearGradient>
          <LinearGradient id="transitionHome" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F4E7FF" />
            <Stop offset="1" stopColor="#B386D0" />
          </LinearGradient>
          <LinearGradient id="transitionPath" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFE8A7" />
            <Stop offset="0.5" stopColor="#FFF8E9" />
            <Stop offset="1" stopColor="#F1D8FF" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="440" height="190" rx="28" fill="url(#transitionGround)" />
        <Circle cx="356" cy="48" r="44" fill="#F7EEFF" opacity={0.75} />
        <Ellipse cx="216" cy="167" rx="194" ry="17" fill="#AF8BC7" opacity={0.11} />

        <Path
          d="M146 151C190 136 198 118 237 118C281 118 291 143 337 137"
          fill="none"
          stroke="#DABEFF"
          strokeWidth="15"
          strokeLinecap="round"
          opacity={0.22}
        />
        <Path
          d="M145 151C190 136 198 118 237 118C281 118 291 143 337 137"
          fill="none"
          stroke="url(#transitionPath)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <Path
          d="M145 151C190 136 198 118 237 118C281 118 291 143 337 137"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
          strokeLinecap="round"
          opacity={0.9}
        />

        <G transform="translate(28 63)">
          <Ellipse cx="74" cy="96" rx="66" ry="12" fill="#704490" opacity={0.12} />
          <Rect x="16" y="28" width="94" height="72" rx="7" fill="url(#transitionHospital)" stroke="#CBB2DE" />
          <Rect x="0" y="48" width="28" height="52" rx="5" fill="#EFE6F5" stroke="#CFB9DE" />
          <Rect x="99" y="45" width="30" height="55" rx="5" fill="#EADCF3" stroke="#C8AEDB" />
          <Rect x="51" y="70" width="25" height="30" rx="3" fill="#D5B6E8" />
          <Rect x="31" y="42" width="12" height="12" rx="2" fill="#FFEFC2" />
          <Rect x="82" y="42" width="12" height="12" rx="2" fill="#FFEFC2" />
          <Rect x="31" y="61" width="12" height="12" rx="2" fill="#F4ECFF" />
          <Rect x="82" y="61" width="12" height="12" rx="2" fill="#F4ECFF" />
          <Circle cx="63" cy="49" r="16" fill="#F8F1FF" stroke="#C8ACDA" />
          <Path d="M58 39H68V45H74V55H68V61H58V55H52V45H58Z" fill="#8040B0" />
        </G>

        <G transform="translate(307 74)">
          <Ellipse cx="55" cy="81" rx="52" ry="10" fill="#704490" opacity={0.11} />
          <Path d="M8 42L55 7L104 42V89H8Z" fill="#F8F1FF" stroke="#C7ADD9" />
          <Path d="M1 43L55 2L111 43L99 51L55 19L12 51Z" fill="url(#transitionHome)" />
          <Rect x="44" y="58" width="22" height="31" rx="3" fill="#E1C8F0" />
          <Rect x="18" y="51" width="18" height="17" rx="3" fill="#FFF0B8" />
          <Rect x="77" y="51" width="18" height="17" rx="3" fill="#FFF0B8" />
        </G>

        <G opacity={0.82}>
          <Path d="M283 126V78" stroke="#84629A" strokeWidth="3" strokeLinecap="round" />
          <Circle cx="283" cy="73" r="15" fill="#C3ACD1" />
          <Circle cx="273" cy="87" r="12" fill="#B99DC9" />
          <Circle cx="293" cy="89" r="11" fill="#D1C0DC" />
          <Path d="M405 132V91" stroke="#84629A" strokeWidth="3" strokeLinecap="round" />
          <Circle cx="405" cy="87" r="13" fill="#BFA5CF" />
          <Circle cx="397" cy="99" r="10" fill="#D4C3DE" />
        </G>
      </Svg>
    </Animated.View>
  );
}

function ActionButton({
  title,
  onPress,
  disabled = false,
  secondary = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  icon?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        borderRadius: 27,
        paddingHorizontal: 18,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        borderWidth: secondary ? 1 : 0,
        borderColor: secondary ? "#E4D7EC" : "transparent",
        backgroundColor: secondary ? "#F8F3FB" : PURPLE,
        opacity: disabled ? 0.45 : pressed ? 0.82 : 1,
        transform: [{ scale: pressed && !disabled ? 0.988 : 1 }],
        shadowColor: secondary ? "#5B3967" : PURPLE,
        shadowOpacity: secondary ? 0.04 : 0.15,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 6 },
        elevation: secondary ? 1 : 3,
      })}
    >
      {icon ? (
        <Icon name={icon} size={19} color={secondary ? PURPLE : C.white} />
      ) : null}
      <Text
        style={{
          fontFamily: "DMSans_600SemiBold",
          fontSize: 14.5,
          color: secondary ? PURPLE : C.white,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function GlassField({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "Write here…",
  date = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  date?: boolean;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{
          fontFamily: "DMSans_600SemiBold",
          fontSize: 13,
          lineHeight: 18,
          color: NAVY,
        }}
      >
        {label}
      </Text>
      <View style={{ position: "relative" }}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={onChange}
          multiline={multiline}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor="#A8A0B5"
          autoCapitalize={date ? "none" : "sentences"}
          style={{
            minHeight: multiline ? 96 : 54,
            borderRadius: 16,
            borderWidth: focused ? 1.5 : 1,
            borderColor: focused ? PURPLE : "#DDD2E6",
            backgroundColor: "#FFFFFFE8",
            paddingHorizontal: 15,
            paddingRight: date ? 48 : 15,
            paddingTop: multiline ? 14 : 0,
            paddingBottom: multiline ? 14 : 0,
            fontFamily: "DMSans_400Regular",
            fontSize: 14,
            lineHeight: 20,
            color: NAVY,
            textAlignVertical: multiline ? "top" : "center",
          }}
        />
        {date ? (
          <View
            pointerEvents="none"
            style={{ position: "absolute", right: 14, top: 15 }}
          >
            <Icon name="calendar-outline" size={21} color="#4F2784" />
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SummaryPanel({
  checklistComplete,
  checklistTotal,
  openFollowUps,
  planStatus,
}: {
  checklistComplete: number;
  checklistTotal: number;
  openFollowUps: number;
  planStatus: string;
}) {
  const progress =
    checklistTotal > 0 ? Math.min(1, checklistComplete / checklistTotal) : 0;

  return (
    <View
      style={{
        borderRadius: 25,
        borderWidth: 1,
        borderColor: "#E7D8F1",
        backgroundColor: "#F8F2FCDE",
        padding: 17,
        gap: 14,
        shadowColor: "#5A3A68",
        shadowOpacity: 0.05,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 8 },
        elevation: 2,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "stretch" }}>
        {[
          {
            eyebrow: "CHECKLIST",
            value: checklistComplete + "/" + checklistTotal,
            detail: "prepared",
          },
          {
            eyebrow: "FOLLOW-UPS",
            value: String(openFollowUps),
            detail: "still open",
          },
          {
            eyebrow: "PLAN",
            value: planStatus,
            detail: "",
          },
        ].map((item, index) => (
          <React.Fragment key={item.eyebrow}>
            {index > 0 ? (
              <View
                style={{
                  width: 1,
                  marginVertical: 3,
                  backgroundColor: "#DDD0E8",
                }}
              />
            ) : null}
            <View
              style={{
                flex: 1,
                minWidth: 0,
                paddingHorizontal: index === 1 ? 12 : 7,
              }}
            >
              <Text style={[S.eyebrow, { fontSize: 9, color: PURPLE }]}>
                {item.eyebrow}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
                style={{
                  marginTop: 6,
                  fontFamily:
                    item.eyebrow === "PLAN"
                      ? "DMSans_600SemiBold"
                      : "Lora_500Medium",
                  fontSize: item.eyebrow === "PLAN" ? 14.5 : 26,
                  lineHeight: item.eyebrow === "PLAN" ? 20 : 31,
                  color: NAVY,
                }}
              >
                {item.value}
              </Text>
              {item.detail ? (
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: "DMSans_400Regular",
                    fontSize: 11.5,
                    color: MUTED,
                  }}
                >
                  {item.detail}
                </Text>
              ) : null}
            </View>
          </React.Fragment>
        ))}
      </View>

      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: "#E2D6EB",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${Math.round(progress * 100)}%` as `${number}%`,
            height: "100%",
            borderRadius: 999,
            backgroundColor: PURPLE,
          }}
        />
      </View>
    </View>
  );
}

function Shortcut({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 155,
        minHeight: 66,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "#E6D9F0",
        backgroundColor: "#FFFFFFC9",
        paddingHorizontal: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        opacity: pressed ? 0.76 : 1,
        transform: [{ scale: pressed ? 0.99 : 1 }],
        shadowColor: "#4E3659",
        shadowOpacity: 0.035,
        shadowRadius: 11,
        shadowOffset: { width: 0, height: 5 },
        elevation: 1,
      })}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F1E5FA",
        }}
      >
        <Icon name={icon} size={21} color={PURPLE} />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: "DMSans_600SemiBold",
          fontSize: 13,
          lineHeight: 18,
          color: "#3A1E72",
        }}
      >
        {title}
      </Text>
      <Icon name="chevron-forward-outline" size={18} color={PURPLE} />
    </Pressable>
  );
}

function ReadValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ gap: 3 }}>
      <Text
        style={{
          fontFamily: "DMSans_600SemiBold",
          fontSize: 11.5,
          color: NAVY,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontFamily: "DMSans_400Regular",
          fontSize: 13,
          lineHeight: 19,
          color: value ? MUTED : "#9C94A5",
        }}
      >
        {value || "Not added yet."}
      </Text>
    </View>
  );
}

function PlanAccordion({
  index,
  expanded,
  onToggle,
  reducedMotion,
  children,
}: {
  index: number;
  expanded: boolean;
  onToggle: () => void;
  reducedMotion: boolean;
  children: React.ReactNode;
}) {
  const progress = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const meta = sectionMeta[index];

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
    <View
      style={{
        borderRadius: 23,
        borderWidth: 1,
        borderColor: GLASS_BORDER,
        backgroundColor: "#FFFFFFC8",
        overflow: "hidden",
        shadowColor: "#53365E",
        shadowOpacity: 0.035,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 1,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={meta.title}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={({ pressed }) => ({
          minHeight: 72,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View
          style={{
            width: 39,
            height: 39,
            borderRadius: 20,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#EFE2F9",
          }}
        >
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 13,
              color: PURPLE,
            }}
          >
            {index + 1}
          </Text>
        </View>

        <View
          style={{
            width: 34,
            height: 38,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={meta.icon} size={22} color={PURPLE} />
        </View>

        <View style={{ flex: 1, gap: 2 }}>
          <Text
            style={{
              fontFamily: "DMSans_600SemiBold",
              fontSize: 14.5,
              lineHeight: 20,
              color: NAVY,
            }}
          >
            {meta.title}
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 11.5,
              lineHeight: 16,
              color: "#8A8297",
            }}
          >
            {meta.subtitle}
          </Text>
        </View>

        <Animated.View
          style={{
            transform: [
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "180deg"],
                }),
              },
            ],
          }}
        >
          <Icon name="chevron-down-outline" size={20} color="#5B3A80" />
        </Animated.View>
      </Pressable>

      <Animated.View
        style={{
          maxHeight: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [0, index === 0 ? 690 : 520],
          }),
          opacity: progress,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            padding: 16,
            paddingTop: 15,
            gap: 14,
            borderTopWidth: 1,
            borderTopColor: "#EAE0F0",
            backgroundColor: "#FFFEFFD9",
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

function Notice({
  text,
  tone,
}: {
  text: string;
  tone: NoticeTone;
}) {
  const backgroundColor =
    tone === "error" ? "#FFF0F3" : tone === "success" ? "#EEF8F3" : "#F5EFF9";
  const foreground =
    tone === "error" ? "#B83D5A" : tone === "success" ? "#287A5E" : PURPLE;
  const icon =
    tone === "error"
      ? "alert-circle-outline"
      : tone === "success"
        ? "checkmark-circle-outline"
        : "information-circle-outline";

  return (
    <View
      style={{
        borderRadius: 18,
        borderWidth: 1,
        borderColor:
          tone === "error"
            ? "#F3D3DC"
            : tone === "success"
              ? "#D7EBE1"
              : "#E7D9EF",
        backgroundColor,
        padding: 13,
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 10,
      }}
    >
      <Icon name={icon} size={20} color={foreground} />
      <Text
        accessibilityRole="alert"
        style={{
          flex: 1,
          fontFamily: "DMSans_400Regular",
          fontSize: 13,
          lineHeight: 19,
          color: foreground,
        }}
      >
        {text}
      </Text>
    </View>
  );
}

function ChecklistRow({
  index,
  label,
  originalLabel,
  completed,
  disabled,
  reducedMotion,
  onPress,
}: {
  index: number;
  label: string;
  originalLabel: string;
  completed: boolean;
  disabled: boolean;
  reducedMotion: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const previousCompleted = useRef(completed);

  useEffect(() => {
    if (previousCompleted.current === completed) return;
    previousCompleted.current = completed;

    if (reducedMotion) {
      scale.setValue(1);
      return;
    }

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.12,
        duration: 100,
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 8,
        stiffness: 190,
        mass: 0.45,
        useNativeDriver: Platform.OS !== "web",
      }),
    ]).start();
  }, [completed, reducedMotion, scale]);

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={originalLabel}
      accessibilityState={{ checked: completed, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 58,
        paddingVertical: 11,
        paddingHorizontal: 8,
        borderBottomWidth: index === transitionSteps.length - 1 ? 0 : 1,
        borderBottomColor: "#E9E2ED",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
      })}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon
          name={completed ? "checkmark-circle" : "ellipse-outline"}
          size={25}
          color={completed ? PURPLE : "#6F6880"}
        />
      </Animated.View>
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: 17,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#F4ECFA",
        }}
      >
        <Icon name={checklistIcons[index]} size={19} color={PURPLE} />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: "DMSans_400Regular",
          fontSize: 13,
          lineHeight: 19,
          color: NAVY,
          textDecorationLine: completed ? "line-through" : "none",
          opacity: completed ? 0.65 : 1,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function HospitalToHomeScreen() {
  const n = useNav();
  const { state, dispatch } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly =
    state.accessRole === "viewer" || state.accessRole === "patient";
  const reducedMotion = useReducedMotionPreference();

  const [plan, setPlan] = useState<CareTransitionPlan | null>(null);
  const [followUps, setFollowUps] = useState<CareTransitionFollowUp[]>([]);
  const [draft, setDraft] = useState<PlanDraft>(emptyPlan);
  const [editingPlan, setEditingPlan] = useState(false);
  const editingPlanRef = useRef(false);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [followUpTitle, setFollowUpTitle] = useState("");
  const [followUpDueAt, setFollowUpDueAt] = useState("");
  const [followUpProvider, setFollowUpProvider] = useState("");
  const [followUpDetails, setFollowUpDetails] = useState("");
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<NoticeTone>("info");

  const setPlanEditing = useCallback((value: boolean) => {
    editingPlanRef.current = value;
    setEditingPlan(value);
  }, []);

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setPlan(null);
      setFollowUps([]);
      if (!editingPlanRef.current) setDraft(emptyPlan);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const result = await loadCareTransitionWorkspace(careRecipientId);
      setPlan(result.plan);
      setFollowUps(result.followUps);

      if (!editingPlanRef.current) {
        setDraft(result.plan ? planToDraft(result.plan) : emptyPlan);
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "We could not load the hospital-to-home plan.",
      );
      setNoticeTone("error");
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
      .channel("transition-plan:" + careRecipientId)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_transition_plans",
          filter: "care_recipient_id=eq." + careRecipientId,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_transition_followups",
          filter: "care_recipient_id=eq." + careRecipientId,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const counts = useMemo(
    () => transitionFollowUpCounts(followUps),
    [followUps],
  );

  const checklistComplete = useMemo(
    () =>
      transitionSteps.reduce(
        (total, _step, index) =>
          total + (state.transition.includes(index) ? 1 : 0),
        0,
      ),
    [state.transition],
  );

  const planStatus =
    plan?.status === "active"
      ? "In progress"
      : plan?.status === "completed"
        ? "Completed"
        : "Not started";

  function beginPlanEdit(section = 0) {
    if (readOnly) return;

    setDraft(plan ? planToDraft(plan) : emptyPlan);
    setPlanEditing(true);
    setExpandedSection(section);
    setNotice("");
  }

  function cancelPlanEdit() {
    setPlanEditing(false);
    setDraft(plan ? planToDraft(plan) : emptyPlan);
    setExpandedSection(null);
    setNotice("");
  }

  async function savePlan() {
    if (!careRecipientId || readOnly) return;
    setBusyId("plan");
    setNotice("");

    try {
      const saved = await saveCareTransitionPlan({
        careRecipientId,
        id: plan?.status === "active" ? plan.id : null,
        ...draft,
      });

      setPlan(saved);
      setDraft(planToDraft(saved));
      setPlanEditing(false);
      setExpandedSection(null);
      await refresh();
      setNotice("Hospital-to-home transition plan saved.");
      setNoticeTone("success");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "We could not save the transition plan.",
      );
      setNoticeTone("error");
    } finally {
      setBusyId(null);
    }
  }

  async function addFollowUp() {
    if (!careRecipientId || !plan || readOnly) return;
    setBusyId("follow-up");
    setNotice("");

    try {
      await createTransitionFollowUp({
        careRecipientId,
        planId: plan.id,
        title: followUpTitle,
        dueAt: followUpDueAt,
        provider: followUpProvider,
        details: followUpDetails,
      });
      setFollowUpTitle("");
      setFollowUpDueAt("");
      setFollowUpProvider("");
      setFollowUpDetails("");
      setAddingFollowUp(false);
      await refresh();
      setNotice("Follow-up added to the transition plan.");
      setNoticeTone("success");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "We could not add this follow-up.",
      );
      setNoticeTone("error");
    } finally {
      setBusyId(null);
    }
  }

  async function updateFollowUp(
    followUp: CareTransitionFollowUp,
    status: "completed" | "cancelled",
  ) {
    if (!careRecipientId || readOnly) return;
    setBusyId(followUp.id);
    setNotice("");

    try {
      await setTransitionFollowUpStatus({
        careRecipientId,
        followUpId: followUp.id,
        status,
      });
      await refresh();
      setNotice(
        status === "completed"
          ? "Follow-up marked complete."
          : "Follow-up cancelled.",
      );
      setNoticeTone("success");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "We could not update this follow-up.",
      );
      setNoticeTone("error");
    } finally {
      setBusyId(null);
    }
  }

  async function markTransitionComplete() {
    if (!careRecipientId || !plan || readOnly) return;
    setBusyId("complete-plan");
    setNotice("");

    try {
      await completeCareTransitionPlan(careRecipientId, plan.id);
      await refresh();
      setNotice("Hospital-to-home transition workflow marked complete.");
      setNoticeTone("success");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "We could not complete this transition.",
      );
      setNoticeTone("error");
    } finally {
      setBusyId(null);
    }
  }

  function toggleSection(index: number) {
    if (!plan && !editingPlan && !readOnly) {
      beginPlanEdit(index);
      return;
    }

    setExpandedSection((current) => (current === index ? null : index));
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="HOSPITAL TO HOME"
          title="Choose a care profile first."
        />
      </Page>
    );
  }

  return (
    <Page>
      <MotionBlock reducedMotion={reducedMotion}>
        <View
          style={{
            minHeight: 50,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => n.goBack()}
            style={({ pressed }) => ({
              width: 46,
              height: 46,
              borderRadius: 23,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.62 : 1,
            })}
          >
            <Icon name="chevron-back-outline" size={25} color={PURPLE} />
          </Pressable>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "DMSans_600SemiBold",
              fontSize: 16,
              color: PURPLE,
            }}
          >
            Hospital to home
          </Text>
        </View>
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={50}>
        <View style={{ gap: 8 }}>
          <Text style={[S.eyebrow, { color: PURPLE }]}>
            YOUR TRANSITION PLAN
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              maxWidth: 365,
              fontFamily: "Lora_500Medium",
              fontSize: 39,
              lineHeight: 45,
              letterSpacing: -1.1,
              color: NAVY,
            }}
          >
            A little more ready for home.
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 15.5,
              lineHeight: 22,
              color: MUTED,
            }}
          >
            Your discharge details, together.
          </Text>
        </View>
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={90}>
        <HospitalToHomeArtwork reducedMotion={reducedMotion} />
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={120}>
        <SummaryPanel
          checklistComplete={checklistComplete}
          checklistTotal={transitionSteps.length}
          openFollowUps={counts.open}
          planStatus={planStatus}
        />
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={145}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          <Shortcut
            title="Medication management"
            icon="medical-outline"
            onPress={() => n.navigate("Medications")}
          />
          <Shortcut
            title="Daily care plan"
            icon="list-outline"
            onPress={() => n.navigate("CarePlan")}
          />
          <Shortcut
            title="Document vault"
            icon="folder-open-outline"
            onPress={() => n.navigate("CareDocuments")}
          />
          <Shortcut
            title="Care contacts"
            icon="call-outline"
            onPress={() => n.navigate("CareContacts")}
          />
        </View>
      </MotionBlock>

      {readOnly ? (
        <MotionBlock reducedMotion={reducedMotion} delay={155}>
          <View
            style={{
              borderRadius: 18,
              borderWidth: 1,
              borderColor: "#E5D8ED",
              backgroundColor: "#F6EFFA",
              padding: 13,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Icon name="eye-outline" size={20} color={PURPLE} />
            <Text
              style={{
                flex: 1,
                fontFamily: "DMSans_400Regular",
                fontSize: 12.5,
                lineHeight: 18,
                color: "#655573",
              }}
            >
              Viewer access is read-only. You can review this transition but cannot change it.
            </Text>
          </View>
        </MotionBlock>
      ) : null}

      {notice ? (
        <MotionBlock reducedMotion={reducedMotion}>
          <Notice text={notice} tone={noticeTone} />
        </MotionBlock>
      ) : null}

      <MotionBlock reducedMotion={reducedMotion} delay={175}>
        <View style={{ gap: 4 }}>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "Lora_500Medium",
              fontSize: 30,
              lineHeight: 37,
              letterSpacing: -0.7,
              color: NAVY,
            }}
          >
            Discharge plan
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 13,
              lineHeight: 19,
              color: MUTED,
            }}
          >
            Keep the care team’s instructions close.
          </Text>
        </View>
      </MotionBlock>

      {loading && !plan ? (
        <MotionBlock reducedMotion={reducedMotion}>
          <View
            style={{
              minHeight: 112,
              borderRadius: 23,
              borderWidth: 1,
              borderColor: GLASS_BORDER,
              backgroundColor: "#FFFFFFC7",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <ActivityIndicator color={PURPLE} />
            <Txt>Loading transition plan…</Txt>
          </View>
        </MotionBlock>
      ) : (
        <View style={{ gap: 10 }}>
          <PlanAccordion
            index={0}
            expanded={expandedSection === 0}
            onToggle={() => toggleSection(0)}
            reducedMotion={reducedMotion}
          >
            {editingPlan ? (
              <>
                <GlassField
                  label="Hospital / facility"
                  value={draft.hospitalName}
                  onChange={(hospitalName) =>
                    setDraft((current) => ({ ...current, hospitalName }))
                  }
                />
                <GlassField
                  label="Discharge date (YYYY-MM-DD)"
                  value={draft.dischargeDate}
                  onChange={(dischargeDate) =>
                    setDraft((current) => ({ ...current, dischargeDate }))
                  }
                  placeholder="YYYY-MM-DD"
                  date
                />
                <GlassField
                  label="Primary diagnosis / reason for stay"
                  value={draft.primaryDiagnosis}
                  onChange={(primaryDiagnosis) =>
                    setDraft((current) => ({ ...current, primaryDiagnosis }))
                  }
                  multiline
                />
                <GlassField
                  label="Discharge summary / key instructions"
                  value={draft.dischargeSummary}
                  onChange={(dischargeSummary) =>
                    setDraft((current) => ({ ...current, dischargeSummary }))
                  }
                  multiline
                />
              </>
            ) : (
              <>
                <ReadValue label="Hospital / facility" value={plan?.hospitalName ?? ""} />
                <ReadValue label="Discharge date" value={plan?.dischargeDate ?? ""} />
                <ReadValue
                  label="Primary diagnosis / reason for stay"
                  value={plan?.primaryDiagnosis ?? ""}
                />
                <ReadValue
                  label="Discharge summary / key instructions"
                  value={plan?.dischargeSummary ?? ""}
                />
              </>
            )}
          </PlanAccordion>

          <PlanAccordion
            index={1}
            expanded={expandedSection === 1}
            onToggle={() => toggleSection(1)}
            reducedMotion={reducedMotion}
          >
            {editingPlan ? (
              <>
                <GlassField
                  label="Medication changes"
                  value={draft.medicationChanges}
                  onChange={(medicationChanges) =>
                    setDraft((current) => ({ ...current, medicationChanges }))
                  }
                  multiline
                />
                <GlassField
                  label="Follow-up plan"
                  value={draft.followUpPlan}
                  onChange={(followUpPlan) =>
                    setDraft((current) => ({ ...current, followUpPlan }))
                  }
                  multiline
                />
                <Text
                  style={{
                    fontFamily: "DMSans_400Regular",
                    fontSize: 11.5,
                    lineHeight: 17,
                    color: "#8A8297",
                  }}
                >
                  Record discharge-team medication changes exactly as provided. EnVizion does not generate medication instructions.
                </Text>
              </>
            ) : (
              <>
                <ReadValue
                  label="Medication changes"
                  value={plan?.medicationChanges ?? ""}
                />
                <ReadValue
                  label="Follow-up plan"
                  value={plan?.followUpPlan ?? ""}
                />
              </>
            )}
          </PlanAccordion>

          <PlanAccordion
            index={2}
            expanded={expandedSection === 2}
            onToggle={() => toggleSection(2)}
            reducedMotion={reducedMotion}
          >
            {editingPlan ? (
              <>
                <GlassField
                  label="Equipment / supplies needed"
                  value={draft.equipmentPlan}
                  onChange={(equipmentPlan) =>
                    setDraft((current) => ({ ...current, equipmentPlan }))
                  }
                  multiline
                />
                <GlassField
                  label="Transport / getting home"
                  value={draft.transportPlan}
                  onChange={(transportPlan) =>
                    setDraft((current) => ({ ...current, transportPlan }))
                  }
                  multiline
                />
              </>
            ) : (
              <>
                <ReadValue
                  label="Equipment / supplies needed"
                  value={plan?.equipmentPlan ?? ""}
                />
                <ReadValue
                  label="Transport / getting home"
                  value={plan?.transportPlan ?? ""}
                />
              </>
            )}
          </PlanAccordion>

          <PlanAccordion
            index={3}
            expanded={expandedSection === 3}
            onToggle={() => toggleSection(3)}
            reducedMotion={reducedMotion}
          >
            {editingPlan ? (
              <>
                <GlassField
                  label="Warning signs exactly as provided by the discharge team"
                  value={draft.warningSigns}
                  onChange={(warningSigns) =>
                    setDraft((current) => ({ ...current, warningSigns }))
                  }
                  multiline
                />
                <GlassField
                  label="After-hours contact / instructions"
                  value={draft.afterHoursContact}
                  onChange={(afterHoursContact) =>
                    setDraft((current) => ({ ...current, afterHoursContact }))
                  }
                  multiline
                />
              </>
            ) : (
              <>
                <ReadValue
                  label="Warning signs exactly as provided by the discharge team"
                  value={plan?.warningSigns ?? ""}
                />
                <ReadValue
                  label="After-hours contact / instructions"
                  value={plan?.afterHoursContact ?? ""}
                />
              </>
            )}
          </PlanAccordion>
        </View>
      )}

      {!loading ? (
        <MotionBlock reducedMotion={reducedMotion} delay={210}>
          <View style={{ gap: 10 }}>
            {editingPlan ? (
              <>
                <ActionButton
                  title={busyId === "plan" ? "Saving transition plan…" : "Save transition plan"}
                  disabled={readOnly || busyId !== null}
                  onPress={() => void savePlan()}
                />
                <ActionButton
                  title="Cancel editing"
                  secondary
                  disabled={busyId !== null}
                  onPress={cancelPlanEdit}
                />
              </>
            ) : (
              <ActionButton
                title={plan ? "Edit transition plan" : "Start transition plan"}
                icon={plan ? "create-outline" : "arrow-forward-outline"}
                disabled={readOnly || busyId !== null}
                onPress={() => beginPlanEdit(0)}
              />
            )}

            {plan?.status === "active" && !editingPlan ? (
              <>
                <ActionButton
                  title={
                    busyId === "complete-plan"
                      ? "Updating transition…"
                      : "Mark transition workflow complete"
                  }
                  secondary
                  disabled={readOnly || busyId !== null || counts.open > 0}
                  onPress={() => void markTransitionComplete()}
                />
                {counts.open > 0 ? (
                  <Text
                    style={{
                      fontFamily: "DMSans_400Regular",
                      fontSize: 11.5,
                      lineHeight: 17,
                      color: MUTED,
                      textAlign: "center",
                    }}
                  >
                    Complete or cancel the remaining follow-ups before closing the transition workflow.
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>
        </MotionBlock>
      ) : null}

      <MotionBlock reducedMotion={reducedMotion} delay={230}>
        <View
          style={{
            height: 1,
            backgroundColor: "#E7DDEC",
            marginVertical: 2,
          }}
        />
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={245}>
        <View style={{ gap: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <Icon name="calendar-outline" size={22} color={PURPLE} />
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "Lora_500Medium",
                fontSize: 27,
                lineHeight: 34,
                letterSpacing: -0.6,
                color: NAVY,
              }}
            >
              Follow-ups after discharge
            </Text>
          </View>
        </View>
      </MotionBlock>

      {!followUps.length ? (
        <MotionBlock reducedMotion={reducedMotion} delay={260}>
          <View
            style={{
              minHeight: 112,
              borderRadius: 23,
              borderWidth: 1,
              borderColor: "#E8DFED",
              backgroundColor: "#FFFFFFC9",
              padding: 17,
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
                backgroundColor: "#F0E5F8",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="calendar-outline" size={25} color="#6C4B8B" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[S.h3, { fontSize: 14.5 }]}>
                No follow-ups added yet.
              </Text>
              <Txt style={S.small}>
                Add appointments or other follow-up tasks to keep track after discharge.
              </Txt>
            </View>
          </View>
        </MotionBlock>
      ) : (
        <View style={{ gap: 10 }}>
          {followUps.map((followUp) => {
            const timing = transitionFollowUpTiming(followUp);
            const completed = followUp.status === "completed";
            const cancelled = followUp.status === "cancelled";

            return (
              <MotionBlock
                key={followUp.id}
                reducedMotion={reducedMotion}
                delay={260}
              >
                <View
                  style={{
                    borderRadius: 22,
                    borderWidth: 1,
                    borderColor:
                      timing === "overdue" && !completed && !cancelled
                        ? "#F1D3DB"
                        : "#E8DFED",
                    backgroundColor:
                      completed
                        ? "#F0F8F4"
                        : timing === "overdue" && !cancelled
                          ? "#FFF3F5"
                          : "#FFFFFFC9",
                    padding: 16,
                    gap: 12,
                  }}
                >
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 11,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 21,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: completed ? "#DFF1E8" : "#F2E7FA",
                      }}
                    >
                      <Icon
                        name={
                          completed
                            ? "checkmark-outline"
                            : timing === "overdue" && !cancelled
                              ? "warning-outline"
                              : "calendar-outline"
                        }
                        size={21}
                        color={
                          completed
                            ? C.green
                            : timing === "overdue" && !cancelled
                              ? C.rose
                              : PURPLE
                        }
                      />
                    </View>

                    <View style={{ flex: 1, gap: 3 }}>
                      <Text style={[S.h3, { fontSize: 14.5 }]}>
                        {followUp.title}
                      </Text>
                      <Text style={S.small}>
                        {followUp.dueAt
                          ? new Date(followUp.dueAt).toLocaleString()
                          : "No date recorded"}
                        {followUp.provider ? " · " + followUp.provider : ""}
                      </Text>
                      {cancelled ? (
                        <Text style={[S.small, { color: MUTED }]}>Cancelled</Text>
                      ) : null}
                    </View>
                  </View>

                  {followUp.details ? <Txt>{followUp.details}</Txt> : null}

                  {followUp.status === "open" ? (
                    <View style={{ flexDirection: "row", gap: 9 }}>
                      <View style={{ flex: 1 }}>
                        <ActionButton
                          title={busyId === followUp.id ? "Updating…" : "Complete"}
                          disabled={readOnly || busyId !== null}
                          onPress={() => void updateFollowUp(followUp, "completed")}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <ActionButton
                          title="Cancel"
                          secondary
                          disabled={readOnly || busyId !== null}
                          onPress={() => void updateFollowUp(followUp, "cancelled")}
                        />
                      </View>
                    </View>
                  ) : null}
                </View>
              </MotionBlock>
            );
          })}
        </View>
      )}

      {plan?.status === "active" ? (
        <MotionBlock reducedMotion={reducedMotion} delay={275}>
          <View style={{ gap: 10 }}>
            <ActionButton
              title={addingFollowUp ? "Cancel new follow-up" : "Add follow-up"}
              secondary
              icon={addingFollowUp ? "close-outline" : "add-outline"}
              disabled={readOnly || busyId !== null}
              onPress={() => setAddingFollowUp((value) => !value)}
            />

            {addingFollowUp ? (
              <View
                style={{
                  borderRadius: 23,
                  borderWidth: 1,
                  borderColor: GLASS_BORDER,
                  backgroundColor: "#FFFFFFD0",
                  padding: 16,
                  gap: 14,
                }}
              >
                <GlassField
                  label="Follow-up"
                  value={followUpTitle}
                  onChange={setFollowUpTitle}
                />
                <GlassField
                  label="Date/time (for example 2026-09-30T10:00)"
                  value={followUpDueAt}
                  onChange={setFollowUpDueAt}
                />
                <GlassField
                  label="Provider / organization"
                  value={followUpProvider}
                  onChange={setFollowUpProvider}
                />
                <GlassField
                  label="What needs to happen?"
                  value={followUpDetails}
                  onChange={setFollowUpDetails}
                  multiline
                />
                <ActionButton
                  title={busyId === "follow-up" ? "Adding follow-up…" : "Add follow-up"}
                  disabled={
                    readOnly || busyId !== null || !followUpTitle.trim()
                  }
                  onPress={() => void addFollowUp()}
                />
              </View>
            ) : null}
          </View>
        </MotionBlock>
      ) : null}

      <MotionBlock reducedMotion={reducedMotion} delay={290}>
        <View
          style={{
            height: 1,
            backgroundColor: "#E7DDEC",
            marginVertical: 2,
          }}
        />
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={300}>
        <View style={{ gap: 5 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "Lora_500Medium",
                fontSize: 30,
                lineHeight: 37,
                letterSpacing: -0.7,
                color: NAVY,
              }}
            >
              Discharge checklist
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 12,
                color: NAVY,
              }}
            >
              {checklistComplete} of {transitionSteps.length} prepared
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 11.5,
              lineHeight: 17,
              color: MUTED,
            }}
          >
            Preparation tasks only — this checklist does not mean medical clearance or readiness for discharge.
          </Text>
        </View>
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={315}>
        <View
          style={{
            borderRadius: 23,
            borderWidth: 1,
            borderColor: "#E8DFED",
            backgroundColor: "#FFFFFFC9",
            paddingHorizontal: 8,
            overflow: "hidden",
          }}
        >
          {transitionSteps.map((step, index) => {
            const completed = state.transition.includes(index);

            return (
              <ChecklistRow
                key={step}
                index={index}
                label={checklistLabels[index] ?? step}
                originalLabel={step}
                completed={completed}
                disabled={readOnly || busyId !== null}
                reducedMotion={reducedMotion}
                onPress={async () => {
                  setBusyId("check-" + index);
                  setNotice("");

                  try {
                    await setTransitionItem(index, !completed);
                    dispatch({ type: "transition", index });
                    setNotice(
                      !completed
                        ? "Checklist item marked prepared."
                        : "Checklist item reopened.",
                    );
                    setNoticeTone("success");
                  } catch (error) {
                    setNotice(
                      error instanceof Error
                        ? error.message
                        : "We could not update the checklist.",
                    );
                    setNoticeTone("error");
                  } finally {
                    setBusyId(null);
                  }
                }}
              />
            );
          })}
        </View>
      </MotionBlock>

      <MotionBlock reducedMotion={reducedMotion} delay={330}>
        <View
          style={{
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "#F1D7DE",
            backgroundColor: "#FFF0F3",
            padding: 17,
            gap: 13,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "#FFF8FA",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="warning-outline" size={24} color="#C23857" />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 15,
                  color: "#B83250",
                }}
              >
                Urgent help comes first.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: "#8E6570",
                }}
              >
                Use the warning signs and contact instructions given by the discharge team. For a possible emergency, use local emergency services rather than waiting on the app.
              </Text>
            </View>
          </View>

          <ActionButton
            title="Review emergency guidance"
            secondary
            onPress={() => n.navigate("Emergency")}
          />
        </View>
      </MotionBlock>

      <View
        style={{
          paddingTop: 4,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "DMSans_400Regular",
            fontSize: 11.5,
            lineHeight: 17,
            color: "#8A8297",
            textAlign: "center",
          }}
        >
          Follow your discharge team’s instructions.
        </Text>
      </View>
    </Page>
  );
}
