import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, View,
  type ViewStyle, type StyleProp,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useAppearance } from "../appearance";
import { Icon, C } from "../ui";

type Variant = "notifications" | "staff" | "pilot";
const icons: Record<Variant, string> = {
  notifications: "notifications-outline", staff: "people-outline", pilot: "analytics-outline",
};
export function AdminGlassArt({ variant, dark }: { variant: Variant; dark: boolean }) {
  const [moving, setMoving] = useState(false);
  const offset = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (alive) setMoving(!reduced);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduced) => setMoving(!reduced));
    return () => { alive = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!moving) { offset.stopAnimation(); offset.setValue(0); return; }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(offset, { toValue: -4, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(offset, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" }),
    ]));
    animation.start();
    return () => { animation.stop(); offset.setValue(0); };
  }, [moving, offset]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ height: 164, width: 180, transform: [{ translateY: offset }] }}
    >
      <Svg width="180" height="164" viewBox="0 0 180 164">
        <Defs>
          <LinearGradient id={"adminGlass-"+variant} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={dark ? "#8A5CAC" : "#D2ABEC"} stopOpacity=".30" />
            <Stop offset="55%" stopColor={dark ? "#9B66BB" : "#EFDEF9"} stopOpacity=".88" />
            <Stop offset="100%" stopColor={dark ? "#68448D" : "#FFF8FF"} stopOpacity=".55" />
          </LinearGradient>
        </Defs>
        <Circle cx="91" cy="86" r="67" fill={"url(#adminGlass-"+variant+")"} />
        <Circle cx="91" cy="86" r="56" fill="none" stroke={dark ? "#9D77BE" : "#FFFFFF"} strokeWidth="1.5" opacity=".75" />
        <Circle cx="91" cy="86" r="41" fill={dark ? "#342344" : "#FFFFFF"} fillOpacity=".55" stroke={dark ? "#AA89C9" : "#FFFFFF"} />
        <Circle cx="34" cy="39" r="6" fill={dark ? "#9F77C0" : "#E2B9EA"} />
        <Circle cx="151" cy="128" r="5" fill={dark ? "#D4A6E5" : "#DAA9ED"} />
        <Path d="M24 117 Q36 143 68 151 M130 26 Q161 44 160 72" fill="none" stroke={dark ? "#986BBC" : "#C7A0E3"} strokeWidth="2" strokeLinecap="round" opacity=".67" />
      </Svg>
      <View style={{
        position: "absolute", left: 49, top: 44, width: 86, height: 86,
        alignItems: "center", justifyContent: "center",
        borderRadius: 28, borderWidth: 1.3,
        borderColor: dark ? "#AC83D0" : "#FFFFFF",
        backgroundColor: dark ? "#58406FAE" : "#FFFFFFB5",
        shadowColor: "#6D3C91", shadowOpacity: .13, shadowRadius: 14,
      }}>
        <Icon name={icons[variant]} size={46} color={dark ? "#E8C8FF" : "#7A379B"} />
      </View>
    </Animated.View>
  );
}

export function AdminGlassHero({
  variant, eyebrow, title, description, footer,
}: {
  variant: Variant; eyebrow: string; title: string; description: string; footer?: React.ReactNode;
}) {
  const { dark } = useAppearance();
  return (
    <View style={{
      minHeight: 228, backgroundColor: dark ? "#241B35" : "#FFF7FE",
      borderRadius: 28, borderWidth: 1,
      borderColor: dark ? "#59436B" : "#EFE4F4",
      padding: 19, gap: 11, overflow: "hidden",
      shadowColor: dark ? "#000000" : "#9B6AA4",
      shadowOpacity: dark ? 0 : .055, shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
    }}>
      <View pointerEvents="none" style={{
        position: "absolute", right: -53, top: -33,
        width: 177, height: 177, borderRadius: 100,
        backgroundColor: dark ? "#604278" : "#EBD4F5", opacity: .32,
      }} />
      <View pointerEvents="none" style={{
        position: "absolute", right: -37, top: 18, opacity: .5,
      }}>
        <AdminGlassArt variant={variant} dark={dark} />
      </View>
      <Text style={{
        fontFamily: "DMSans_700Bold", fontSize: 10.3,
        letterSpacing: 2.2, color: dark ? "#D9B8F3" : "#8039A0",
      }}>{eyebrow.toUpperCase()}</Text>
      <Text accessibilityRole="header" style={{
        fontFamily: "DMSans_700Bold", fontSize: 29,
        lineHeight: 35, letterSpacing: -.95,
        maxWidth: 275, color: dark ? "#E0D9E8" : "#17143C",
      }}>{title}</Text>
      <Text style={{
        fontFamily: "DMSans_400Regular", fontSize: 13.2,
        lineHeight: 20, maxWidth: 273,
        color: dark ? "#ACA3BB" : "#79708B",
      }}>{description}</Text>
      {footer ? <View style={{ marginTop: 7 }}>{footer}</View> : null}
    </View>
  );
}

