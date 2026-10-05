import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  Text,
  UIManager,
  View,
  useWindowDimensions,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polyline,
  Rect,
  Stop,
} from "react-native-svg";
import { transitionSteps } from "../content";
import {
  appointmentPreparation,
  buildCareTimeline,
  buildDailyActivity,
  medicationStats,
  numericSeries,
  type NumericPoint,
} from "../insights";
import { useCare } from "../store";
import { Icon, S } from "../ui";
import { SafeAreaView } from "react-native-safe-area-context";
import { CareInsightsRibbonArt } from "../components/CareInsightsRibbonArt";
import { useNav } from "./MainScreens";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const INK = "#10123F";
const MUTED = "#6F6E8E";
const PURPLE = "#7C29B4";
const SOFT_LAVENDER = "#F5EEFD";
const BORDER = "#E7E2EB";

function InsightsPage({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#FFFFFF" }} edges={["top"]}>
      <ScrollView
        style={{ flex: 1, backgroundColor: "#FFFFFF" }}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 6,
          paddingBottom: 42,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={{
            width: "100%",
            maxWidth: 440,
            alignSelf: "center",
            gap: 20,
          }}
        >
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function useReducedMotionPreference() {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
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
      duration: 390,
      delay,
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

function MetricNumber({
  value,
  reducedMotion,
  style,
}: {
  value: string | number;
  reducedMotion: boolean;
  style?: any;
}) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.45);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [opacity, reducedMotion, value]);

  return <Animated.Text style={[style, { opacity }]}>{value}</Animated.Text>;
}

function CareInsightsTopBar({
  onBack,
  onInfo,
  infoOpen,
}: {
  onBack: () => void;
  onInfo: () => void;
  infoOpen: boolean;
}) {
  const buttonStyle = ({ pressed }: { pressed: boolean }) => ({
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    opacity: pressed ? 0.58 : 1,
    transform: [{ scale: pressed ? 0.96 : 1 }],
  });

  return (
    <View
      style={{
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={buttonStyle}
      >
        <Icon name="chevron-back-outline" size={28} color={INK} />
      </Pressable>

      <Text
        accessibilityRole="header"
        style={{
          fontFamily: "Lora_500Medium",
          fontSize: 24,
          lineHeight: 31,
          color: INK,
          letterSpacing: -0.5,
        }}
      >
        Care insights
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={infoOpen ? "Hide insight information" : "About care insights"}
        accessibilityState={{ expanded: infoOpen }}
        onPress={onInfo}
        style={buttonStyle}
      >
        <Icon name="information-circle-outline" size={29} color={INK} />
      </Pressable>
    </View>
  );
}

function FloatingRibbon({ reducedMotion }: { reducedMotion: boolean }) {
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
          duration: 2300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2300,
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
        width: 252,
        height: 205,
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
      <CareInsightsRibbonArt />
    </Animated.View>
  );
}

function ProfileCardBackground() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 420 154"
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="profileBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8C4FC3" />
          <Stop offset="0.52" stopColor="#6A2B94" />
          <Stop offset="1" stopColor="#9557C8" />
        </LinearGradient>
        <LinearGradient id="profileGlass" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.5} />
          <Stop offset="1" stopColor="#E0C9F8" stopOpacity={0.14} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="420" height="154" rx="28" fill="url(#profileBg)" />
      <Path
        d="M-12 49C72-8 166-2 258 36C329 65 374 55 435 10"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="1.2"
        opacity={0.36}
      />
      <Path
        d="M194 157C238 92 305 69 432 73V157H194Z"
        fill="url(#profileGlass)"
        opacity={0.35}
      />
      <Circle cx="47" cy="18" r="59" fill="#FFFFFF" opacity={0.045} />
      <Circle cx="385" cy="144" r="72" fill="#FFFFFF" opacity={0.04} />
    </Svg>
  );
}

function dayNumber(dateKey: string) {
  const parts = dateKey.split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return "";
  return String(parts[2]);
}

function formatRecordedAt(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      style={{
        fontFamily: "Lora_500Medium",
        fontSize: 25,
        lineHeight: 32,
        letterSpacing: -0.55,
        color: INK,
      }}
    >
      {children}
    </Text>
  );
}

