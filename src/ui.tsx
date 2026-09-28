import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, {
  Circle,
  Path,
  Defs,
  LinearGradient,
  Stop,
} from "react-native-svg";
export const C = {
  ink: "#18163C",
  muted: "#77758B",
  purple: "#74328F",
  deep: "#542267",
  lavender: "#F3ECF9",
  paper: "#FFFDFC",
  line: "#EEE8F0",
  rose: "#C34A67",
  redBg: "#FFF0F1",
  green: "#24986E",
  white: "#FFFFFF",
};
export const S = StyleSheet.create({
  page: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 38, gap: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  title: {
    fontFamily: "DMSans_700Bold",
    fontSize: 32,
    lineHeight: 39,
    letterSpacing: -0.8,
    color: C.ink,
  },
  h2: {
    fontFamily: "DMSans_700Bold",
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.35,
    color: C.ink,
  },
  h3: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    lineHeight: 22,
    color: C.ink,
  },
  body: {
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    lineHeight: 22,
    color: C.muted,
  },
  small: {
    fontFamily: "DMSans_400Regular",
    fontSize: 12,
    lineHeight: 18,
    color: C.muted,
  },
  eyebrow: {
    fontFamily: "DMSans_700Bold",
    fontSize: 10,
    letterSpacing: 2.1,
    color: C.purple,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: C.line,
    gap: 12,
    shadowColor: "#35223F",
    shadowOpacity: 0.045,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E6DCE9",
    borderRadius: 20,
    padding: 15,
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    color: C.ink,
    backgroundColor: C.white,
    minHeight: 54,
    shadowColor: "#35223F",
    shadowOpacity: 0.025,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  pill: {
    backgroundColor: C.lavender,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  divider: { height: 1, backgroundColor: C.line },
});
export type IconName = React.ComponentProps<typeof Ionicons>["name"];
export function Icon({
  name,
  size = 22,
  color = C.purple,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name as IconName} size={size} color={color} />;
}
export function Txt({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: any;
}) {
  return <Text style={[S.body, style]}>{children}</Text>;
}
export function Button({
  title,
  onPress,
  secondary = false,
  icon,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  icon?: string;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        backgroundColor: secondary ? "#F3ECF9" : C.purple,
        borderRadius: 27,
        paddingHorizontal: 20,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {icon && (
        <Icon name={icon} color={secondary ? C.deep : C.white} size={19} />
      )}
      <Text
        style={[
          S.h3,
          { fontSize: 14, color: secondary ? C.purple : C.white },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}
export function Card({
  children,
  style,
  onPress,
  label,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  label?: string;
}) {
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={label ? `Open ${label}` : undefined}
      onPress={onPress}
      style={({ pressed }) => [
        S.card,
        style,
        pressed && { opacity: 0.78, transform: [{ scale: 0.99 }] },
      ]}
    >
      {children}
    </Pressable>
  ) : (
    <View style={[S.card, style]}>{children}</View>
  );
}
export function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.paper }}
      contentContainerStyle={S.page}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );
}
export function Heading({
  eyebrow,
  title,
  body,
}: {
  eyebrow?: string;
  title: string;
  body?: string;
}) {
  return (
    <View style={{ gap: 8 }}>
      {eyebrow && <Text style={S.eyebrow}>{eyebrow}</Text>}
      <Text accessibilityRole="header" style={S.title}>
        {title}
      </Text>
      {body && <Txt>{body}</Txt>}
    </View>
  );
}
export function Section({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={S.between}>
      <Text accessibilityRole="header" style={S.h2}>
        {title}
      </Text>
      {action && (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${title}`}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={[S.h3, { fontSize: 12, color: C.purple }]}>
            {action} →
          </Text>
        </Pressable>
      )}
    </View>
  );
}
export function Row({
  title,
  subtitle,
  icon,
  onPress,
  trailing,
}: {
  title: string;
  subtitle?: string;
  icon: string;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Card
      onPress={onPress}
      label={subtitle ? `${title}. ${subtitle}` : title}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        gap: 14,
        borderRadius: 22,
      }}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 16,
          backgroundColor: "#F2EAF8",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={S.h3}>{title}</Text>
        {subtitle && <Text style={S.small}>{subtitle}</Text>}
      </View>
      {trailing || <Icon name="chevron-forward" color="#A092A6" size={17} />}
    </Card>
  );
}
export function Field({
  label,
  value,
  onChange,
  numeric = false,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[S.h3, { fontSize: 13 }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        style={[
          S.input,
          multiline && { minHeight: 96, textAlignVertical: "top" },
        ]}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? "decimal-pad" : "default"}
        multiline={multiline}
        placeholder={numeric ? "0" : "Write here…"}
        placeholderTextColor="#AAA0AF"
      />
    </View>
  );
}
export function Brand() {
  return (
    <Image
      source={require("../assets/envizion-original.png")}
      style={{ width: 119, height: 74 }}
      resizeMode="contain"
      accessibilityLabel="EnVizion Life"
    />
  );
}
export function Safety({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Emergency and warning signs"
      onPress={onPress}
      style={{
        backgroundColor: C.redBg,
        borderRadius: 22,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: "#F3DADF",
      }}
    >
      <Icon name="alert-circle-outline" color={C.rose} />
      <View style={{ flex: 1 }}>
        <Text style={[S.h3, { fontSize: 13, color: "#983D46" }]}>
          Emergency & warning signs
        </Text>
        <Text style={[S.small, { color: "#995D62" }]}>
          Know when to get help
        </Text>
      </View>
      <Icon name="chevron-forward" color={C.rose} size={17} />
    </Pressable>
  );
}
export function Landscape({ height = 145 }: { height?: number }) {
  return (
    <Svg
      width="100%"
      height={height}
      viewBox="0 0 400 180"
      preserveAspectRatio="xMidYMid slice"
      {...(Platform.OS === "web"
        ? { "aria-hidden": true }
        : { accessibilityElementsHidden: true })}
    >
      <Defs>
        <LinearGradient id="sky" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFF4F7" />
          <Stop offset="1" stopColor="#EEE2F7" />
        </LinearGradient>
      </Defs>
      <Path d="M0 0H400V180H0Z" fill="url(#sky)" />
      <Circle cx="294" cy="51" r="28" fill="#F9EED3" />
      <Path d="M0 116Q75 46 166 111T400 70V180H0Z" fill="#D5C0DD" />
      <Path d="M0 150Q95 75 227 140T400 104V180H0Z" fill="#AF94BE" />
      <Path d="M0 175Q131 102 263 170T400 149V180H0Z" fill="#81618F" />
      <Path
        d="M195 180Q316 147 248 125Q207 110 263 101"
        fill="none"
        stroke="#F8EDD9"
        strokeWidth="7"
      />
      <Path
        d="M47 149V88M47 118Q20 111 26 92Q49 91 47 118M48 133Q74 122 70 105Q45 108 48 133"
        stroke="#6D537E"
        strokeWidth="3"
        fill="#9273A1"
      />
    </Svg>
  );
}
export function Fade({ children }: { children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let alive = true;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!alive || reduced) return;

      opacity.setValue(0);
      translateY.setValue(8);

      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 320,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 320,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]).start();
    });

    return () => {
      alive = false;
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }],
        gap: 22,
      }}
    >
      {children}
    </Animated.View>
  );
}
