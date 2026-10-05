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
  LayoutAnimation,
  Platform,
  Pressable,
  Text,
  UIManager,
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
  loadCareAnalyticsData,
  recordWeeklyAnalyticsReport,
  type CareAnalyticsData,
} from "../careAnalytics";
import {
  buildCaregiverAnalytics,
  buildWeeklyCoordinationReportHtml,
  formatHours,
  missedCheckInShiftIds,
  scheduledSharePercent,
  weekPeriod,
  weeklyAnalyticsSummary,
} from "../careAnalyticsHelpers";
import {
  loadCareTeam,
  type CareTeamMember,
  type CareTeamRoster,
} from "../careTeam";
import { printHtmlResource } from "../printing";
import { useCare } from "../store";
import { Button, C, Card, Heading, Icon, Page, S, Txt } from "../ui";
import { useNav } from "./MainScreens";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

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
      duration: 360,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
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
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function WeekCardBackground() {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 420 122"
      preserveAspectRatio="none"
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient id="weekBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#9B5DCA" />
          <Stop offset="0.55" stopColor="#7D3CAF" />
          <Stop offset="1" stopColor="#A06BCD" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="420" height="122" rx="28" fill="url(#weekBg)" />
      <Circle cx="74" cy="29" r="66" fill="#FFFFFF" opacity="0.075" />
      <Circle cx="351" cy="100" r="86" fill="#FFFFFF" opacity="0.05" />
      <Path
        d="M220 122C251 73 310 51 420 54V122H220Z"
        fill="#FFFFFF"
        opacity="0.045"
      />
    </Svg>
  );
}

function CalendarGraphic({ reducedMotion }: { reducedMotion: boolean }) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      float.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: -6,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
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
        width: 188,
        height: 178,
        transform: [{ translateY: float }, { rotate: "7deg" }],
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 220 205">
        <Defs>
          <LinearGradient id="calBody" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#A46EE4" />
            <Stop offset="0.55" stopColor="#B885ED" />
            <Stop offset="1" stopColor="#D2B0F4" />
          </LinearGradient>
          <LinearGradient id="calGlass" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.78" />
            <Stop offset="1" stopColor="#F4E9FF" stopOpacity="0.52" />
          </LinearGradient>
          <LinearGradient id="calHeart" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F4C6FF" />
            <Stop offset="1" stopColor="#A75DE2" />
          </LinearGradient>
        </Defs>

        <Ellipse cx="111" cy="183" rx="74" ry="14" fill="#8A4ABB" opacity="0.14" />

        <G transform="translate(30 27)">
          <Rect
            x="10"
            y="18"
            width="153"
            height="138"
            rx="30"
            fill="#8E4BC4"
            opacity="0.18"
          />
          <Rect
            x="0"
            y="12"
            width="160"
            height="142"
            rx="29"
            fill="url(#calBody)"
            stroke="#E5CDF8"
            strokeWidth="3"
          />
          <Rect
            x="11"
            y="49"
            width="138"
            height="92"
            rx="18"
            fill="url(#calGlass)"
          />

          <G>
            <Ellipse cx="43" cy="13" rx="13" ry="21" fill="#8C4CC0" />
            <Ellipse cx="43" cy="13" rx="7" ry="14" fill="#D6B8F2" />
            <Ellipse cx="119" cy="13" rx="13" ry="21" fill="#8C4CC0" />
            <Ellipse cx="119" cy="13" rx="7" ry="14" fill="#D6B8F2" />
          </G>

          {[0, 1, 2, 3].map((column) =>
            [0, 1, 2].map((row) => (
              <Rect
                key={column + "-" + row}
                x={22 + column * 30}
                y={62 + row * 25}
                width="19"
                height="18"
                rx="5"
                fill={column === 2 && row === 1 ? "#D1AAEE" : "#C5A1E7"}
                opacity={column === 2 && row === 1 ? 0.85 : 0.62}
              />
            )),
          )}

          <Path
            d="M87 85c-8-12-25-5-20 8 5 10 20 18 20 18s16-8 21-18c5-13-12-20-21-8Z"
            fill="url(#calHeart)"
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        </G>
      </Svg>
    </Animated.View>
  );
}

