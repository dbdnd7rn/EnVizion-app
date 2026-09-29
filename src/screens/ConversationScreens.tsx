import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from "react-native-svg";
import { useCare } from "../store";
import {
  createSupportRequest,
  loadLatestSupportRequest,
  sendSupportMessage,
  type SupportMessageRecord,
  type SupportRequestRecord,
} from "../backend";
import {
  makeMessage,
  previewReply,
  starters,
  type Message,
  type SupportRequest,
} from "../assistant/model";
import {
  Button,
  C,
  Card,
  Fade,
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
import { useNav } from "./MainScreens";

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: C.deep,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: C.lavender,
  },
  bubble: {
    maxWidth: "94%",
    gap: 9,
    padding: 17,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: C.deep,
    borderBottomRightRadius: 6,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: C.white,
    borderBottomLeftRadius: 6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DED5E4",
    backgroundColor: C.white,
  },
  composer: {
    padding: 16,
    paddingBottom: 14,
    gap: 8,
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: C.white,
  },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },

  assistantTopbar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
  },
  assistantBack: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F5FB",
  },
  assistantTopTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    lineHeight: 28,
    color: "#12143D",
  },
  assistantTopSub: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    lineHeight: 18,
    color: "#8A879A",
  },
  assistantGuideBadge: {
    marginLeft: "auto",
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: "#F1EAFE",
  },
  assistantGuideText: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: "#6D32A3",
  },
  assistantHero: {
    marginHorizontal: 20,
    borderRadius: 30,
    minHeight: 320,
    padding: 22,
    overflow: "hidden",
    backgroundColor: "#F0EEFF",
    borderWidth: 1,
    borderColor: "#ECE8FF",
  },
  assistantHeroGlowOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -72,
    top: -76,
    backgroundColor: "#E4E8FF",
    opacity: 0.9,
  },
  assistantHeroGlowTwo: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    right: -4,
    bottom: -128,
    backgroundColor: "#E9DEFB",
    opacity: 0.78,
  },
  assistantGreeting: {
    fontFamily: "DMSans_700Bold",
    fontSize: 14,
    color: "#713BA0",
    marginBottom: 10,
  },
  assistantHeroTitle: {
    width: "60%",
    fontFamily: "DMSans_700Bold",
    fontSize: 31,
    lineHeight: 37,
    letterSpacing: -0.5,
    color: "#10133F",
  },
  assistantHeroBody: {
    width: "58%",
    marginTop: 10,
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    lineHeight: 21,
    color: "#777589",
  },
  assistantRobot: {
    position: "absolute",
    right: -1,
    top: 39,
    width: 178,
    height: 198,
    alignItems: "center",
    justifyContent: "center",
  },
  assistantRobotAura: {
    position: "absolute",
    width: 156,
    height: 156,
    borderRadius: 78,
    top: 13,
    right: 6,
    backgroundColor: "#DCE2FF",
  },
  assistantRobotWaveArm: {
    position: "absolute",
    left: 2,
    top: 92,
    width: 66,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 4,
  },
  assistantHeroPills: {
    marginTop: 26,
    flexDirection: "row",
    gap: 8,
  },
  assistantHeroPill: {
    flex: 1,
    minHeight: 62,
    paddingHorizontal: 9,
    paddingVertical: 9,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.95)",
  },
  assistantHeroPillLabel: {
    marginTop: 4,
    textAlign: "center",
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    lineHeight: 13,
    color: "#24264B",
  },
  assistantQuickGrid: {
    marginTop: 18,
    paddingHorizontal: 20,
    flexDirection: "row",
    gap: 10,
  },
  assistantQuickCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 22,
    paddingHorizontal: 9,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0EBF2",
  },
  assistantQuickIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.68)",
  },
  assistantQuickLabel: {
    marginTop: 9,
    textAlign: "center",
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    lineHeight: 14,
    color: "#191B45",
  },
  assistantSectionHeader: {
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  assistantSectionTitle: {
    fontFamily: "DMSans_700Bold",
    fontSize: 21,
    color: "#14163F",
  },
  assistantViewAll: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 12,
    color: "#713BA0",
  },
  assistantQuestionList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  assistantQuestionCard: {
    minHeight: 82,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E9E4EE",
  },
  assistantQuestionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1EBFC",
  },
  assistantQuestionTitle: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 14,
    lineHeight: 18,
    color: "#171943",
  },
  assistantQuestionSub: {
    marginTop: 3,
    fontFamily: "DMSans_400Regular",
    fontSize: 11,
    lineHeight: 15,
    color: "#9A96A7",
  },
  assistantResourceGrid: {
    marginTop: 26,
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: "row",
    gap: 10,
  },
  assistantResourceCard: {
    flex: 1,
    minHeight: 112,
    borderRadius: 22,
    paddingHorizontal: 8,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#F0EBF2",
  },
  assistantResourceLabel: {
    marginTop: 8,
    textAlign: "center",
    fontFamily: "DMSans_600SemiBold",
    fontSize: 10,
    lineHeight: 14,
    color: "#292B4D",
  },
  assistantComposerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F3EEF4",
  },
  assistantComposerShell: {
    minHeight: 60,
    borderRadius: 30,
    paddingLeft: 10,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E6DFEB",
    shadowColor: "#2E2135",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  assistantAttach: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F6F2FB",
  },
  assistantSend: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#713BA0",
  },
  assistantDisclaimer: {
    marginTop: 8,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
  },
  assistantDisclaimerText: {
    flex: 1,
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    lineHeight: 14,
    color: "#9A96A7",
  },
  assistantChatIntro: {
    marginBottom: 4,
    padding: 15,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F3EFFF",
    borderWidth: 1,
    borderColor: "#E8E1F4",
  },
  assistantChatOrb: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#713BA0",
  },
});

