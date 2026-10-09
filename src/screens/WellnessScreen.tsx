import { themeBackground, themeBorder, themeShadow, themeTint } from "../themeColors";
import { themeForeground } from "../themeColors";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import type { RootStack } from "../navigation";
import { SpiritualLandscapeArt } from "../components/SpiritualLandscapeArt";
import {
  QUIET_MOMENT_MS,
  formatQuietMomentClock,
  quietMomentElapsedMs,
  quietMomentProgress,
  quietMomentRemainingSeconds,
} from "../spiritualWellnessHelpers";
import { Icon, Page, S } from "../ui";

type WellnessNavigation = NativeStackNavigationProp<RootStack>;
type TimerState = "idle" | "running" | "complete";

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
      duration: 420,
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

function QuietTimerRing({
  elapsedMs,
  timerState,
}: {
  elapsedMs: number;
  timerState: TimerState;
}) {
  const progress = quietMomentProgress(elapsedMs);
  const remainingSeconds = quietMomentRemainingSeconds(elapsedMs);
  const radius = 67;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const angle = -Math.PI / 2 + progress * Math.PI * 2;
  const dotX = 80 + radius * Math.cos(angle);
  const dotY = 80 + radius * Math.sin(angle);

  return (
    <View
      accessible
      accessibilityLabel={
        timerState === "complete"
          ? "Quiet moment complete"
          : `${formatQuietMomentClock(remainingSeconds)} remaining in quiet moment`
      }
      style={{ width: 160, height: 160, alignItems: "center", justifyContent: "center" }}
    >
      <Svg
        width="160"
        height="160"
        viewBox="0 0 160 160"
        style={{ position: "absolute" }}
        accessibilityElementsHidden
      >
        <Defs>
          <LinearGradient id="quietRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={themeTint("#DCC5EB")} />
            <Stop offset="1" stopColor={themeTint("#B986D7")} />
          </LinearGradient>
        </Defs>
        <Circle
          cx="80"
          cy="80"
          r={radius}
          fill={themeTint("#FFFFFF")}
          fillOpacity="0.45"
          stroke={themeTint("#E4D5EE")}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx="80"
          cy="80"
          r={radius}
          fill="none"
          stroke="url(#quietRing)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          transform="rotate(-90 80 80)"
        />
        <Circle
          cx={dotX}
          cy={dotY}
          r="5.5"
          fill={themeTint("#8D43B6")}
        />
      </Svg>

      <Text
        style={{
          fontFamily: "Lora_500Medium",
          fontSize: 37,
          lineHeight: 44,
          color: themeForeground("#12113C"),
        }}
      >
        {formatQuietMomentClock(remainingSeconds)}
      </Text>
      <Text
        style={{
          marginTop: 4,
          fontFamily: "DMSans_600SemiBold",
          fontSize: 9.5,
          lineHeight: 14,
          letterSpacing: 2.8,
          color: themeForeground("#76708C"),
          textTransform: "uppercase",
        }}
      >
        A quiet minute
      </Text>
    </View>
  );
}