export function AdminGlassCard({
  children, style,
}: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { dark } = useAppearance();
  return (
    <View style={[{
      borderWidth: 1, borderColor: dark ? "#554264" : "#EDE5F2",
      borderRadius: 24, padding: 16, gap: 13,
      backgroundColor: dark ? "#272039" : "#FFFFFFED",
      shadowColor: dark ? "#000000" : "#7B538A",
      shadowOpacity: dark ? 0 : .06, shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
    }, style]}>
      {children}
    </View>
  );
}

export function AdminGlassSection({
  title, action, onPress,
}: { title: string; action?: string; onPress?: () => void }) {
  const { dark } = useAppearance();
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10,
    }}>
      <Text accessibilityRole="header" style={{
        flex: 1, color: dark ? "#E0D9E8" : "#17143C",
        fontFamily: "DMSans_700Bold", fontSize: 21.5, lineHeight: 28,
      }}>{title}</Text>
      {action && onPress && (
        <Pressable
          accessibilityRole="button" accessibilityLabel={action}
          onPress={onPress}
          style={({ pressed }) => ({
            minHeight: 40, paddingHorizontal: 13,
            flexDirection: "row", gap: 5, alignItems: "center",
            borderRadius: 21, borderWidth: 1,
            borderColor: dark ? "#74518A" : "#E2D1EC",
            opacity: pressed ? .65 : 1,
          })}
        >
          <Icon name="refresh-outline" size={15} color={dark ? "#DEBEFA" : "#78339B"} />
          <Text style={{ fontFamily: "DMSans_600SemiBold", fontSize: 11.8, color: dark ? "#DEBEFA" : "#78339B" }}>
            {action}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

export function AdminGlassMetric({
  value, label, icon,
}: { value: number | string; label: string; icon: string }) {
  const { dark } = useAppearance();
  return (
    <View style={{
      width: "48.4%", minHeight: 105, borderRadius: 18,
      padding: 13, gap: 9,
      borderWidth: 1, borderColor: dark ? "#604A74" : "#EEE6F1",
      backgroundColor: dark ? "#322640" : "#FFFFFFE8",
    }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Icon name={icon} color={dark ? "#D6B0F4" : "#833DAC"} size={20} />
        <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 26, lineHeight: 30, color: dark ? "#E0D9E8" : "#19153B" }}>{value}</Text>
      </View>
      <Text style={{
        fontFamily: "DMSans_600SemiBold", fontSize: 11.8, lineHeight: 16.5,
        color: dark ? "#D8C6E5" : "#746A82",
      }}>{label}</Text>
    </View>
  );
}

export function AdminGlassTabs<T extends string>({
  options, value, onChange,
}: {
  options: Array<{ key: T; label: string; icon?: string }>;
  value: T; onChange: (next: T) => void;
}) {
  const { dark } = useAppearance();
  return (
    <View style={{
      flexDirection: "row", gap: 4, padding: 4, borderRadius: 23,
      backgroundColor: dark ? "#30253D" : "#F1E8F8",
    }}>
      {options.map((tab) => (
        <Pressable
          key={tab.key}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab.key === value }}
          onPress={() => onChange(tab.key)}
          style={({ pressed }) => ({
            flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 3,
            borderRadius: 20, alignItems: "center", justifyContent: "center", gap: 4,
            opacity: pressed ? .8 : 1,
            backgroundColor: tab.key === value ? (dark ? "#8055A1" : "#783396") : "transparent",
          })}
        >
          {tab.icon && <Icon name={tab.icon} size={16} color={tab.key === value ? "#FFFFFF" : (dark ? "#D8BEEC" : "#783396")} />}
          <Text numberOfLines={1} style={{
            fontFamily: "DMSans_600SemiBold", fontSize: 11,
            color: tab.key === value ? (dark ? "#EFE9F4" : "#FFFFFF") : (dark ? "#E5CFF4" : "#794296"),
          }}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