function Badge({ text }: { text: string }) {
  return (
    <View style={styles.badge}>
      <Text
        style={[S.small, { fontFamily: "DMSans_600SemiBold", color: C.deep }]}
      >
        {text}
      </Text>
    </View>
  );
}

function Bubble({ message }: { message: Message }) {
  const n = useNav();
  const own = message.role === "user";
  return (
    <View
      style={[
        styles.bubble,
        {
          alignSelf: own ? "flex-end" : "flex-start",
          backgroundColor: own ? C.deep : C.white,
          borderBottomRightRadius: own ? 6 : 20,
          borderBottomLeftRadius: own ? 20 : 6,
        },
      ]}
    >
      <Text style={[S.eyebrow, { color: own ? "#E0CBE8" : C.purple }]}>
        {own
          ? "YOU"
          : message.role === "staff"
            ? "ENVIZION SUPPORT"
            : "ENVIZION ASSISTANT"}
      </Text>
      <Text
        selectable
        style={[
          S.body,
          { color: own ? C.white : C.ink, fontSize: 15, lineHeight: 24 },
        ]}
      >
        {message.text}
      </Text>
      {message.resource && (
        <Button
          title={message.resource.label}
          secondary
          icon="arrow-forward-outline"
          onPress={() => n.navigate(message.resource!.destination)}
        />
      )}
      {message.suggestTeam && (
        <Button
          title="Talk to our team"
          secondary
          icon="people-outline"
          onPress={() => n.navigate("Handoff")}
        />
      )}
      <Text style={[S.small, { color: own ? "#DDCAE5" : C.muted }]}>
        {new Date(message.at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}

function Composer({
  onSend,
  disabled = false,
  label = "Your message",
  placeholder = "Ask anything about caregiving…",
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  label?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const ready = Boolean(text.trim()) && !disabled;

  return (
    <View style={styles.assistantComposerWrap}>
      <View style={styles.assistantComposerShell}>
        <View style={styles.assistantAttach}>
          <Icon name="attach-outline" color="#6D6590" size={21} />
        </View>
        <TextInput
          value={text}
          onChangeText={setText}
          accessibilityLabel={label}
          placeholder={placeholder}
          placeholderTextColor="#9D98AA"
          multiline
          maxLength={1200}
          editable={!disabled}
          style={{
            flex: 1,
            minHeight: 48,
            maxHeight: 110,
            paddingVertical: 13,
            fontFamily: "DMSans_400Regular",
            fontSize: 14,
            lineHeight: 20,
            color: "#171943",
            textAlignVertical: "center",
          }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send message"
          disabled={!ready}
          onPress={() => {
            const value = text.trim();
            if (!value || disabled) return;
            onSend(value);
            setText("");
          }}
          style={({ pressed }) => [
            styles.assistantSend,
            { opacity: !ready ? 0.4 : pressed ? 0.76 : 1 },
          ]}
        >
          <Icon name="paper-plane-outline" color="#FFFFFF" size={22} />
        </Pressable>
      </View>
      <View style={styles.assistantDisclaimer}>
        <Icon name="information-circle-outline" color="#9A96A7" size={15} />
        <Text style={styles.assistantDisclaimerText}>
          AI provides general guidance and is not a substitute for professional
          medical advice. For emergencies, use your local emergency services.
        </Text>
      </View>
    </View>
  );
}

function AssistantFeaturePill({
  icon,
  label,
  tint,
  active = false,
  onPress,
}: {
  icon: string;
  label: string;
  tint: string;
  active?: boolean;
  onPress?: () => void;
}) {
  const body = (
    <View
      style={[
        styles.assistantHeroPill,
        active && { borderColor: tint, backgroundColor: "#FFFFFF" },
      ]}
    >
      <Icon name={icon} color={tint} size={20} />
      <Text style={styles.assistantHeroPillLabel}>{label}</Text>
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={{ flex: 1 }}
    >
      {body}
    </Pressable>
  );
}

function AssistantRobot() {
  const floatY = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let loops: Animated.CompositeAnimation[] = [];

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) return;

      const floatLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(floatY, {
            toValue: -6,
            duration: 1850,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(floatY, {
            toValue: 0,
            duration: 1850,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
      );

      const waveLoop = Animated.loop(
        Animated.sequence([
          Animated.delay(950),
          Animated.timing(wave, {
            toValue: 1,
            duration: 430,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(wave, {
            toValue: 0,
            duration: 430,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.delay(1650),
        ]),
      );

      const glowLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(glow, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
      );

      loops = [floatLoop, waveLoop, glowLoop];
      loops.forEach((animation) => animation.start());
    });

    return () => {
      active = false;
      loops.forEach((animation) => animation.stop());
    };
  }, [floatY, glow, wave]);

  const armRotate = wave.interpolate({
    inputRange: [0, 1],
    outputRange: ["-8deg", "-28deg"],
  });

  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.28, 0.58],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.assistantRobot,
        { transform: [{ translateY: floatY }] },
      ]}
    >
      <Animated.View
        style={[
          styles.assistantRobotAura,
          {
            opacity: glowOpacity,
            transform: [
              {
                scale: glow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.94, 1.05],
                }),
              },
            ],
          },
        ]}
      />

      <Svg width={174} height={190} viewBox="0 0 174 190">
        <Defs>
          <LinearGradient id="robotShell" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.55" stopColor="#FCFCFF" />
            <Stop offset="1" stopColor="#E9ECFA" />
          </LinearGradient>
          <LinearGradient id="robotBody" x1="0" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.62" stopColor="#F8F8FE" />
            <Stop offset="1" stopColor="#E7EAF8" />
          </LinearGradient>
          <LinearGradient id="robotFace" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#101542" />
            <Stop offset="0.58" stopColor="#171B52" />
            <Stop offset="1" stopColor="#27215D" />
          </LinearGradient>
          <LinearGradient id="robotBlue" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#A5C2FF" />
            <Stop offset="1" stopColor="#6E7FF4" />
          </LinearGradient>
          <LinearGradient id="robotHeart" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#CE8BE1" />
            <Stop offset="1" stopColor="#9E62CF" />
          </LinearGradient>
        </Defs>

        <Ellipse cx="99" cy="174" rx="50" ry="8" fill="#AAB1D1" opacity="0.18" />

        {/* right arm */}
        <Path
          d="M131 122 C149 119 158 125 162 138 C164 146 160 151 154 151 C148 151 145 143 142 138 C139 133 135 132 129 133 Z"
          fill="url(#robotShell)"
          stroke="#E4E6F2"
          strokeWidth="1.5"
        />

        {/* torso */}
        <Rect
          x="61"
          y="108"
          width="79"
          height="62"
          rx="29"
          fill="url(#robotBody)"
          stroke="#E1E4F1"
          strokeWidth="1.5"
        />
        <Ellipse cx="100" cy="118" rx="29" ry="8" fill="#FFFFFF" opacity="0.7" />
        <Path
          d="M99 142 C95 135 84 135 82 143 C80 151 89 157 99 164 C109 157 118 151 116 143 C114 135 103 135 99 142 Z"
          fill="url(#robotHeart)"
        />

        {/* side ear pods */}
        <Rect x="33" y="59" width="17" height="37" rx="8.5" fill="#EEF0FA" />
        <Rect x="146" y="59" width="17" height="37" rx="8.5" fill="#EEF0FA" />

        {/* head shell */}
        <Rect
          x="39"
          y="38"
          width="118"
          height="83"
          rx="35"
          fill="url(#robotShell)"
          stroke="#E1E4F1"
          strokeWidth="1.5"
        />

        {/* shell highlight */}
        <Path
          d="M58 47 C76 40 118 40 137 48"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.75"
        />

        {/* face screen */}
        <Rect x="51" y="49" width="94" height="61" rx="26" fill="url(#robotFace)" />
        <Ellipse cx="80" cy="65" rx="25" ry="12" fill="#4B5AA5" opacity="0.10" />

        {/* happy crescent eyes */}
        <Path
          d="M70 74 C70 67 76 64 82 68"
          fill="none"
          stroke="url(#robotBlue)"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Path
          d="M113 68 C119 64 125 67 125 74"
          fill="none"
          stroke="url(#robotBlue)"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* smile */}
        <Path
          d="M88 87 C95 97 106 97 113 87"
          fill="none"
          stroke="#8FAAFF"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* antenna */}
        <Rect x="95.5" y="18" width="7" height="23" rx="3.5" fill="#282B67" />
        <Circle cx="99" cy="13" r="11" fill="#FFFFFF" stroke="#E4E7F3" strokeWidth="2" />
        <Circle cx="96" cy="10" r="4" fill="#FFFFFF" opacity="0.85" />

        {/* tiny collar */}
        <Ellipse cx="100" cy="113" rx="17" ry="5" fill="#EAECF7" />
      </Svg>

      {/* waving left arm, animated separately so the mascot feels alive */}
      <Animated.View
        style={[
          styles.assistantRobotWaveArm,
          {
            transform: [
              { translateX: 18 },
              { translateY: 15 },
              { rotate: armRotate },
              { translateX: -18 },
              { translateY: -15 },
            ],
          },
        ]}
      >
        <Svg width={66} height={68} viewBox="0 0 66 68">
          <Defs>
            <LinearGradient id="waveShell" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="1" stopColor="#E7EAF8" />
            </LinearGradient>
          </Defs>
          <Path
            d="M47 50 C40 48 35 43 31 37 L20 22 C16 16 7 17 4 23 C1 29 5 34 10 38 L27 54 C33 60 43 62 51 57 Z"
            fill="url(#waveShell)"
            stroke="#E1E4F1"
            strokeWidth="1.5"
          />
          <Circle cx="12" cy="22" r="10" fill="#FFFFFF" stroke="#E1E4F1" strokeWidth="1.5" />
          <Path d="M8 17 L5 9" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
          <Path d="M12 16 L12 7" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
          <Path d="M16 18 L20 10" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" />
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}

