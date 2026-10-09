import { themeForeground } from "../themeColors";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, Animated, Easing, Pressable, Text, View,
} from "react-native";
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop,
} from "react-native-svg";
import { Icon } from "../ui";

const PURPLE = "#70338F";
const INK = "#16123B";
const MUTED = "#77718B";

const glass = {
  borderRadius: 24,
  borderWidth: 1,
  borderColor: "#E8DDF1",
  backgroundColor: "#FFFFFFEB",
  shadowColor: "#633A7A",
  shadowOpacity: 0.055,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

/** Rendered SVG, not an image of the interface. */
function CalendarArtwork() {
  return (
    <Svg width="155" height="160" viewBox="0 0 160 160" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="schedCalendar" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#E6CFF8" />
        </LinearGradient>
        <LinearGradient id="schedCalendarTop" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#B57FE4" />
          <Stop offset="1" stopColor="#7C39AC" />
        </LinearGradient>
      </Defs>
      <Circle cx="95" cy="71" r="64" fill="#F4EAFD" opacity={0.85}/>
      <Ellipse cx="83" cy="146" rx="61" ry="9" fill="#9F79C3" opacity={0.14}/>
      <G rotation={-7} origin="78,80">
        <Rect x="27" y="35" width="108" height="106" rx="19" fill="url(#schedCalendar)" stroke="#D9BAEB" strokeWidth="1.5"/>
        <Path d="M27 55 Q27 35 46 35 H117 Q135 35 135 55 V66 H27Z" fill="url(#schedCalendarTop)"/>
        <Rect x="48" y="25" width="11" height="29" rx="5.5" fill="#6F34A1" stroke="#DEC3F3" strokeWidth="2"/>
        <Rect x="107" y="25" width="11" height="29" rx="5.5" fill="#6F34A1" stroke="#DEC3F3" strokeWidth="2"/>
        {[
          [48,79],[78,79],[107,79],
          [48,108],[78,108],[107,108],
        ].map(([x,y]) => (
          <Rect key={`${x}-${y}`} x={x} y={y} width="18" height="18" rx="5" fill="#D6BCEB" opacity={y===108 ? .78 : .98}/>
        ))}
      </G>
      <Circle cx="128" cy="120" r="27" fill="#FFFFFF" opacity={0.95} stroke="#DDC5EF"/>
      <Circle cx="120" cy="114" r="6" fill="#71389C"/>
      <Circle cx="137" cy="114" r="6" fill="#71389C"/>
      <Path d="M109 134 C109 121 128 121 128 134 M128 134 C128 121 147 121 147 134" fill="#71389C"/>
      <Circle cx="31" cy="22" r="6" fill="#FFFFFF" opacity={0.8}/>
    </Svg>
  );
}

export function ScheduleHero() {
  return (
    <View style={[glass, {
      paddingHorizontal: 18, paddingVertical: 22, minHeight: 223,
      backgroundColor: "#FAF4FDEB", overflow: "hidden",
    }]}>
      <View pointerEvents="none" style={{ position: "absolute", right: -23, top: -40 }}>
        <CircleDecoration/>
      </View>
      <Text style={{
        fontFamily: "DMSans_700Bold", color: themeForeground(PURPLE), letterSpacing: 1.9,
        fontSize: 10.5, maxWidth: "78%", marginBottom: 12,
      }}>AVAILABILITY & SHIFT SCHEDULING</Text>
      <View style={{ flexDirection: "row", gap: 0, alignItems: "center" }}>
        <View style={{ flex: 1, paddingRight: 0, zIndex: 1, gap: 9 }}>
          <Text accessibilityRole="header" style={{
            fontFamily: "Lora_500Medium", color: themeForeground(INK), fontSize: 26,
            lineHeight: 33, letterSpacing: -0.6,
          }}>Plan caregiver coverage with clarity.</Text>
          <Text style={{
            fontFamily: "DMSans_400Regular", color: themeForeground(MUTED),
            fontSize: 12, lineHeight: 18,
          }}>
            Shifts, availability and coverage in one calm place.
          </Text>
        </View>
        <View pointerEvents="none" style={{ width: 131, marginRight: -10, marginLeft: -2 }}>
          <CalendarArtwork/>
        </View>
      </View>
    </View>
  );
}

function CircleDecoration() {
  return (
    <Svg width="155" height="145" viewBox="0 0 155 145" accessibilityElementsHidden>
      <Circle cx="115" cy="40" r="82" fill="#F0DDFB" opacity={0.6}/>
      <Circle cx="91" cy="127" r="64" fill="#DED1F9" opacity={0.35}/>
    </Svg>
  );
}

export function CurrentCoverageCard({
  title, detail, onPress, busy,
}: {
  title: string; detail: string; onPress: () => void; busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open current caregiver coverage and scheduled shifts"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [glass, {
        paddingHorizontal: 16, paddingVertical: 18,
        flexDirection: "row", alignItems: "center", gap: 13,
        opacity: pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.989 : 1 }],
      }]}
    >
      <View style={{
        width: 52, height: 52, borderRadius: 26, backgroundColor: "#F2E8FA",
        justifyContent: "center", alignItems: "center",
      }}>
        <Icon name="calendar-outline" size={25} color={themeForeground(PURPLE)}/>
      </View>
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={{
          fontFamily: "DMSans_700Bold", fontSize: 10.5,
          letterSpacing: 1.5, color: themeForeground(PURPLE),
        }}>CURRENT COVERAGE</Text>
        <Text style={{
          fontFamily: "DMSans_700Bold", fontSize: 15, lineHeight: 21, color: themeForeground(INK),
        }}>{title}</Text>
        <Text style={{
          fontFamily: "DMSans_400Regular", fontSize: 12.5,
          lineHeight: 17, color: themeForeground(MUTED),
        }}>{detail}</Text>
      </View>
      <Icon name="chevron-forward-outline" size={21} color={themeForeground(PURPLE)}/>
    </Pressable>
  );
}

