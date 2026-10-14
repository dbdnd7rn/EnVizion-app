import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";

function useGentleMotion() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => { if (mounted) setEnabled(!reduced); })
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener(
      "reduceMotionChanged", (reduced) => setEnabled(!reduced),
    );
    return () => { mounted = false; listener.remove(); };
  }, []);
  return enabled;
}

/** Decorative only: logo-like care team illustration, no false live activity. */
export function StaffCareArtwork({ dark }: { dark: boolean }) {
  const allowed = useGentleMotion();
  const floatY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!allowed) { floatY.stopAnimation(); floatY.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: -5, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" }),
      Animated.timing(floatY, { toValue: 0, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web" }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [allowed, floatY]);
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      style={{ width: 195, height: 178, transform: [{ translateY: floatY }] }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 195 178">
        <Defs>
          <LinearGradient id="staffHalo" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={dark ? "#6D498F" : "#F0DBFF"} stopOpacity=".1" />
            <Stop offset="65%" stopColor={dark ? "#A376CA" : "#CF9EEA"} stopOpacity=".6" />
            <Stop offset="100%" stopColor={dark ? "#674584" : "#FDECF8"} stopOpacity=".2" />
          </LinearGradient>
          <LinearGradient id="staffPeople" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={dark ? "#BE8CF8" : "#9F55D9"} />
            <Stop offset="100%" stopColor={dark ? "#7E5BB1" : "#63318D"} />
          </LinearGradient>
        </Defs>
        <Ellipse cx="101" cy="92" rx="90" ry="81" fill="url(#staffHalo)" />
        <Circle cx="108" cy="87" r="72" fill="none" stroke={dark ? "#B48CE0" : "#FFFFFF"} strokeWidth="1.5" opacity=".7" />
        <Circle cx="108" cy="87" r="57" fill="none" stroke={dark ? "#B48CE0" : "#FFFFFF"} strokeWidth="1" opacity=".44" />
        <Path d="M94 65 C88 54 73 48 74 38 C75 28 88 26 95 39 C102 26 116 29 117 40 C118 50 104 60 94 65Z" fill={dark ? "#DA91DF" : "#E46BD5"} opacity=".9" />
        <Circle cx="62" cy="84" r="12" fill="url(#staffPeople)" />
        <Circle cx="128" cy="86" r="11" fill="url(#staffPeople)" />
        <Path d="M54 101 C32 109 31 128 45 142 C53 149 62 148 67 138 L73 115 L89 132 C95 137 105 129 100 121 L78 98 C69 92 62 97 54 101Z" fill="url(#staffPeople)" />
        <Path d="M128 100 C142 101 158 116 155 129 C151 143 143 146 135 139 L122 118 L115 135 C112 144 101 143 99 135 C94 119 108 100 128 100Z" fill="url(#staffPeople)" opacity=".85" />
        <Circle cx="38" cy="63" r="3" fill={dark ? "#B78DE0" : "#B67DD8"} opacity=".75" />
        <Circle cx="162" cy="58" r="4" fill={dark ? "#DBA6DD" : "#F1B8DE"} opacity=".85" />
        <Path d="M21 115 Q12 84 31 56 M174 66 Q188 111 165 140" fill="none" stroke={dark ? "#8D6AAD" : "#CAABE8"} strokeWidth="1.5" opacity=".65" />
      </Svg>
    </Animated.View>
  );
}

/** Seven points: actual request creation dates, never invented historical series. */
export function StaffVolumeSparkline({
  values,
  id,
  dark,
}: {
  values: number[];
  id: "support" | "coaching";
  dark: boolean;
}) {
  const counts = Array.from({ length: 7 }, (_, i) => Math.max(0, values[i] ?? 0));
  const peak = Math.max(1, ...counts);
  const points = counts.map((value, i) => ({
    x: 5 + (i * 23),
    y: 59 - (value / peak) * 43,
  }));
  const line = points.map((point, i) => `${i ? "L" : "M"}${point.x} ${point.y}`).join(" ");
  const area = `${line} L 143 64 L 5 64 Z`;
  const color = dark ? "#D8B3F5" : "#8D3CCD";
  const gradientId = `staffSpark-${id}`;
  return (
    <Svg width={148} height={72} viewBox="0 0 148 70" accessibilityLabel={`New requests over the past seven days: ${counts.join(", ")}`}>
      <Defs>
        <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity=".30" />
          <Stop offset="100%" stopColor={color} stopOpacity=".015" />
        </LinearGradient>
      </Defs>
      <Path d={area} fill={`url(#${gradientId})`} />
      <Path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <Circle cx={points[6].x} cy={points[6].y} r="3.7" fill={color} stroke={dark ? "#251B34" : "#FFFFFF"} strokeWidth="2" />
    </Svg>
  );
}

export function requestVolumeByDay(dates: string[], now = new Date()) {
  const lastWeek = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
    return [day.getFullYear(), day.getMonth() + 1, day.getDate()].join("-");
  });
  const counts = lastWeek.map(() => 0);
  for (const raw of dates) {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) continue;
    const key = [d.getFullYear(), d.getMonth() + 1, d.getDate()].join("-");
    const index = lastWeek.indexOf(key);
    if (index !== -1) counts[index] += 1;
  }
  return counts;
}