function AssistantQuickCard({
  icon,
  label,
  background,
  iconColor,
  onPress,
}: {
  icon: string;
  label: string;
  background: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.assistantQuickCard,
        { backgroundColor: background, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={styles.assistantQuickIcon}>
        <Icon name={icon} color={iconColor} size={23} />
      </View>
      <Text style={styles.assistantQuickLabel}>{label}</Text>
    </Pressable>
  );
}

function AssistantQuestion({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.assistantQuestionCard,
        { opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <View style={styles.assistantQuestionIcon}>
        <Icon name={icon} color="#713BA0" size={23} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.assistantQuestionTitle}>{title}</Text>
        <Text style={styles.assistantQuestionSub}>{subtitle}</Text>
      </View>
      <Icon name="chevron-forward" color="#151744" size={20} />
    </Pressable>
  );
}

function AssistantResourceCard({
  icon,
  label,
  background,
  iconColor,
  onPress,
}: {
  icon: string;
  label: string;
  background: string;
  iconColor: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.assistantResourceCard,
        { backgroundColor: background, opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={[styles.assistantQuickIcon, { width: 42, height: 42 }]}>
        <Icon name={icon} color={iconColor} size={22} />
      </View>
      <Text style={styles.assistantResourceLabel}>{label}</Text>
    </Pressable>
  );
}

export function AssistantScreen() {
  const { state, dispatch } = useCare();
  const n = useNav();
  const [faith, setFaith] = useState(state.faith);
  const scroll = useRef<ScrollView>(null);
  const firstName = state.name.trim().split(/\s+/)[0] || "there";

  const send = (text: string) => {
    const answer = previewReply(text, faith);
    dispatch({
      type: "conversation-turn",
      messages: [
        makeMessage("user", text),
        { ...makeMessage("assistant", answer.text), ...answer },
      ],
    });
  };

  const hasMessages = state.conversation.messages.length > 0;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#FFFFFF" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.assistantTopbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => n.goBack()}
          style={({ pressed }) => [
            styles.assistantBack,
            { opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Icon name="arrow-back" color="#171943" size={22} />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.assistantTopTitle}>EnVizion Assistant</Text>
          <Text style={styles.assistantTopSub}>Your AI caregiver companion</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open guided support"
          onPress={() => n.navigate("Resources")}
          style={({ pressed }) => [
            styles.assistantGuideBadge,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Icon name="book-outline" color="#713BA0" size={18} />
          <Text style={styles.assistantGuideText}>Guided support</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onContentSizeChange={() => {
          if (hasMessages) scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        {!hasMessages ? (
          <>
            <View style={styles.assistantHero}>
              <View style={styles.assistantHeroGlowOne} />
              <View style={styles.assistantHeroGlowTwo} />
              <Text style={styles.assistantGreeting}>Hi {firstName} 👋</Text>
              <Text style={styles.assistantHeroTitle}>
                How can I support you today?
              </Text>
              <Text style={styles.assistantHeroBody}>
                Get personalized guidance, practical tools, and faith-based
                support for your caregiving journey.
              </Text>

              <AssistantRobot />

              <View style={styles.assistantHeroPills}>
                <AssistantFeaturePill
                  icon="sparkles"
                  label="Practical advice"
                  tint="#7A3DB0"
                />
                <AssistantFeaturePill
                  icon="book"
                  label="Trusted resources"
                  tint="#4A78D9"
                />
                <AssistantFeaturePill
                  icon="heart"
                  label="Faith-based encouragement"
                  tint="#D75F7E"
                  active={faith}
                  onPress={() => setFaith((value) => !value)}
                />
              </View>
            </View>

            <View style={styles.assistantQuickGrid}>
              <AssistantQuickCard
                icon="document-text-outline"
                label={"Summarize\ninformation"}
                background="#F4EEFF"
                iconColor="#7A3DB0"
                onPress={() => n.navigate("Summary")}
              />
              <AssistantQuickCard
                icon="medkit-outline"
                label={"Medication\nhelp"}
                background="#EEF5FF"
                iconColor="#4E7EE8"
                onPress={() => n.navigate("Medications")}
              />
              <AssistantQuickCard
                icon="calendar-outline"
                label={"Prepare\nfor a visit"}
                background="#EEF9F0"
                iconColor="#25A768"
                onPress={() => n.navigate("Appointments")}
              />
              <AssistantQuickCard
                icon="home-outline"
                label={"Plan transition\nhome"}
                background="#FFF2E8"
                iconColor="#E6845F"
                onPress={() => n.navigate("Transition")}
              />
            </View>

            <View style={styles.assistantSectionHeader}>
              <Text style={styles.assistantSectionTitle}>Popular questions</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => n.navigate("Resources")}
                style={{ flexDirection: "row", alignItems: "center", gap: 2 }}
              >
                <Text style={styles.assistantViewAll}>View all</Text>
                <Icon name="chevron-forward" color="#713BA0" size={15} />
              </Pressable>
            </View>

            <View style={styles.assistantQuestionList}>
              <AssistantQuestion
                icon="medical-outline"
                title="How do I prepare for a doctor’s visit?"
                subtitle="Get a step-by-step checklist"
                onPress={() => send("How do I prepare for a doctor’s visit?")}
              />
              <AssistantQuestion
                icon="medkit-outline"
                title="How can I organize medications?"
                subtitle="Tips, reminders and safety guidelines"
                onPress={() => send("How can I organize medications?")}
              />
              <AssistantQuestion
                icon="home-outline"
                title="What should I prepare before going home?"
                subtitle="Discharge planning and home care tips"
                onPress={() =>
                  send("What should I prepare before going home from the hospital?")
                }
              />
            </View>

            <View style={styles.assistantResourceGrid}>
              <AssistantResourceCard
                icon="chatbubble-outline"
                label="Talk to our team"
                background="#FAF6FF"
                iconColor="#713BA0"
                onPress={() => n.navigate("Handoff")}
              />
              <AssistantResourceCard
                icon="call-outline"
                label="Emergency help"
                background="#FFF2F2"
                iconColor="#D34E67"
                onPress={() => n.navigate("Emergency")}
              />
              <AssistantResourceCard
                icon="book-outline"
                label="Caregiving resources"
                background="#F7F4FF"
                iconColor="#7552B3"
                onPress={() => n.navigate("Resources")}
              />
              <AssistantResourceCard
                icon="people-outline"
                label="Community support"
                background="#EEFAF8"
                iconColor="#2DA88E"
                onPress={() => n.navigate("Handoff")}
              />
            </View>
          </>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 14 }}>
            <View style={styles.assistantChatIntro}>
              <View style={styles.assistantChatOrb}>
                <Icon name="sparkles" color="#FFFFFF" size={21} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[S.h3, { color: "#171943" }]}>
                  I’m here with you.
                </Text>
                <Text style={[S.small, { marginTop: 2, color: "#777589" }]}>
                  Ask a follow-up or choose another caregiving topic.
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start a new assistant conversation"
                onPress={() => dispatch({ type: "conversation-clear" })}
                style={{ padding: 8 }}
              >
                <Icon name="refresh-outline" color="#713BA0" size={21} />
              </Pressable>
            </View>

            {state.conversation.messages.map((message) => (
              <Bubble key={message.id} message={message} />
            ))}
          </View>
        )}
      </ScrollView>

      <Composer onSend={send} />
    </KeyboardAvoidingView>
  );
}

export function HandoffScreen() {
  const { state } = useCare();
  const n = useNav();
  const [topic, setTopic] = useState("Navigating care");
  const [context, setContext] = useState("");
  const [include, setInclude] = useState(false);
  const [channel, setChannel] =
    useState<"In-app inbox" | "WhatsApp" | "Email">("In-app inbox");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    setMessage("");
    setSubmitting(true);
    try {
      await createSupportRequest({
        topic,
        context,
        preferredChannel: channel,
        includeAssistantContext: include && state.conversation.messages.length > 0,
      });
      n.replace("TeamConversation");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not send your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="SUPPORT FROM A PERSON"
        title="Let’s bring in the team."
        body="Some questions deserve a conversation. Tell the EnVizion Life team what you would like help with."
      />
      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>Your request is securely saved</Text>
        <Txt>
          Requests are stored with your account so the support team can review
          them when the staff workspace is connected.
        </Txt>
      </Card>

      <Section title="What’s on your mind?" />
      <View style={styles.chips}>
        {[
          "Navigating care",
          "Coaching support",
          "Using the toolkit",
          "Something else",
        ].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: topic === value }}
            onPress={() => setTopic(value)}
            style={[
              styles.chip,
              topic === value && {
                backgroundColor: C.lavender,
                borderColor: C.purple,
              },
            ]}
          >
            <Text style={S.body}>{value}</Text>
          </Pressable>
        ))}
      </View>

      <Field
        label="What would you like the team to know?"
        value={context}
        onChange={(value) => setContext(value.slice(0, 1200))}
        multiline
      />
      <Text style={S.small}>{context.length}/1200</Text>

      <Section title="Preferred reply channel" />
      <View style={styles.chips}>
        {(["In-app inbox", "WhatsApp", "Email"] as const).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: channel === value }}
            onPress={() => setChannel(value)}
            style={[
              styles.chip,
              channel === value && {
                backgroundColor: C.lavender,
                borderColor: C.purple,
              },
            ]}
          >
            <Text style={S.body}>{value}</Text>
          </Pressable>
        ))}
      </View>

      <Card>
        <View style={S.between}>
          <Text style={[S.h3, { flex: 1 }]}>Include assistant context</Text>
          <Switch
            accessibilityLabel="Include assistant context with support request"
            value={include}
            onValueChange={setInclude}
            trackColor={{ true: C.purple }}
          />
        </View>
        <Txt style={S.small}>
          This records whether you want the EnVizion team to consider the
          assistant conversation when reviewing your request. Health tracker
          entries are not automatically attached.
        </Txt>
      </Card>

      {Boolean(message) && (
        <Text accessibilityRole="alert" style={[S.small, { color: C.rose }]}>
          {message}
        </Text>
      )}

      <Button
        title={submitting ? "Sending request…" : "Send support request"}
        icon="arrow-forward-outline"
        disabled={!context.trim() || submitting}
        onPress={submit}
      />

      <Button
        title="View my latest request"
        secondary
        onPress={() => n.navigate("TeamConversation")}
      />

      <Button
        title="Prepare a caregiver handoff packet"
        secondary
        icon="reader-outline"
        onPress={() => n.navigate("CarePacket")}
      />

      <Safety onPress={() => n.navigate("Emergency")} />
      <Txt style={S.small}>
        Support messaging is not an emergency service. For urgent medical help,
        use your local emergency services.
      </Txt>
    </Page>
  );
}