export function ScheduleQuickAction({
  title, icon, onPress, disabled = false, tint = "#F7EFFD",
}: {
  title: string; icon: string; onPress: () => void; disabled?: boolean; tint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [glass, {
        width: "48.4%", minHeight: 104, padding: 12,
        justifyContent: "space-between", gap: 7,
        backgroundColor: tint, opacity: disabled ? 0.44 : pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      }]}
    >
      <View style={{
        width: 37, height: 37, borderRadius: 18,
        backgroundColor: "#FFFFFFBC",
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={22} color={themeForeground(PURPLE)} />
      </View>
      <View style={{ flexDirection: "row", gap: 4, alignItems: "flex-end" }}>
        <Text style={{
          flex: 1, fontFamily: "DMSans_600SemiBold",
          fontSize: 13, lineHeight: 18, color: themeForeground(INK),
        }}>{title}</Text>
        <Icon name="chevron-forward-outline" size={18} color={themeForeground(PURPLE)}/>
      </View>
    </Pressable>
  );
}

export function ScheduleOverviewTile({
  title, detail, icon, onPress, expanded = false, tint,
}: {
  title: string; detail: string; icon: string; onPress: () => void;
  expanded?: boolean; tint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}: ${detail}`}
      accessibilityState={{ expanded }}
      onPress={onPress}
      style={({ pressed }) => [glass, {
        paddingHorizontal: 13, paddingVertical: 15,
        flexDirection: "row", alignItems: "flex-start",
        gap: 11, minHeight: 105,
        backgroundColor: tint || (expanded ? "#F7EFFD" : "#FFFFFFF0"),
        opacity: pressed ? 0.78 : 1,
        transform: [{ scale: pressed ? 0.992 : 1 }],
      }]}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: "#F2E8FB",
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} size={22} color={tint === "#EAF7F1" ? "#228269" : PURPLE}/>
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 13.3, color: themeForeground(INK), lineHeight: 18 }}>{title}</Text>
        <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12.2, lineHeight: 18, color: themeForeground(MUTED) }}>{detail}</Text>
      </View>
      <Icon name={expanded ? "chevron-up-outline" : "chevron-forward-outline"} size={19} color={themeForeground(PURPLE)}/>
    </Pressable>
  );
}

export function ScheduleReveal({ children }: { children: React.ReactNode }) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduceMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      y.setValue(0);
      return;
    }
    opacity.setValue(0);
    y.setValue(8);
    const effect = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    effect.start();
    return () => effect.stop();
  }, [opacity, reduceMotion, y]);
  return <Animated.View style={{ opacity, transform: [{ translateY: y }], gap: 10 }}>{children}</Animated.View>;
}
