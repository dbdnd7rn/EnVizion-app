import React, { useEffect, useId, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, View } from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { themeBackground, themeBorder } from "../themeColors";

export function useAIMotionPreference() {
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (alive) setReduced(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => { alive = false; subscription.remove(); };
  }, []);
  return reduced;
}

/** Decorative vector artwork: no downloads, raster assets or interaction layer. */
export function AIAtmosphere({ variant = "wash" }: { variant?: "wash" | "corner" }) {
  const id = useId().replace(/:/g, "");
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 23 }}>
    <Svg width="100%" height="100%" viewBox="0 0 360 400" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={`${id}wash`}><Stop offset="0" stopColor="#C7AAED" stopOpacity="0.30"/><Stop offset="1" stopColor="#DCC7EF" stopOpacity="0"/></RadialGradient>
      </Defs>
      <Ellipse cx="340" cy={variant === "corner" ? "0" : "85"} rx="180" ry="165" fill={`url(#${id}wash)`}/>
      {variant === "wash" && <>
        <Ellipse cx="0" cy="335" rx="140" ry="120" fill={`url(#${id}wash)`}/>
        <Path d="M-45 150 Q170 25 405 130 M-50 168 Q180 50 400 148" fill="none" stroke="#AD86CB" strokeOpacity="0.12" strokeWidth="1"/>
        <Circle cx="315" cy="275" r="29" fill="#CFB8EE" fillOpacity="0.10" stroke="#C6ACE4" strokeOpacity="0.18"/>
      </>}
    </Svg>
  </View>;
}

export function AIIconBubble({ children, size = 42 }: { children: React.ReactNode; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2,
    alignItems: "center", justifyContent: "center", borderWidth: 1,
    borderColor: themeBorder("#E7D6F2"), backgroundColor: themeBackground("#F0E4F9D9"),
    shadowColor: "#754C96", shadowOpacity: 0.08, shadowRadius: 7, shadowOffset: { width: 0, height: 3 } }}>
    {children}
  </View>;
}

export function AIGlassOrb({ reducedMotion, compact = false }: { reducedMotion: boolean; compact?: boolean }) {
  const focused = useIsFocused();
  const drift = useRef(new Animated.Value(0)).current;
  const id = useId().replace(/:/g, "");
  useEffect(() => {
    if (reducedMotion || !focused) { drift.setValue(0); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(drift, { toValue: -6, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web", isInteraction: false }),
      Animated.timing(drift, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: Platform.OS !== "web", isInteraction: false }),
    ]));
    loop.start();
    return () => { loop.stop(); drift.setValue(0); };
  }, [drift, focused, reducedMotion]);
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={{ height: compact ? 84 : 156, alignItems: "center", justifyContent: "center" }}>
    <Animated.View style={{ width: compact ? 130 : 240, height: compact ? 90 : 164, transform: [{ translateY: drift }] }}>
      <Svg width="100%" height="100%" viewBox="0 0 260 180">
        <Defs>
          <RadialGradient id={`${id}glow`}><Stop offset="0" stopColor="#B590E0" stopOpacity="0.30"/><Stop offset="1" stopColor="#EADCF9" stopOpacity="0"/></RadialGradient>
          <RadialGradient id={`${id}orb`} cx="32%" cy="22%" r="80%"><Stop offset="0" stopColor="#FFFFFF"/><Stop offset="0.30" stopColor="#F0E5FF" stopOpacity="0.9"/><Stop offset="0.68" stopColor="#C8ACEA" stopOpacity="0.8"/><Stop offset="1" stopColor="#8756B8" stopOpacity="0.94"/></RadialGradient>
          <LinearGradient id={`${id}edge`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#FFFFFF"/><Stop offset="1" stopColor="#BA94D9" stopOpacity="0.6"/></LinearGradient>
          <LinearGradient id={`${id}spark`} x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#A873D1"/><Stop offset="1" stopColor="#643485"/></LinearGradient>
        </Defs>
        <Ellipse cx="130" cy="92" rx="115" ry="83" fill={`url(#${id}glow)`}/>
        <Ellipse cx="134" cy="157" rx="55" ry="7" fill="#8E60AF" opacity="0.12"/>
        <Ellipse cx="128" cy="91" rx="104" ry="34" rotation="-25" origin="128,91" fill="none" stroke="#CBB4E5" strokeWidth="1.4" opacity="0.6"/>
        <Circle cx="130" cy="83" r="60" fill={`url(#${id}orb)`} stroke={`url(#${id}edge)`} strokeWidth="2"/>
        <Path d="M89 59 Q96 26 135 29" fill="none" stroke="#FFFFFF" strokeOpacity="0.8" strokeWidth="5" strokeLinecap="round"/>
        <Path d="M130 51 Q136 76 159 83 Q136 90 130 115 Q124 90 101 83 Q124 76 130 51Z" fill={`url(#${id}spark)`}/>
        <Path d="M82 106 Q128 154 191 105" fill="none" stroke="#F8F0FF" strokeOpacity="0.6" strokeWidth="2"/>
        <Rect x="185" y="23" width="34" height="34" rx="12" rotation="14" origin="202,40" fill="#F5EEFF" fillOpacity="0.7" stroke="#FFFFFF"/>
        <Path d="M202 29 L205 37 L213 40 L205 43 L202 51 L199 43 L191 40 L199 37Z" fill="#A47CC5"/>
        <Circle cx="54" cy="114" r="12" fill="#E8D8F7" fillOpacity="0.8" stroke="#FFFFFF"/>
        <Circle cx="211" cy="117" r="7" fill="#CAB1E5" fillOpacity="0.6" stroke="#F6EDFF"/>
        <Circle cx="67" cy="41" r="4" fill="#B18BCF" fillOpacity="0.7"/>
      </Svg>
    </Animated.View>
  </View>;
}