export function TeamConversationScreen() {
  const n = useNav();
  const [request, setRequest] = useState<SupportRequestRecord | null>(null);
  const [messages, setMessages] = useState<SupportMessageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const scroll = useRef<ScrollView>(null);

  async function refresh() {
    try {
      const result = await loadLatestSupportRequest();
      setRequest(result.request);
      setMessages(result.messages);
    } catch {
      setMessage("We could not load your support request.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function send() {
    if (!request || !composer.trim()) return;
    setSending(true);
    setMessage("");
    try {
      await sendSupportMessage(request.id, composer);
      setComposer("");
      await refresh();
    } catch {
      setMessage("We could not send your message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <Page>
        <Heading title="Your support request" />
        <Txt>Loading your conversation…</Txt>
      </Page>
    );
  }

  if (!request) {
    return (
      <Page>
        <Heading
          title="Your support conversations"
          body="Send a request when you would like help from the EnVizion Life team."
        />
        <Button title="Talk to our team" onPress={() => n.navigate("Handoff")} />
      </Page>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.paper }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={styles.header}>
        <Text style={S.h3}>EnVizion Life support</Text>
        <Badge
          text={
            request.status === "closed"
              ? "Closed"
              : request.status === "responded"
                ? "Response available"
                : request.status === "in_review"
                  ? "In review"
                  : "Submitted"
          }
        />
        <Text style={S.small}>
          Preferred channel: {request.preferred_channel}
        </Text>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: 20, gap: 16 }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        onContentSizeChange={() => {
          if (messages.length) scroll.current?.scrollToEnd({ animated: false });
        }}
      >
        <Card>
          <Text style={S.eyebrow}>{request.topic}</Text>
          <Text style={S.body}>{request.context}</Text>
          <Text style={S.small}>
            Sent {new Date(request.created_at).toLocaleString()}
          </Text>
        </Card>

        {messages.length ? (
          messages.map((item) => (
            <View
              key={item.id}
              style={[
                styles.bubble,
                item.sender_type === "caregiver"
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  S.body,
                  {
                    color:
                      item.sender_type === "caregiver" ? C.white : C.ink,
                  },
                ]}
              >
                {item.body}
              </Text>
              <Text
                style={[
                  S.small,
                  {
                    color:
                      item.sender_type === "caregiver" ? "#DDCAE5" : C.muted,
                  },
                ]}
              >
                {item.sender_type === "caregiver" ? "You" : "EnVizion team"} ·{" "}
                {new Date(item.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
          ))
        ) : (
          <Card>
            <Icon name="time-outline" />
            <Text style={S.h3}>Your request has been submitted.</Text>
            <Txt>
              It is stored securely with your account. Team responses will
              appear here once the staff workspace is connected.
            </Txt>
          </Card>
        )}

        {Boolean(message) && (
          <Text accessibilityRole="alert" style={[S.small, { color: C.rose }]}>
            {message}
          </Text>
        )}
      </ScrollView>

      {request.status !== "closed" && (
        <View style={styles.composer}>
          <View style={styles.inputRow}>
            <TextInput
              value={composer}
              onChangeText={(value) => setComposer(value.slice(0, 1200))}
              accessibilityLabel="Message EnVizion support"
              placeholder="Add a follow-up message…"
              placeholderTextColor={C.muted}
              multiline
              editable={!sending}
              style={[
                S.input,
                {
                  flex: 1,
                  minHeight: 50,
                  maxHeight: 130,
                  textAlignVertical: "top",
                  padding: 13,
                },
              ]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send follow-up message"
              disabled={sending || !composer.trim()}
              onPress={() => void send()}
              style={({ pressed }) => ({
                width: 50,
                height: 50,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 15,
                backgroundColor: C.deep,
                opacity: sending || !composer.trim() ? 0.4 : pressed ? 0.7 : 1,
              })}
            >
              <Icon name="arrow-up" color={C.white} />
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}
