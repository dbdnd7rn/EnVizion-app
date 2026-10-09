import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { C as BaseC, Icon, S as BaseS } from "../ui";

export { Icon };
export const C = {
  ...BaseC,
  ink: "#15113C",
  muted: "#77718A",
  purple: "#70338F",
  deep: "#542267",
  lavender: "#F4EBFA",
  paper: "#FFFCFB",
  line: "#E8DDF0",
};
export const S = {
  ...BaseS,
  title: { ...BaseS.title, fontFamily: "Lora_500Medium", fontSize: 31, lineHeight: 40, letterSpacing: -0.95, color: C.ink },
  h2: { ...BaseS.h2, fontFamily: "Lora_500Medium", fontSize: 24, lineHeight: 32, letterSpacing: -0.6, color: C.ink },
  h3: { ...BaseS.h3, fontFamily: "DMSans_600SemiBold", color: C.ink },
  eyebrow: { ...BaseS.eyebrow, color: C.purple },
  body: { ...BaseS.body, color: C.muted, lineHeight: 21 },
  small: { ...BaseS.small, color: C.muted },
  pill: { ...BaseS.pill, borderRadius: 18, borderWidth: 1, borderColor: "#E7DAEF" },
  input: { ...BaseS.input, borderColor: "#E1D5EA", borderRadius: 16, backgroundColor: "#FFFFFF", minHeight: 52, color: C.ink },
  card: {
    ...BaseS.card,
    borderRadius: 24,
    backgroundColor: "#FFFEFFF0",
    borderColor: "#E8DDF0",
    padding: 17,
    gap: 12,
    shadowColor: "#633C76",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 2,
  },
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(v => {
      if (active) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { active = false; sub.remove(); };
  }, []);
  return reduced;
}

export function Page({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.paper }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 15, paddingBottom: 54 }}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ width: "100%", maxWidth: 440, alignSelf: "center", gap: 17 }}>
        {children}
      </View>
    </ScrollView>
  );
}

function DecorativeGlass({ compact = false }: { compact?: boolean }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", right: -14, top: -10, opacity: 0.95 }}>
      <Svg width={compact ? 122 : 180} height={compact ? 91 : 144} viewBox="0 0 180 144" accessibilityElementsHidden>
        <Defs>
          <LinearGradient id="linkedOrb" x1="0" x2="1" y1="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.96}/>
            <Stop offset="0.6" stopColor="#E8D6FA" stopOpacity={0.86}/>
            <Stop offset="1" stopColor="#D4B8EF" stopOpacity={0.44}/>
          </LinearGradient>
        </Defs>
        <Circle cx="130" cy="28" r="71" fill="#EFDCF9" opacity={0.75}/>
        <Circle cx="154" cy="114" r="51" fill="#E1D4F8" opacity={0.53}/>
        <Circle cx="111" cy="62" r="29" stroke="#FFFFFF" strokeWidth="2" fill="url(#linkedOrb)"/>
        <Path d="M95 61L107 73L128 49" fill="none" stroke="#A46AC7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        <Circle cx="91" cy="43" r="6" fill="#FFFFFF" opacity={0.85}/>
      </Svg>
    </View>
  );
}

export function Heading({ eyebrow, title, body }: { eyebrow?: string; title: string; body?: string }) {
  const reduced = useReducedMotion();
  const fade = useRef(new Animated.Value(1)).current;
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    fade.setValue(0);
    rise.setValue(10);
    const anim = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(rise, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [fade, reduced, rise]);
  return (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
      <View
        style={{
          borderRadius: 27,
          borderWidth: 1,
          borderColor: "#E8DDF0",
          overflow: "hidden",
          backgroundColor: "#FAF4FD",
          paddingHorizontal: 19,
          paddingVertical: 22,
          minHeight: 180,
          shadowColor: "#603E76",
          shadowOpacity: 0.05,
          shadowRadius: 17,
          shadowOffset: { width: 0, height: 7 },
          elevation: 2,
          gap: 12,
        }}
      >
        <DecorativeGlass />
        {eyebrow && <Text style={[S.eyebrow, { maxWidth: "75%", fontSize: 10.5, letterSpacing: 2.2 }]}>{eyebrow}</Text>}
        <Text accessibilityRole="header" style={[S.title, { maxWidth: "94%", paddingRight: 22 }]}>
          {title}
        </Text>
        {body && (
          <Text style={[S.body, { maxWidth: "97%", paddingRight: 10, fontSize: 13.5, lineHeight: 20 }]}>
            {body}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

export function Section({
  title, action, onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={[S.between, { minHeight: 42, alignItems: "center", marginTop: 2 }]}>
      <Text accessibilityRole="header" style={[S.h2, { flex: 1 }]}>{title}</Text>
      {action && onPress && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${action}: ${title}`}
          onPress={onPress}
          style={({ pressed }) => ({
            paddingHorizontal: 13,
            minHeight: 42,
            borderRadius: 18,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F3E9FA",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ color: C.purple, fontFamily: "DMSans_600SemiBold", fontSize: 12.5 }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Card({
  children, style, onPress, label,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  label?: string;
}) {
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [S.card, style, pressed && { opacity: 0.8, transform: [{ scale: 0.99 }] }]}
      >
        {children}
      </Pressable>
    );
  }
  return <View style={[S.card, style]}>{children}</View>;
}

export function Txt({ children, style }: { children: React.ReactNode; style?: any }) {
  return <Text style={[S.body, style]}>{children}</Text>;
}

export function Field({
  label, value, onChange, numeric = false, multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  multiline?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={[S.h3, { fontSize: 13 }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        keyboardType={numeric ? "decimal-pad" : "default"}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          S.input,
          multiline && { minHeight: 106, paddingTop: 13, textAlignVertical: "top" },
          focused && { borderColor: C.purple, borderWidth: 2 },
        ]}
        placeholder={numeric ? "0" : "Write here…"}
        placeholderTextColor="#9B91A7"
      />
    </View>
  );
}

export function Button({
  title, onPress, secondary = false, icon, disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  icon?: string;
  disabled?: boolean;
}) {
  const destructive = /^(delete|deleting)\b/i.test(title);
  const tone = destructive ? "#AA3658" : C.purple;
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
        paddingVertical: 13,
        borderWidth: secondary ? 1 : 0,
        borderColor: destructive ? "#F0CFD8" : "#E7D8F0",
        backgroundColor: secondary ? destructive ? "#FFF1F4" : "#F4E9FB" : tone,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 9,
        opacity: disabled ? 0.47 : pressed ? 0.78 : 1,
        transform: [{ scale: pressed && !disabled ? 0.987 : 1 }],
      })}
    >
      {icon && <Icon name={icon} color={secondary ? tone : "#FFFFFF"} size={19} />}
      <Text style={{
        fontFamily: "DMSans_600SemiBold",
        fontSize: 14,
        textAlign: "center",
        color: secondary ? tone : "#FFFFFF",
        flexShrink: 1,
      }}>{title}</Text>
    </Pressable>
  );
}
