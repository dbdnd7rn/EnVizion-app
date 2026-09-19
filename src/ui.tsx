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
  ink: "#30243A",
  muted: "#776C7D",
  purple: "#7B428E",
  deep: "#4C2B61",
  lavender: "#EFE6F4",
  paper: "#FCFAF7",
  line: "#EDE7EC",
  rose: "#BA424E",
  redBg: "#FFF0EE",
  green: "#437565",
  white: "#FFFFFF",
};
export const S = StyleSheet.create({
  page: { paddingHorizontal: 24, paddingTop: 22, paddingBottom: 32, gap: 22 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    fontFamily: "DMSans_700Bold",
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.6,
    color: C.ink,
  },
  h2: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 23,
    lineHeight: 30,
    letterSpacing: -0.3,
    color: C.ink,
  },
  h3: {
    fontFamily: "DMSans_600SemiBold",
    fontSize: 16,
    lineHeight: 23,
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
    letterSpacing: 1.7,
    color: C.purple,
    textTransform: "uppercase",
  },
  card: {
    backgroundColor: C.white,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: C.line,
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#DCD1E0",
    borderRadius: 14,
    padding: 15,
    fontSize: 15,
    fontFamily: "DMSans_400Regular",
    color: C.ink,
    backgroundColor: C.white,
    minHeight: 52,
  },
  pill: {
    backgroundColor: C.lavender,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
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
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        backgroundColor: secondary ? C.lavender : C.purple,
        borderRadius: 16,
        padding: 15,
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
        style={[S.h3, { fontSize: 14, color: secondary ? C.deep : C.white }]}
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
      label={title}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        gap: 14,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          backgroundColor: C.lavender,
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
        borderRadius: 16,
        padding: 15,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderWidth: 1,
        borderColor: "#F5DBD9",
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
          <Stop offset="0" stopColor="#F3E7ED" />
          <Stop offset="1" stopColor="#E8DAEC" />
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
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!reduced && alive) {
        opacity.setValue(0);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 360,
          useNativeDriver: Platform.OS !== "web",
        }).start();
      }
    });
    return () => {
      alive = false;
      opacity.stopAnimation();
    };
  }, [opacity]);
  return <Animated.View style={{ opacity, gap: 22 }}>{children}</Animated.View>;
}