function formatWeekLabel(start: Date, end: Date) {
  const last = new Date(end);
  last.setDate(last.getDate() - 1);

  const sameMonth =
    start.getMonth() === last.getMonth() &&
    start.getFullYear() === last.getFullYear();

  if (sameMonth) {
    return (
      start.getDate() +
      " – " +
      last.getDate() +
      " " +
      last.toLocaleDateString(undefined, {
        month: "short",
        year: "numeric",
      })
    );
  }

  return (
    start.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    }) +
    " – " +
    last.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  );
}

function ProgressBar({
  value,
  max,
  label,
}: {
  value: number;
  max: number;
  label: string;
}) {
  const ratio = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;

  return (
    <View style={{ gap: 6 }}>
      <View style={S.between}>
        <Text style={[S.small, { color: "#706A86" }]}>{label}</Text>
        <Text
          style={[
            S.small,
            {
              color: "#17143D",
              fontFamily: "DMSans_600SemiBold",
            },
          ]}
        >
          {formatHours(value)}
        </Text>
      </View>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label + ": " + formatHours(value)}
        accessibilityValue={{
          min: 0,
          max: max > 0 ? max : 1,
          now: max > 0 ? value : 0,
        }}
        style={{
          height: 10,
          borderRadius: 999,
          backgroundColor: "#EAE0F2",
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: (Math.round(ratio * 100) + "%") as any,
            minWidth: ratio > 0 ? 4 : 0,
            height: 10,
            borderRadius: 999,
            backgroundColor: "#8A4AB6",
          }}
        />
      </View>
    </View>
  );
}

function CountPill({
  icon,
  count,
  label,
  background,
  color,
}: {
  icon: string;
  count: number;
  label: string;
  background: string;
  color: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 95,
        minHeight: 44,
        borderRadius: 22,
        backgroundColor: background,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
      }}
    >
      <Icon name={icon} size={17} color={color} />
      <Text
        style={{
          fontFamily: "DMSans_600SemiBold",
          fontSize: 11.5,
          color,
        }}
      >
        {count} {label}
      </Text>
    </View>
  );
}

function AccordionHeader({
  title,
  icon,
  count,
  expanded,
  onPress,
  reducedMotion,
}: {
  title: string;
  icon: string;
  count?: number;
  expanded: boolean;
  onPress: () => void;
  reducedMotion: boolean;
}) {
  const rotation = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    if (reducedMotion) {
      rotation.setValue(expanded ? 1 : 0);
      return;
    }
    Animated.timing(rotation, {
      toValue: expanded ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [expanded, reducedMotion, rotation]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded }}
      accessibilityLabel={
        title + (typeof count === "number" ? ", " + count : "")
      }
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 68,
        borderRadius: 23,
        borderWidth: 1,
        borderColor: "#E7DDEE",
        backgroundColor: "rgba(255,255,255,0.84)",
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.78 : 1,
        shadowColor: "#57306A",
        shadowOpacity: 0.035,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 5 },
        elevation: 1,
      })}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: "#F1E7FA",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={22} color="#6E2D9A" />
      </View>
      <Text
        style={{
          flex: 1,
          fontFamily: "DMSans_600SemiBold",
          fontSize: 14,
          lineHeight: 19,
          color: "#4F1E72",
        }}
      >
        {title}
      </Text>
      {typeof count === "number" && (
        <View
          style={{
            minWidth: 44,
            minHeight: 36,
            borderRadius: 18,
            paddingHorizontal: 12,
            backgroundColor: "#F0E3FA",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "DMSans_600SemiBold",
              fontSize: 13,
              color: "#6D2E98",
            }}
          >
            {count}
          </Text>
        </View>
      )}
      <Animated.View
        style={{
          transform: [
            {
              rotate: rotation.interpolate({
                inputRange: [0, 1],
                outputRange: ["0deg", "180deg"],
              }),
            },
          ],
        }}
      >
        <Icon name="chevron-down" size={20} color="#5F2187" />
      </Animated.View>
    </Pressable>
  );
}