function GradientButton({
  title,
  icon,
  disabled = false,
  onPress,
}: {
  title: string;
  icon: string;
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
        minHeight: 58,
        borderRadius: 29,
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: disabled ? 0.43 : pressed ? 0.82 : 1,
        transform: [{ scale: pressed && !disabled ? 0.988 : 1 }],
        shadowColor: themeShadow("#6E2E96"),
        shadowOpacity: disabled ? 0 : 0.15,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 7 },
        elevation: disabled ? 0 : 3,
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
          <LinearGradient id="quietButton" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={disabled ? "#E8DFF0" : "#8F46BA"} />
            <Stop offset="0.5" stopColor={disabled ? "#E8DFF0" : "#A04CCB"} />
            <Stop offset="1" stopColor={disabled ? "#E8DFF0" : "#7E38A8"} />
          </LinearGradient>
        </Defs>
        <Circle cx="220" cy="30" r="270" fill="url(#quietButton)" />
      </Svg>
      <Icon
        name={icon}
        size={21}
        color={disabled ? "#9978AE" : "#FFFFFF"}
      />
      <Text
        style={{
          fontFamily: "DMSans_600SemiBold",
          fontSize: 15,
          color: disabled ? "#9978AE" : "#FFFFFF",
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}

export function WellnessScreen() {
  const navigation = useNavigation<WellnessNavigation>();
  const reducedMotion = useReducedMotionPreference();

  const [timerState, setTimerState] = useState<TimerState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  // Privacy boundary: reflection text intentionally remains component state only.
  const [reflection, setReflection] = useState("");
  const [keptForVisit, setKeptForVisit] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const runningRef = useRef(false);

  const clearTimerResources = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    startedAtRef.current = null;
    runningRef.current = false;
  }, []);

  const endQuietMoment = useCallback(() => {
    clearTimerResources();
    setElapsedMs(0);
    setTimerState("idle");
  }, [clearTimerResources]);

  const startQuietMoment = useCallback(() => {
    if (runningRef.current) return;

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const startedAt = Date.now();
    startedAtRef.current = startedAt;
    runningRef.current = true;
    setElapsedMs(0);
    setTimerState("running");

    const intervalMs = reducedMotion ? 500 : 100;
    intervalRef.current = setInterval(() => {
      const currentStart = startedAtRef.current;
      if (currentStart === null) return;

      const elapsed = quietMomentElapsedMs(currentStart, Date.now());
      setElapsedMs(elapsed);

      if (elapsed >= QUIET_MOMENT_MS) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        startedAtRef.current = null;
        runningRef.current = false;
        setElapsedMs(QUIET_MOMENT_MS);
        setTimerState("complete");
      }
    }, intervalMs);
  }, [reducedMotion]);

  useEffect(() => {
    return () => clearTimerResources();
  }, [clearTimerResources]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        clearTimerResources();
        setElapsedMs(0);
        setTimerState("idle");
        setReflection("");
        setKeptForVisit(false);
      };
    }, [clearTimerResources]),
  );

  const timerButtonTitle =
    timerState === "running"
      ? "End quiet moment"
      : timerState === "complete"
        ? "Begin another quiet moment"
        : "Begin quiet moment";

  return (
    <Page>
      <View
        style={{
          marginHorizontal: -20,
          marginTop: -18,
          marginBottom: -42,
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 46,
          gap: 20,
          overflow: "hidden",
          backgroundColor: themeBackground("#FFFDFC"),
        }}
      >
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
              onPress={() => navigation.goBack()}
              style={({ pressed }) => ({
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: themeBackground("#F8F2FA"),
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.68 : 1,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              })}
            >
              <Icon name="chevron-back" size={27} color={themeForeground("#713198")} />
            </Pressable>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 19,
                lineHeight: 24,
                color: themeForeground("#713198"),
              }}
            >
              Spiritual wellness
            </Text>
          </View>
        </Entrance>

        <Entrance delay={45} reducedMotion={reducedMotion}>
          <View style={{ gap: 7, paddingHorizontal: 4 }}>
            <Text
              accessibilityRole="header"
              style={{
                maxWidth: 385,
                fontFamily: "Lora_500Medium",
                fontSize: 40,
                lineHeight: 47,
                letterSpacing: -0.9,
                color: themeForeground("#12113C"),
              }}
            >
              A quiet moment,{"\n"}just for you.
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 18,
                lineHeight: 25,
                color: themeForeground("#77718A"),
              }}
            >
              Space to pause. Permission to rest.
            </Text>
          </View>
        </Entrance>

        <Entrance delay={80} reducedMotion={reducedMotion}>
          <View
            style={{
              marginHorizontal: -20,
              height: 305,
              overflow: "hidden",
            }}
          >
            <SpiritualLandscapeArt height={305} />
          </View>
        </Entrance>

        <Entrance delay={115} reducedMotion={reducedMotion}>
          <View
            style={{
              marginTop: -108,
              marginHorizontal: 14,
              borderRadius: 32,
              borderWidth: 1.5,
              borderColor: themeBorder("#FFFFFF"),
              backgroundColor: themeBackground("#FFFFFFE8"),
              paddingHorizontal: 20,
              paddingTop: 23,
              paddingBottom: 20,
              alignItems: "center",
              gap: 13,
              shadowColor: themeShadow("#4B335A"),
              shadowOpacity: 0.09,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 5,
            }}
          >
            <Icon name="sparkles-outline" size={28} color={themeForeground("#7A329F")} />
            <Text
              style={{
                fontFamily: "Lora_500Medium",
                fontSize: 27,
                lineHeight: 34,
                color: themeForeground("#15123F"),
                textAlign: "center",
              }}
            >
              {timerState === "complete"
                ? "A quiet minute, complete."
                : "You can pause here."}
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 15.5,
                lineHeight: 22,
                color: themeForeground("#817A92"),
                textAlign: "center",
              }}
            >
              Breathe naturally. Nothing to achieve.
            </Text>

            <QuietTimerRing elapsedMs={elapsedMs} timerState={timerState} />

            <View style={{ width: "100%" }}>
              <GradientButton
                title={timerButtonTitle}
                icon={timerState === "running" ? "stop" : "play"}
                onPress={() => {
                  if (runningRef.current) {
                    endQuietMoment();
                  } else {
                    startQuietMoment();
                  }
                }}
              />
            </View>

            {timerState === "complete" && (
              <Text
                accessibilityLiveRegion="polite"
                style={{
                  fontFamily: "DMSans_500Medium",
                  fontSize: 12.5,
                  lineHeight: 18,
                  color: themeForeground("#6F4B83"),
                  textAlign: "center",
                }}
              >
                Your minute is complete. Stay here as long as you like.
              </Text>
            )}
          </View>
        </Entrance>

        <Entrance delay={150} reducedMotion={reducedMotion}>
          <View
            style={{
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 15,
              paddingTop: 4,
            }}
          >
            <Text
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 10,
                lineHeight: 15,
                letterSpacing: 3.1,
                color: themeForeground("#7A329F"),
                textTransform: "uppercase",
              }}
            >
              A moment of faith
            </Text>
            <Text
              style={{
                fontFamily: "Lora_500Medium",
                fontSize: 24,
                lineHeight: 34,
                color: themeForeground("#12113C"),
                textAlign: "center",
              }}
            >
              “God is our refuge and strength, a very present help in trouble.”
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 10,
                lineHeight: 16,
                letterSpacing: 2.4,
                color: themeForeground("#77718A"),
                textTransform: "uppercase",
                textAlign: "center",
              }}
            >
              Psalm 46:1 · King James Version
            </Text>
          </View>
        </Entrance>

        <Entrance delay={185} reducedMotion={reducedMotion}>
          <View style={{ gap: 12, paddingHorizontal: 3 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "Lora_500Medium",
                fontSize: 27,
                lineHeight: 34,
                color: themeForeground("#12113C"),
              }}
            >
              Your reflection
            </Text>
            <Text
              style={{
                marginTop: -5,
                fontFamily: "DMSans_500Medium",
                fontSize: 15.5,
                lineHeight: 22,
                color: themeForeground("#252047"),
              }}
            >
              What is one thing you can set down today?
            </Text>

            <TextInput
              accessibilityLabel="Reflection for this visit"
              accessibilityHint="This reflection stays only on this screen during this visit."
              value={reflection}
              onChangeText={(value) => {
                setReflection(value);
                setKeptForVisit(false);
              }}
              multiline
              placeholder="Write here..."
              placeholderTextColor={themeForeground("#9A93A8")}
              textAlignVertical="top"
              style={{
                minHeight: 118,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: themeBorder("#D9CEE1"),
                backgroundColor: themeBackground("#FFFFFF"),
                paddingHorizontal: 16,
                paddingVertical: 15,
                fontFamily: "DMSans_400Regular",
                fontSize: 16,
                lineHeight: 23,
                color: themeForeground("#211D48"),
                shadowColor: themeShadow("#4A3155"),
                shadowOpacity: 0.035,
                shadowRadius: 10,
                shadowOffset: { width: 0, height: 5 },
                elevation: 1,
              }}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Keep reflection for this visit"
              accessibilityState={{ disabled: !reflection.trim() }}
              disabled={!reflection.trim()}
              onPress={() => setKeptForVisit(true)}
              style={({ pressed }) => ({
                minHeight: 56,
                borderRadius: 28,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: reflection.trim() ? "#F0E8F6" : "#F5F0F7",
                borderWidth: 1,
                borderColor: themeBorder("#F3ECF6"),
                opacity: !reflection.trim() ? 0.5 : pressed ? 0.74 : 1,
                transform: [{ scale: pressed && reflection.trim() ? 0.99 : 1 }],
              })}
            >
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 15,
                  color: themeForeground("#8750A7"),
                }}
              >
                Keep for this visit
              </Text>
            </Pressable>

            {keptForVisit && (
              <View
                accessibilityLiveRegion="polite"
                style={{
                  minHeight: 44,
                  borderRadius: 18,
                  backgroundColor: themeBackground("#F8F2FA"),
                  paddingHorizontal: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Icon name="checkmark-circle-outline" size={18} color={themeForeground("#775090")} />
                <Text
                  style={{
                    fontFamily: "DMSans_500Medium",
                    fontSize: 12.5,
                    color: themeForeground("#6E627B"),
                  }}
                >
                  Kept on this screen for this visit only.
                </Text>
              </View>
            )}
          </View>
        </Entrance>

        <Entrance delay={215} reducedMotion={reducedMotion}>
          <View
            style={{
              paddingHorizontal: 18,
              flexDirection: "row",
              alignItems: "flex-start",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <Icon name="lock-closed-outline" size={22} color={themeForeground("#777486")} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 11.5,
                  lineHeight: 17,
                  color: themeForeground("#777486"),
                  textAlign: "center",
                }}
              >
                Only on this screen during this visit. Nothing is sent or stored.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 11.5,
                  lineHeight: 17,
                  color: themeForeground("#777486"),
                  textAlign: "center",
                }}
              >
                Spiritual practices are optional.
              </Text>
            </View>
          </View>
        </Entrance>
      </View>
    </Page>
  );
}