function GlassCard({
  children,
  style,
  onPress,
  label,
}: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  label?: string;
}) {
  const base = {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.9)",
    shadowColor: "#4D2A66",
    shadowOpacity: 0.055,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  } as const;

  if (!onPress) {
    return <View style={[base, style]}>{children}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        base,
        style,
        pressed && { opacity: 0.78, transform: [{ scale: 0.992 }] },
      ]}
    >
      {children}
    </Pressable>
  );
}

function MiniLineChart({
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
}: {
  primary: NumericPoint[];
  secondary?: NumericPoint[];
  primaryLabel: string;
  secondaryLabel?: string;
}) {
  const width = 260;
  const height = 88;
  const padX = 10;
  const padY = 12;
  const combined = [...primary, ...(secondary ?? [])];

  if (!combined.length) return null;

  const values = combined.map((point) => point.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(Math.abs(rawMax) * 0.08, 1);
  const min = rawMin - spread * 0.14;
  const max = rawMax + spread * 0.14;
  const times = combined.map((point) => new Date(point.recordedAt).getTime());
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);

  const points = (series: NumericPoint[]) =>
    series.map((point) => {
      const time = new Date(point.recordedAt).getTime();
      const x =
        maxTime === minTime
          ? width / 2
          : padX + ((time - minTime) / (maxTime - minTime)) * (width - padX * 2);
      const y =
        height -
        padY -
        ((point.value - min) / (max - min)) * (height - padY * 2);
      return { x, y };
    });

  const primaryPoints = points(primary);
  const secondaryPoints = points(secondary ?? []);
  const polyline = (items: { x: number; y: number }[]) =>
    items.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <View
      accessible
      accessibilityLabel={`${primaryLabel} chart with ${primary.length} recorded values${secondaryLabel ? ` and ${secondary?.length ?? 0} ${secondaryLabel.toLowerCase()} values` : ""}`}
      style={{ marginTop: 8 }}
    >
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {[0.33, 0.66].map((ratio) => (
          <Path
            key={ratio}
            d={`M ${padX} ${padY + (height - padY * 2) * ratio} H ${width - padX}`}
            stroke="#E9E2EF"
            strokeWidth="1"
          />
        ))}
        {primaryPoints.length > 1 && (
          <Polyline
            points={polyline(primaryPoints)}
            fill="none"
            stroke={PURPLE}
            strokeWidth="2.6"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {primaryPoints.map((point, index) => (
          <Circle
            key={`p-${index}`}
            cx={point.x}
            cy={point.y}
            r="3.2"
            fill={PURPLE}
          />
        ))}
        {secondaryPoints.length > 1 && (
          <Polyline
            points={polyline(secondaryPoints)}
            fill="none"
            stroke="#B49ACB"
            strokeWidth="2.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
        {secondaryPoints.map((point, index) => (
          <Circle
            key={`s-${index}`}
            cx={point.x}
            cy={point.y}
            r="3"
            fill="#B49ACB"
          />
        ))}
      </Svg>
    </View>
  );
}

function LatestReading({
  primary,
  secondary,
  unit,
}: {
  primary: NumericPoint[];
  secondary?: NumericPoint[];
  unit: string;
}) {
  const latestPrimary = primary[primary.length - 1];
  const latestSecondary = secondary?.[secondary.length - 1];
  const candidates = [latestPrimary, latestSecondary].filter(Boolean) as NumericPoint[];
  if (!candidates.length) return null;

  const latest = candidates.reduce((best, point) =>
    new Date(point.recordedAt).getTime() > new Date(best.recordedAt).getTime()
      ? point
      : best,
  );

  const displayValue =
    latestPrimary && latestSecondary
      ? `${latestPrimary.value}/${latestSecondary.value}`
      : String(latestPrimary?.value ?? latestSecondary?.value ?? "");

  return (
    <View style={{ gap: 2, marginTop: 5 }}>
      <Text
        style={{
          fontFamily: "DMSans_600SemiBold",
          fontSize: 12,
          lineHeight: 17,
          color: INK,
        }}
      >
        {displayValue} {unit}
      </Text>
      <Text
        style={{
          fontFamily: "DMSans_400Regular",
          fontSize: 10.5,
          lineHeight: 15,
          color: MUTED,
        }}
      >
        Latest · {formatRecordedAt(latest.recordedAt)}
      </Text>
    </View>
  );
}

function RecordedValueCard({
  title,
  icon,
  primary,
  secondary,
  unit,
  onPress,
}: {
  title: string;
  icon: string;
  primary: NumericPoint[];
  secondary?: NumericPoint[];
  unit: string;
  onPress: () => void;
}) {
  const hasReadings = primary.length > 0 || Boolean(secondary?.length);

  return (
    <GlassCard
      label={`Open ${title.toLowerCase()} records`}
      onPress={onPress}
      style={{ flex: 1, minWidth: 0, padding: 14, gap: 3 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 46,
            height: 46,
            borderRadius: 18,
            backgroundColor: SOFT_LAVENDER,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={25} color={PURPLE} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            numberOfLines={2}
            style={{
              fontFamily: "DMSans_600SemiBold",
              fontSize: 14,
              lineHeight: 19,
              color: INK,
            }}
          >
            {title}
          </Text>
          {!hasReadings && (
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 12,
                lineHeight: 18,
                color: MUTED,
              }}
            >
              No readings yet
            </Text>
          )}
        </View>
        <Icon name="arrow-forward-outline" size={20} color={INK} />
      </View>

      {hasReadings && (
        <>
          <MiniLineChart
            primary={primary}
            secondary={secondary}
            primaryLabel={title === "Blood pressure" ? "Systolic" : title}
            secondaryLabel={secondary ? "Diastolic" : undefined}
          />
          <LatestReading primary={primary} secondary={secondary} unit={unit} />
        </>
      )}
    </GlassCard>
  );
}

function ProgressRing({ value, total }: { value: number; total: number }) {
  const size = 58;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total || 1, now: total ? value : 0 }}
      style={{ width: size, height: size }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E7E7EE"
          strokeWidth={stroke}
        />
        {ratio > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={PURPLE}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
    </View>
  );
}

function PreparationRow({
  title,
  subtitle,
  icon,
  value,
  total,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  value: number;
  total: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${value} of ${total} preparation items completed`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 86,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        paddingVertical: 12,
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.995 : 1 }],
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: SOFT_LAVENDER,
        }}
      >
        <Icon name={icon} size={25} color="#4E398E" />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        <Text
          style={{
            fontFamily: "DMSans_600SemiBold",
            fontSize: 14,
            lineHeight: 19,
            color: INK,
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: "DMSans_400Regular",
            fontSize: 12,
            lineHeight: 18,
            color: MUTED,
          }}
        >
          {subtitle}
        </Text>
      </View>
      <ProgressRing value={value} total={total} />
      <Text
        style={{
          minWidth: 34,
          textAlign: "center",
          fontFamily: "DMSans_600SemiBold",
          fontSize: 13,
          color: INK,
        }}
      >
        {value}/{total}
      </Text>
      <Icon name="arrow-forward-outline" size={20} color="#5D5870" />
    </Pressable>
  );
}

function InfoPanel() {
  return (
    <View
      style={{
        marginTop: 10,
        borderRadius: 18,
        padding: 15,
        backgroundColor: "#F8F4FB",
        borderWidth: 1,
        borderColor: "#EBE2F1",
        gap: 8,
      }}
    >
      <Text
        style={{
          fontFamily: "DMSans_600SemiBold",
          fontSize: 13,
          color: INK,
        }}
      >
        About these insights
      </Text>
      <Text style={[S.small, { color: MUTED, lineHeight: 18 }]}>
        These views organise recorded care information only. They do not diagnose,
        score medical risk, identify deterioration, or recommend treatment changes.
      </Text>
      <Text style={[S.small, { color: MUTED, lineHeight: 18 }]}>
        Medication counts are caregiver-entered records and do not verify adherence.
        Corrected or withdrawn medication entries remain in history but are excluded
        from current dose-entry totals.
      </Text>
      <Text style={[S.small, { color: MUTED, lineHeight: 18 }]}>
        Preparation progress counts completed information or checklist items. It is
        not a measure of clinical readiness. Discuss symptoms, readings, medicines,
        and care decisions with the healthcare team.
      </Text>
    </View>
  );
}

export function CareInsightsScreen() {
  const n = useNav();
  const { width } = useWindowDimensions();
  const { state, loading, syncError, refresh } = useCare();
  const reducedMotion = useReducedMotionPreference();
  const [headerInfoOpen, setHeaderInfoOpen] = useState(false);
  const [footerInfoOpen, setFooterInfoOpen] = useState(false);

  useLayoutEffect(() => {
    n.setOptions({ headerShown: false });
  }, [n]);

  const dailyActivity = useMemo(
    () => buildDailyActivity(state.entries, state.medicationRecords, 7),
    [state.entries, state.medicationRecords],
  );
  const systolic = useMemo(
    () => numericSeries(state.entries, "Vitals", "systolic"),
    [state.entries],
  );
  const diastolic = useMemo(
    () => numericSeries(state.entries, "Vitals", "diastolic"),
    [state.entries],
  );
  const glucose = useMemo(
    () => numericSeries(state.entries, "Blood sugar", "glucose"),
    [state.entries],
  );
  const medications = useMemo(
    () => medicationStats(state.medicationRecords),
    [state.medicationRecords],
  );
  const appointment = useMemo(
    () => appointmentPreparation(state.appointment, state.questions),
    [state.appointment, state.questions],
  );
  const timeline = useMemo(
    () => buildCareTimeline(state.entries, state.medicationRecords, 12),
    [state.entries, state.medicationRecords],
  );

  const activeDays = dailyActivity.filter((day) => day.total > 0).length;
  const sevenDayEvents = dailyActivity.reduce((sum, day) => sum + day.total, 0);
  const profileName = state.careRecipientName.trim() || "Care profile";
  const profileInitial = profileName.charAt(0).toLocaleUpperCase() || "C";
  const stackRecordedCards = width < 390;
  const appointmentSubtitle =
    state.appointment.title.trim() && state.appointment.title.trim() !== "Next appointment"
      ? state.appointment.title.trim()
      : "Prepare for visit";

  function toggleInfo(setter: React.Dispatch<React.SetStateAction<boolean>>) {
    if (!reducedMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setter((current) => !current);
  }

  if (loading && !state.hydrated) {
    return (
      <InsightsPage>
        <CareInsightsTopBar
          onBack={() => n.goBack()}
          onInfo={() => toggleInfo(setHeaderInfoOpen)}
          infoOpen={headerInfoOpen}
        />
        <View
          style={{
            minHeight: 300,
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
          }}
        >
          <ActivityIndicator color={PURPLE} />
          <Text style={[S.body, { color: MUTED }]}>Loading care insights…</Text>
        </View>
      </InsightsPage>
    );
  }

  return (
    <InsightsPage>
      <CareInsightsTopBar
        onBack={() => n.goBack()}
        onInfo={() => toggleInfo(setHeaderInfoOpen)}
        infoOpen={headerInfoOpen}
      />

      {syncError ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading care insights"
          onPress={() => void refresh()}
          style={({ pressed }) => ({
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#E9D8EF",
            backgroundColor: "#FBF6FD",
            paddingHorizontal: 14,
            paddingVertical: 11,
            flexDirection: "row",
            alignItems: "center",
            gap: 9,
            opacity: pressed ? 0.72 : 1,
          })}
        >
          <Icon name="cloud-offline-outline" size={18} color={PURPLE} />
          <Text style={[S.small, { flex: 1, color: "#6C5677" }]}>
            {state.hydrated
              ? "Couldn’t refresh. Showing the latest loaded care record."
              : "Care data couldn’t load."}
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_600SemiBold",
              fontSize: 11,
              color: PURPLE,
            }}
          >
            Retry
          </Text>
        </Pressable>
      ) : null}

      {headerInfoOpen ? <InfoPanel /> : null}

      <Entrance reducedMotion={reducedMotion}>
        <View
          style={{
            minHeight: 205,
            position: "relative",
            overflow: "hidden",
            marginHorizontal: -1,
          }}
        >
          <View
            style={{
              maxWidth: 245,
              zIndex: 2,
              paddingTop: 22,
              gap: 10,
            }}
          >
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 10,
                letterSpacing: 4.1,
                color: PURPLE,
              }}
            >
              YOUR CARE STORY
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "Lora_500Medium",
                fontSize: 39,
                lineHeight: 44,
                letterSpacing: -1.25,
                color: INK,
              }}
            >
              Every detail.{"\n"}One clear view.
            </Text>
          </View>
          <View style={{ position: "absolute", right: -72, top: -7 }}>
            <FloatingRibbon reducedMotion={reducedMotion} />
          </View>
        </View>
      </Entrance>

      <Entrance delay={45} reducedMotion={reducedMotion}>
        <View
          style={{
            minHeight: 154,
            borderRadius: 28,
            overflow: "hidden",
            position: "relative",
            shadowColor: "#5E237E",
            shadowOpacity: 0.16,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            elevation: 5,
          }}
        >
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          >
            <ProfileCardBackground />
          </View>

          <View style={{ paddingHorizontal: 21, paddingVertical: 18, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: "rgba(255,255,255,0.19)",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.48)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{
                    fontFamily: "Lora_500Medium",
                    fontSize: 30,
                    color: "#FFFFFF",
                  }}
                >
                  {profileInitial}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    fontSize: 19,
                    lineHeight: 25,
                    color: "#FFFFFF",
                  }}
                >
                  {profileName}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontFamily: "DMSans_400Regular",
                    fontSize: 12,
                    color: "#E9DFF2",
                  }}
                >
                  Active care profile
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text
                  style={{
                    fontFamily: "DMSans_400Regular",
                    fontSize: 11.5,
                    color: "#E8D8F0",
                  }}
                >
                  Past 7 days
                </Text>
              </View>
            </View>

            <View
              style={{
                height: 1,
                backgroundColor: "rgba(255,255,255,0.42)",
              }}
            />

            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                <MetricNumber
                  value={activeDays}
                  reducedMotion={reducedMotion}
                  style={{
                    fontFamily: "Lora_500Medium",
                    fontSize: 28,
                    lineHeight: 32,
                    color: "#FFFFFF",
                  }}
                />
                <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11.5, color: "#F0E7F5" }}>
                  Active days
                </Text>
              </View>
              <View style={{ width: 1, height: 41, backgroundColor: "rgba(255,255,255,0.4)" }} />
              <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
                <MetricNumber
                  value={sevenDayEvents}
                  reducedMotion={reducedMotion}
                  style={{
                    fontFamily: "Lora_500Medium",
                    fontSize: 28,
                    lineHeight: 32,
                    color: "#FFFFFF",
                  }}
                />
                <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11.5, color: "#F0E7F5" }}>
                  Care events
                </Text>
              </View>
            </View>
          </View>
        </View>
      </Entrance>

      <Entrance delay={80} reducedMotion={reducedMotion}>
        <View style={{ gap: 8 }}>
          <Text
            style={{
              fontFamily: "DMSans_600SemiBold",
              fontSize: 9.5,
              letterSpacing: 2.2,
              color: "#8B82A0",
              textTransform: "uppercase",
            }}
          >
            Current record totals
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {[
              [state.entries.length, "Observations"],
              [state.medications.length, "Medications"],
              [medications.recordedCount, "Dose entries"],
            ].map(([value, label], index) => (
              <React.Fragment key={String(label)}>
                {index > 0 ? <View style={{ width: 1, height: 43, backgroundColor: "#E3DEE8" }} /> : null}
                <View style={{ flex: 1, alignItems: "center", gap: 3 }}>
                  <MetricNumber
                    value={value}
                    reducedMotion={reducedMotion}
                    style={{
                      fontFamily: "Lora_500Medium",
                      fontSize: 25,
                      lineHeight: 31,
                      color: INK,
                    }}
                  />
                  <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11.5, color: MUTED }}>
                    {label}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>
      </Entrance>

      <Entrance delay={105} reducedMotion={reducedMotion}>
        <View style={{ gap: 10 }}>
          <SectionTitle>Last 7 days</SectionTitle>
          <View style={{ flexDirection: "row", gap: 7 }}>
            {dailyActivity.map((day, index) => {
              const selected = index === dailyActivity.length - 1;
              const hasActivity = day.total > 0;
              return (
                <View
                  key={day.dateKey}
                  accessible
                  accessibilityLabel={`${day.label} ${dayNumber(day.dateKey)}: ${day.observations} observations and ${day.medicationRecords} medication records`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    minHeight: 59,
                    borderRadius: 10,
                    borderWidth: selected ? 1.6 : 1,
                    borderColor: selected ? PURPLE : "#DDD9E3",
                    backgroundColor: selected ? "#FBF7FF" : "rgba(255,255,255,0.72)",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 2,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "DMSans_400Regular",
                      fontSize: 9.5,
                      color: selected ? PURPLE : "#676584",
                    }}
                  >
                    {day.label}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Lora_500Medium",
                      fontSize: 17,
                      lineHeight: 20,
                      color: selected ? PURPLE : INK,
                    }}
                  >
                    {dayNumber(day.dateKey)}
                  </Text>
                  {hasActivity ? (
                    <View
                      style={{
                        minWidth: 15,
                        height: 15,
                        borderRadius: 8,
                        paddingHorizontal: 3,
                        backgroundColor: "#EEE0F7",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 8, color: PURPLE }}>
                        {day.total}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
          <Text
            style={{
              textAlign: "center",
              fontFamily: "DMSans_400Regular",
              fontSize: 11.5,
              color: MUTED,
            }}
          >
            {sevenDayEvents === 0
              ? "No activity recorded yet"
              : `${sevenDayEvents} care event${sevenDayEvents === 1 ? "" : "s"} recorded in this period`}
          </Text>
        </View>
      </Entrance>

      <Entrance delay={130} reducedMotion={reducedMotion}>
        <View style={{ gap: 10 }}>
          <SectionTitle>Recorded values</SectionTitle>
          <View style={{ flexDirection: stackRecordedCards ? "column" : "row", gap: 10 }}>
            <RecordedValueCard
              title="Blood pressure"
              icon="heart-outline"
              primary={systolic}
              secondary={diastolic}
              unit="mmHg"
              onPress={() => n.navigate("Tracker", { kind: "Vitals" })}
            />
            <RecordedValueCard
              title="Blood glucose"
              icon="water-outline"
              primary={glucose}
              unit="mg/dL"
              onPress={() => n.navigate("Tracker", { kind: "Blood sugar" })}
            />
          </View>
        </View>
      </Entrance>

      <Entrance delay={155} reducedMotion={reducedMotion}>
        <View style={{ gap: 10 }}>
          <SectionTitle>Medication record</SectionTitle>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 5,
              gap: 4,
            }}
          >
            {[
              [state.medications.length, "Active"],
              [medications.recordedCount, "Doses"],
              [medications.correctedCount, "Corrected"],
            ].map(([value, label], index) => (
              <React.Fragment key={String(label)}>
                {index > 0 ? <View style={{ width: 1, height: 35, backgroundColor: "#DDD9E3" }} /> : null}
                <View style={{ flex: 1, flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 7 }}>
                  <MetricNumber
                    value={value}
                    reducedMotion={reducedMotion}
                    style={{
                      fontFamily: "Lora_500Medium",
                      fontSize: 24,
                      lineHeight: 30,
                      color: INK,
                    }}
                  />
                  <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 10.5, color: MUTED }}>
                    {label}
                  </Text>
                </View>
              </React.Fragment>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View medication history"
              onPress={() => n.navigate("Medications")}
              style={({ pressed }) => ({
                minHeight: 44,
                paddingHorizontal: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 5,
                opacity: pressed ? 0.62 : 1,
              })}
            >
              <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 11.5, color: PURPLE }}>
                View history
              </Text>
              <Icon name="arrow-forward-outline" size={17} color={PURPLE} />
            </Pressable>
          </View>
        </View>
      </Entrance>

      <Entrance delay={180} reducedMotion={reducedMotion}>
        <View style={{ gap: 10 }}>
          <SectionTitle>Getting ready</SectionTitle>
          <GlassCard style={{ paddingHorizontal: 14, paddingVertical: 0, overflow: "hidden" }}>
            <PreparationRow
              title="Next appointment"
              subtitle={appointmentSubtitle}
              icon="calendar-clear-outline"
              value={appointment.ready}
              total={appointment.total}
              onPress={() => n.navigate("Appointments")}
            />
            <View style={{ height: 1, backgroundColor: "#E5E1E9" }} />
            <PreparationRow
              title="Hospital to home"
              subtitle="Open checklist"
              icon="home-outline"
              value={state.transition.length}
              total={transitionSteps.length}
              onPress={() => n.navigate("Transition")}
            />
          </GlassCard>
        </View>
      </Entrance>

      <Entrance delay={205} reducedMotion={reducedMotion}>
        <View style={{ gap: 10 }}>
          <SectionTitle>Care timeline</SectionTitle>
          {!timeline.length ? (
            <View style={{ flexDirection: "row", gap: 14, paddingHorizontal: 6, paddingVertical: 4 }}>
              <View style={{ width: 58, alignItems: "center" }}>
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 6,
                    borderWidth: 1.5,
                    borderColor: "#D8D8E3",
                    backgroundColor: "#FFFFFF",
                  }}
                />
                <View style={{ width: 1.5, height: 43, backgroundColor: "#DEDDE6", marginTop: 5 }} />
              </View>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: "#F3EFF7",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="book-outline" size={23} color="#535078" />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 13.5, color: INK }}>
                    Your story starts here
                  </Text>
                  <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11.5, lineHeight: 17, color: MUTED }}>
                    Saved care events appear here in time order.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={{ gap: 0 }}>
              {timeline.map((item, index) => (
                <View key={item.id} style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ width: 34, alignItems: "center" }}>
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: item.corrected ? "#C76579" : PURPLE,
                        marginTop: 17,
                      }}
                    />
                    {index < timeline.length - 1 ? (
                      <View style={{ flex: 1, width: 1.3, minHeight: 54, backgroundColor: "#E2DFE7", marginTop: 4 }} />
                    ) : null}
                  </View>
                  <View
                    style={{
                      flex: 1,
                      minHeight: 70,
                      paddingVertical: 10,
                      paddingBottom: 16,
                      borderBottomWidth: index < timeline.length - 1 ? 1 : 0,
                      borderBottomColor: "#EEEAF0",
                      flexDirection: "row",
                      gap: 11,
                    }}
                  >
                    <View
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 18,
                        backgroundColor: item.corrected ? "#FFF0F3" : SOFT_LAVENDER,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon
                        name={item.kind === "medication" ? "medical-outline" : "pulse-outline"}
                        size={20}
                        color={item.corrected ? "#B24C65" : PURPLE}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 13, color: INK }}>
                        {item.title}
                      </Text>
                      <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11, lineHeight: 16, color: MUTED }}>
                        {item.subtitle}
                      </Text>
                      <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 10, lineHeight: 15, color: "#918CA0" }}>
                        {formatRecordedAt(item.recordedAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </Entrance>

      <Entrance delay={230} reducedMotion={reducedMotion}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="About these insights"
          accessibilityState={{ expanded: footerInfoOpen }}
          onPress={() => toggleInfo(setFooterInfoOpen)}
          style={({ pressed }) => ({
            minHeight: 54,
            borderTopWidth: 1,
            borderTopColor: "#E2DFE7",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Icon name="information-circle-outline" size={21} color="#4E4A72" />
          <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11.5, color: MUTED }}>
            Records, not clinical interpretation.
          </Text>
          <Icon name={footerInfoOpen ? "chevron-up-outline" : "chevron-forward-outline"} size={16} color={PURPLE} />
        </Pressable>
        {footerInfoOpen ? <InfoPanel /> : null}
      </Entrance>
    </InsightsPage>
  );
}