export function CareAnalyticsScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const viewer =
    state.accessRole === "viewer" || state.accessRole === "patient";
  const reducedMotion = useReducedMotion();

  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<CareAnalyticsData | null>(null);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [missedOpen, setMissedOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);

  const period = useMemo(() => weekPeriod(weekOffset), [weekOffset]);
  const periodLabel = useMemo(
    () => formatWeekLabel(period.start, period.end),
    [period.end, period.start],
  );

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setLoading(false);
      setData(null);
      setRoster(null);
      setLoadError("");
      return;
    }

    setLoading(true);
    setMessage("");
    setLoadError("");

    try {
      const [analytics, team] = await Promise.all([
        loadCareAnalyticsData({
          careRecipientId,
          startIso: period.startIso,
          endIso: period.endIso,
        }),
        loadCareTeam(careRecipientId),
      ]);
      setData(analytics);
      setRoster(team);
    } catch (error) {
      setData(null);
      setRoster(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : "We could not load this coordination week.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, period.endIso, period.startIso]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const caregivers = useMemo(() => {
    const active =
      roster?.members.filter(
        (member) =>
          (member.role === "owner" || member.role === "caregiver") &&
          member.status !== "revoked",
      ) ?? [];

    const idsFromData = new Set<string>();
    data?.shifts.forEach((item) => idsFromData.add(item.caregiverId));
    data?.attendance.forEach((item) => idsFromData.add(item.caregiverId));
    data?.completions.forEach((item) => {
      if (item.completedBy) idsFromData.add(item.completedBy);
    });
    data?.coverageEvents.forEach((item) => {
      if (item.assignedTo) idsFromData.add(item.assignedTo);
    });

    const map = new Map(active.map((member) => [member.userId, member]));
    idsFromData.forEach((userId) => {
      if (!map.has(userId)) {
        map.set(userId, {
          userId,
          displayName: "Former caregiver",
          email: "",
          role: "caregiver",
          status: "revoked",
          invitedAt: null,
          acceptedAt: null,
          revokedAt: null,
          isCurrentUser: false,
        } as CareTeamMember);
      }
    });

    return Array.from(map.values()).filter(
      (member) =>
        member.role === "owner" ||
        member.role === "caregiver" ||
        idsFromData.has(member.userId),
    );
  }, [data, roster]);

  const caregiverMap = useMemo(
    () => new Map(caregivers.map((member) => [member.userId, member])),
    [caregivers],
  );

  const rows = useMemo(
    () =>
      data
        ? buildCaregiverAnalytics(
            data,
            caregivers.map((member) => member.userId),
            period.startIso,
            period.endIso,
          )
        : [],
    [caregivers, data, period.endIso, period.startIso],
  );

  const summary = useMemo(
    () =>
      data
        ? weeklyAnalyticsSummary(rows, data)
        : {
            scheduledMinutes: 0,
            actualMinutes: 0,
            completedTasks: 0,
            lateCheckIns: 0,
            missedCheckIns: 0,
            coverageGapEvents: 0,
          },
    [data, rows],
  );

  const barMax = useMemo(
    () =>
      Math.max(
        0,
        ...rows.flatMap((row) => [row.scheduledMinutes, row.actualMinutes]),
      ),
    [rows],
  );

  const taskMap = useMemo(
    () => new Map((data?.tasks ?? []).map((task) => [task.id, task])),
    [data],
  );

  const missedShiftIds = useMemo(
    () =>
      new Set(
        data
          ? missedCheckInShiftIds(
              data.shifts,
              data.attendance,
              period.startIso,
              period.endIso,
            )
          : [],
      ),
    [data, period.endIso, period.startIso],
  );

  const missedShifts = useMemo(
    () => data?.shifts.filter((shift) => missedShiftIds.has(shift.id)) ?? [],
    [data, missedShiftIds],
  );

  function caregiverName(userId: string) {
    const member = caregiverMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? (member.displayName || "Me") + " (me)"
      : member.displayName || "Caregiver";
  }

  function animateLayout() {
    if (!reducedMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
  }

  async function exportReport() {
    if (!careRecipientId || !data || viewer || exporting) return;

    setExporting(true);
    setMessage("");
    try {
      const html = buildWeeklyCoordinationReportHtml({
        careRecipientName: state.careRecipientName || "Care profile",
        periodLabel: period.label,
        generatedAt: new Date().toISOString(),
        rows,
        caregiverName,
        data,
        summary,
      });

      await printHtmlResource("Weekly Family Care Coordination Report", html);
      await recordWeeklyAnalyticsReport(
        careRecipientId,
        period.startIso,
        period.endIso,
      );
      setMessage("Weekly family report prepared.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not create the weekly report.",
      );
    } finally {
      setExporting(false);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="CARE COORDINATION ANALYTICS"
          title="Choose a care profile first."
        />
      </Page>
    );
  }

  const metricCards = [
    {
      label: "Scheduled care",
      value: formatHours(summary.scheduledMinutes),
      icon: "calendar-outline",
    },
    {
      label: "Recorded attendance",
      value: formatHours(summary.actualMinutes),
      icon: "time-outline",
    },
    {
      label: "Tasks completed",
      value: String(summary.completedTasks),
      icon: "checkmark-done-outline",
    },
    {
      label: "Late check-ins",
      value: String(summary.lateCheckIns),
      icon: "alarm-outline",
    },
    {
      label: "Missed check-ins",
      value: String(summary.missedCheckIns),
      icon: "warning-outline",
    },
    {
      label: "Coverage gaps",
      value: String(summary.coverageGapEvents),
      icon: "shield-outline",
    },
  ];

  return (
    <Page>
      <Entrance reducedMotion={reducedMotion}>
        <View
          style={{
            minHeight: 215,
            overflow: "hidden",
            position: "relative",
            marginHorizontal: -2,
          }}
        >
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 310,
              height: 310,
              borderRadius: 155,
              backgroundColor: "#F0E3FB",
              right: -145,
              top: -145,
              opacity: 0.62,
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              width: 220,
              height: 150,
              borderRadius: 110,
              backgroundColor: "#F9ECFA",
              right: -20,
              top: 75,
              transform: [{ rotate: "-18deg" }],
              opacity: 0.7,
            }}
          />

          <View
            style={{
              maxWidth: 245,
              gap: 7,
              paddingTop: 18,
              paddingLeft: 3,
              zIndex: 2,
            }}
          >
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 34,
                lineHeight: 39,
                letterSpacing: -0.8,
                color: "#16143D",
              }}
            >
              Your week in care
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 17,
                lineHeight: 24,
                color: "#76728D",
              }}
            >
              A clearer view, together.
            </Text>
          </View>

          <View style={{ position: "absolute", right: -4, top: 0 }}>
            <CalendarGraphic reducedMotion={reducedMotion} />
          </View>
        </View>
      </Entrance>

      <Entrance delay={50} reducedMotion={reducedMotion}>
        <View
          style={{
            minHeight: 122,
            borderRadius: 28,
            overflow: "hidden",
            position: "relative",
            shadowColor: "#6D2A96",
            shadowOpacity: 0.2,
            shadowRadius: 20,
            shadowOffset: { width: 0, height: 10 },
            elevation: 5,
          }}
        >
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          >
            <WeekCardBackground />
          </View>

          <View
            style={{
              flex: 1,
              minHeight: 122,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 13,
            }}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous reporting week"
              disabled={loading}
              onPress={() => setWeekOffset((value) => value - 1)}
              style={({ pressed }) => ({
                width: 54,
                height: 54,
                borderRadius: 27,
                backgroundColor: "rgba(255,255,255,0.16)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
                justifyContent: "center",
                opacity: loading ? 0.45 : pressed ? 0.72 : 1,
              })}
            >
              <Icon name="chevron-back" size={24} color="#FFFFFF" />
            </Pressable>

            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 20,
                  lineHeight: 25,
                  color: "#FFFFFF",
                }}
              >
                {periodLabel}
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: "#EADCF1",
                }}
              >
                {state.careRecipientName || "Care profile"} ·{" "}
                {weekOffset === 0
                  ? "This week"
                  : Math.abs(weekOffset) +
                    " week" +
                    (Math.abs(weekOffset) === 1 ? "" : "s") +
                    " ago"}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset reporting week to this week"
              disabled={loading}
              onPress={() => setWeekOffset(0)}
              style={({ pressed }) => ({
                minWidth: 112,
                minHeight: 50,
                borderRadius: 25,
                paddingHorizontal: 14,
                backgroundColor: "rgba(255,255,255,0.16)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.28)",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                opacity: loading ? 0.45 : pressed ? 0.72 : 1,
              })}
            >
              <Icon name="calendar-outline" size={19} color="#FFFFFF" />
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 12.5,
                  color: "#FFFFFF",
                }}
              >
                This week
              </Text>
            </Pressable>
          </View>
        </View>
      </Entrance>

      {viewer && (
        <Entrance delay={80} reducedMotion={reducedMotion}>
          <View
            style={{
              minHeight: 66,
              borderRadius: 22,
              backgroundColor: "#F4ECFA",
              borderWidth: 1,
              borderColor: "#E6DAEE",
              paddingHorizontal: 15,
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
            }}
          >
            <Icon name="eye-outline" size={21} color="#73359A" />
            <Text style={[S.small, { flex: 1, color: "#6E6780" }]}>
              View-only access. PDF export is available to Owner and Caregiver roles.
            </Text>
          </View>
        </Entrance>
      )}

      {Boolean(message) && (
        <Entrance delay={90} reducedMotion={reducedMotion}>
          <View
            style={{
              minHeight: 58,
              borderRadius: 20,
              backgroundColor: "#F4ECFA",
              paddingHorizontal: 15,
              justifyContent: "center",
            }}
          >
            <Text accessibilityRole="alert" style={[S.small, { color: "#5F3B70" }]}>
              {message}
            </Text>
          </View>
        </Entrance>
      )}

      {loading ? (
        <Entrance delay={100} reducedMotion={reducedMotion}>
          <View
            style={{
              minHeight: 180,
              borderRadius: 26,
              backgroundColor: "#FFFFFF",
              borderWidth: 1,
              borderColor: "#EAE3ED",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
            }}
          >
            <ActivityIndicator color="#7A3AA1" />
            <Text style={S.small}>Loading this care week…</Text>
          </View>
        </Entrance>
      ) : loadError ? (
        <Entrance delay={100} reducedMotion={reducedMotion}>
          <View
            style={{
              minHeight: 154,
              borderRadius: 26,
              backgroundColor: "#FFF5F5",
              borderWidth: 1,
              borderColor: "#F2D5DB",
              padding: 18,
              gap: 12,
            }}
          >
            <Icon name="alert-circle-outline" size={25} color="#B9425D" />
            <Text style={S.h3}>This week could not be loaded.</Text>
            <Text accessibilityRole="alert" style={S.small}>
              {loadError}
            </Text>
            <Button title="Try again" secondary onPress={() => void refresh()} />
          </View>
        </Entrance>
      ) : (
        <>
          <Entrance delay={100} reducedMotion={reducedMotion}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {metricCards.map((metric, index) => (
                <View
                  key={metric.label}
                  style={{
                    width: "48.6%",
                    minHeight: 112,
                    borderRadius: 24,
                    borderWidth: 1,
                    borderColor: "rgba(230,220,238,0.95)",
                    backgroundColor:
                      index % 2 === 0
                        ? "rgba(255,255,255,0.86)"
                        : "rgba(250,247,253,0.86)",
                    padding: 15,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    shadowColor: "#5C316A",
                    shadowOpacity: 0.035,
                    shadowRadius: 14,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: 1,
                  }}
                >
                  <View
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: "#F3E8FB",
                      borderWidth: 1,
                      borderColor: "#FFFFFF",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name={metric.icon} size={23} color="#742BA0" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontFamily: "DMSans_700Bold",
                        fontSize: 22,
                        lineHeight: 27,
                        color: "#17143D",
                      }}
                    >
                      {metric.value}
                    </Text>
                    <Text
                      style={{
                        fontFamily: "DMSans_400Regular",
                        fontSize: 11.5,
                        lineHeight: 16,
                        color: "#77728A",
                      }}
                    >
                      {metric.label}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Entrance>

          <Entrance delay={140} reducedMotion={reducedMotion}>
            <View style={{ gap: 13 }}>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 25,
                  lineHeight: 31,
                  color: "#17143D",
                }}
              >
                Caregiver workload
              </Text>

              {rows.length ? (
                rows.map((row) => {
                  const share = scheduledSharePercent(row, rows);
                  const name = caregiverName(row.caregiverId);
                  const initial =
                    name.replace(/\s*\(me\)\s*$/, "").trim().charAt(0).toUpperCase() ||
                    "C";
                  const totalScheduled = rows.reduce(
                    (total, item) => total + item.scheduledMinutes,
                    0,
                  );

                  return (
                    <View
                      key={row.caregiverId}
                      style={{
                        borderRadius: 26,
                        borderWidth: 1,
                        borderColor: "#E7DDEE",
                        backgroundColor: "rgba(255,255,255,0.9)",
                        padding: 18,
                        gap: 15,
                        shadowColor: "#5A2E69",
                        shadowOpacity: 0.045,
                        shadowRadius: 16,
                        shadowOffset: { width: 0, height: 7 },
                        elevation: 2,
                      }}
                    >
                      <View style={S.between}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 12,
                            flex: 1,
                          }}
                        >
                          <View
                            style={{
                              width: 52,
                              height: 52,
                              borderRadius: 26,
                              backgroundColor: "#8743B6",
                              alignItems: "center",
                              justifyContent: "center",
                              shadowColor: "#7B3EAA",
                              shadowOpacity: 0.18,
                              shadowRadius: 9,
                              shadowOffset: { width: 0, height: 5 },
                              elevation: 3,
                            }}
                          >
                            <Text
                              style={{
                                fontFamily: "DMSans_600SemiBold",
                                fontSize: 21,
                                color: "#FFFFFF",
                              }}
                            >
                              {initial}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              numberOfLines={2}
                              style={{
                                fontFamily: "DMSans_700Bold",
                                fontSize: 18,
                                lineHeight: 22,
                                color: "#17143D",
                              }}
                            >
                              {name}
                            </Text>
                            <Text style={S.small}>
                              {totalScheduled > 0
                                ? share + "% of scheduled care"
                                : "No scheduled care this week"}
                            </Text>
                          </View>
                        </View>
                        <View
                          style={{
                            minHeight: 38,
                            borderRadius: 19,
                            paddingHorizontal: 13,
                            backgroundColor: "#F2E8FA",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "DMSans_600SemiBold",
                              fontSize: 12,
                              color: "#6A2A91",
                            }}
                          >
                            {row.completedTasks} task
                            {row.completedTasks === 1 ? "" : "s"}
                          </Text>
                        </View>
                      </View>

                      <ProgressBar
                        value={row.scheduledMinutes}
                        max={barMax}
                        label="Scheduled"
                      />
                      <ProgressBar
                        value={row.actualMinutes}
                        max={barMax}
                        label="Recorded"
                      />

                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <CountPill
                          icon="alarm-outline"
                          count={row.lateCheckIns}
                          label="late"
                          background="#F3E7FB"
                          color="#6E2D98"
                        />
                        <CountPill
                          icon="warning-outline"
                          count={row.missedCheckIns}
                          label="missed"
                          background="#FCEAF2"
                          color="#7B2E77"
                        />
                        <CountPill
                          icon="shield-outline"
                          count={row.coverageGapEvents}
                          label="gaps"
                          background="#EEF0FF"
                          color="#464BB0"
                        />
                      </View>

                      {row.lateMinutes > 0 && (
                        <Text style={S.small}>
                          {row.lateMinutes} min recorded late this week.
                        </Text>
                      )}
                    </View>
                  );
                })
              ) : (
                <View
                  style={{
                    minHeight: 112,
                    borderRadius: 24,
                    backgroundColor: "#FFFFFF",
                    borderWidth: 1,
                    borderColor: "#E8E2EC",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 18,
                    gap: 8,
                  }}
                >
                  <Icon name="people-outline" size={25} color="#7A3A9E" />
                  <Text style={[S.small, { textAlign: "center" }]}>
                    No caregiver workload activity is recorded for this week.
                  </Text>
                </View>
              )}
            </View>
          </Entrance>

          <Entrance delay={180} reducedMotion={reducedMotion}>
            <View style={{ gap: 10 }}>
              <AccordionHeader
                title="Missed check-in history"
                icon="warning-outline"
                count={missedShifts.length}
                expanded={missedOpen}
                reducedMotion={reducedMotion}
                onPress={() => {
                  animateLayout();
                  setMissedOpen((value) => !value);
                }}
              />
              {missedOpen && (
                <View style={{ gap: 10 }}>
                  {missedShifts.length ? (
                    missedShifts.map((shift) => (
                      <View
                        key={shift.id}
                        style={{
                          borderRadius: 22,
                          backgroundColor: "#FFF8FA",
                          borderWidth: 1,
                          borderColor: "#EECFD7",
                          padding: 15,
                          gap: 5,
                        }}
                      >
                        <Text style={S.h3}>{caregiverName(shift.caregiverId)}</Text>
                        <Text style={S.small}>
                          {new Date(shift.startsAt).toLocaleString()} →{" "}
                          {new Date(shift.endsAt).toLocaleString()}
                        </Text>
                        <Text style={S.small}>
                          No EnVizion “I’m here” check-in was recorded after the
                          scheduled start window.
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View
                      style={{
                        borderRadius: 22,
                        backgroundColor: "#F2F8F5",
                        padding: 15,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <Icon name="checkmark-circle-outline" color="#2D8B69" />
                      <Text style={[S.small, { flex: 1 }]}>
                        No missed check-ins detected for this week.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <AccordionHeader
                title="Coverage gap history"
                icon="shield-outline"
                count={data?.coverageEvents.length ?? 0}
                expanded={gapsOpen}
                reducedMotion={reducedMotion}
                onPress={() => {
                  animateLayout();
                  setGapsOpen((value) => !value);
                }}
              />
              {gapsOpen && (
                <View style={{ gap: 10 }}>
                  {data?.coverageEvents.length ? (
                    data.coverageEvents.map((event) => (
                      <View
                        key={event.id}
                        style={{
                          borderRadius: 22,
                          backgroundColor: "#FBF8FE",
                          borderWidth: 1,
                          borderColor: "#E5DBEC",
                          padding: 15,
                          gap: 5,
                        }}
                      >
                        <Text style={S.h3}>
                          {taskMap.get(event.taskId)?.title || "Care task"}
                        </Text>
                        <Text style={S.small}>
                          Due {new Date(event.taskDueAt).toLocaleString()}
                          {event.assignedTo
                            ? " · " + caregiverName(event.assignedTo)
                            : " · Shared responsibility"}
                        </Text>
                        <Text style={S.small}>
                          Gap detected {new Date(event.detectedAt).toLocaleString()}.
                        </Text>
                      </View>
                    ))
                  ) : (
                    <View
                      style={{
                        borderRadius: 22,
                        backgroundColor: "#F6F4FA",
                        padding: 15,
                      }}
                    >
                      <Text style={S.small}>
                        No uncovered-task events were recorded for this week.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          </Entrance>

          <Entrance delay={220} reducedMotion={reducedMotion}>
            <View
              style={{
                minHeight: 164,
                borderRadius: 27,
                borderWidth: 1,
                borderColor: "#E2D8E9",
                backgroundColor: "rgba(255,255,255,0.88)",
                padding: 17,
                gap: 14,
                overflow: "hidden",
                shadowColor: "#583267",
                shadowOpacity: 0.045,
                shadowRadius: 15,
                shadowOffset: { width: 0, height: 6 },
                elevation: 2,
              }}
            >
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  right: -18,
                  bottom: -16,
                  width: 126,
                  height: 126,
                  borderRadius: 34,
                  backgroundColor: "#F1E8FA",
                  transform: [{ rotate: "13deg" }],
                  opacity: 0.82,
                }}
              />

              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: "#F2E7FA",
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1,
                    borderColor: "#FFFFFF",
                  }}
                >
                  <Icon name="document-text-outline" size={26} color="#6E2C98" />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={{
                      fontFamily: "DMSans_700Bold",
                      fontSize: 17,
                      color: "#17143D",
                    }}
                  >
                    Weekly family report
                  </Text>
                  <Text style={S.small}>Team totals, workload & coverage.</Text>
                </View>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Create PDF report for selected week"
                accessibilityState={{ disabled: viewer || exporting }}
                disabled={viewer || exporting}
                onPress={() => void exportReport()}
                style={({ pressed }) => ({
                  minHeight: 54,
                  borderRadius: 27,
                  backgroundColor: "#7D37A2",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  opacity: viewer || exporting ? 0.45 : pressed ? 0.8 : 1,
                })}
              >
                <Icon name="share-outline" size={20} color="#FFFFFF" />
                <Text
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    fontSize: 14,
                    color: "#FFFFFF",
                  }}
                >
                  {exporting ? "Creating PDF…" : "Create PDF report"}
                </Text>
              </Pressable>
            </View>
          </Entrance>

          <Entrance delay={250} reducedMotion={reducedMotion}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open today's shift board"
              onPress={() => n.navigate("CareShiftBoard")}
              style={({ pressed }) => ({
                minHeight: 62,
                borderRadius: 31,
                borderWidth: 1.2,
                borderColor: "#8B54B0",
                backgroundColor: "rgba(255,255,255,0.88)",
                paddingHorizontal: 18,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                opacity: pressed ? 0.78 : 1,
              })}
            >
              <Icon name="people-outline" size={20} color="#61218B" />
              <Text
                style={{
                  flex: 1,
                  textAlign: "center",
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 14,
                  color: "#61218B",
                }}
              >
                Today’s shift board
              </Text>
              <Icon name="chevron-forward" size={18} color="#61218B" />
            </Pressable>
          </Entrance>

          <Entrance delay={280} reducedMotion={reducedMotion}>
            <View style={{ gap: 10 }}>
              <AccordionHeader
                title="For coordination, not judgment."
                icon="information-circle-outline"
                expanded={infoOpen}
                reducedMotion={reducedMotion}
                onPress={() => {
                  animateLayout();
                  setInfoOpen((value) => !value);
                }}
              />
              {infoOpen && (
                <View
                  style={{
                    borderRadius: 22,
                    backgroundColor: "#F8F4FB",
                    borderWidth: 1,
                    borderColor: "#E7DDEE",
                    padding: 16,
                    gap: 9,
                  }}
                >
                  <Text style={S.small}>
                    These numbers summarize what EnVizion recorded. They are for
                    family coordination, not caregiver ranking or performance scoring.
                  </Text>
                  <Text style={S.small}>
                    Attendance reflects app check-ins only. It is not verified
                    proof of physical presence, payroll, or formal timekeeping.
                  </Text>
                  <Text style={S.small}>
                    Missing check-ins, connectivity problems, late data entry,
                    cancelled family plans, or care delivered outside the app can
                    change the real-world picture.
                  </Text>
                  <Text style={S.small}>
                    Coverage-gap history begins when EnVizion event recording
                    starts, so older gaps may not appear here.
                  </Text>
                </View>
              )}
            </View>
          </Entrance>
        </>
      )}
    </Page>
  );
}
