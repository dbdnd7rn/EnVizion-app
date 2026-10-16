import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";
import Svg, {
  Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop,
} from "react-native-svg";

/** Decorative art only; real clinical counts and records live in the screen. */
export function ClinicalGlassArtwork({ dark }: { dark: boolean }) {
  const [motion, setMotion] = useState(false);
  const floating = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => { if (mounted) setMotion(!reduced); })
      .catch(() => { /* Keep art still when preference is unavailable. */ });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (reduced) => setMotion(!reduced));
    return () => { mounted = false; sub.remove(); };
  }, []);

  useEffect(() => {
    if (!motion) {
      floating.stopAnimation();
      floating.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(floating, {
        toValue: -4,
        duration: 3600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== "web",
      }),
      Animated.timing(floating, {
        toValue: 0,
        duration: 3600,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: Platform.OS !== "web",
      }),
    ]));
    loop.start();
    return () => {
      loop.stop();
      floating.setValue(0);
    };
  }, [motion, floating]);

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: 194, height: 184, transform: [{ translateY: floating }] }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 194 184">
        <Defs>
          <LinearGradient id="clinicalHalo" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={dark ? "#65447D" : "#E5C9FA"} stopOpacity=".24" />
            <Stop offset="60%" stopColor={dark ? "#8657A3" : "#F2DFFA"} stopOpacity=".65" />
            <Stop offset="100%" stopColor={dark ? "#332342" : "#FFFFFF"} stopOpacity=".2" />
          </LinearGradient>
          <LinearGradient id="clinicalBook" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={dark ? "#D5B4F4" : "#FFFFFF"} />
            <Stop offset="100%" stopColor={dark ? "#9E6CC5" : "#DFBEF3"} />
          </LinearGradient>
          <LinearGradient id="clinicalShield" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#B678E5" />
            <Stop offset="100%" stopColor="#76319D" />
          </LinearGradient>
        </Defs>
        <Ellipse cx="106" cy="96" rx="84" ry="78" fill="url(#clinicalHalo)" />
        <Circle cx="105" cy="94" r="68" fill="none" stroke={dark ? "#A57EC5" : "#FFFFFF"} strokeWidth="1.4" opacity=".8" />
        <Circle cx="105" cy="94" r="53" fill="none" stroke={dark ? "#A57EC5" : "#FFFFFF"} strokeWidth="1" opacity=".55" />
        <G transform="rotate(-7 94 95)">
          <Rect x="51" y="52" width="101" height="92" rx="23" fill={dark ? "#422D56" : "#FFFFFF"} fillOpacity=".42" stroke={dark ? "#9C7CB9" : "#FFFFFF"} strokeWidth="1.4" />
          <Path d="M68 69 C84 62 94 64 104 72 C115 64 126 63 137 69 L137 124 C125 119 115 118 104 126 C91 118 81 119 68 124 Z" fill="url(#clinicalBook)" stroke={dark ? "#A57AC8" : "#BB88DE"} strokeWidth="2.5" strokeLinejoin="round" />
          <Path d="M104 74 L104 125" stroke={dark ? "#744D98" : "#A66DCB"} strokeWidth="2" />
          <Path d="M76 81 Q87 77 97 83 M76 91 Q86 88 97 94 M113 83 Q122 79 131 82" fill="none" stroke={dark ? "#A382C4" : "#C9A2E1"} strokeWidth="2.6" strokeLinecap="round" />
        </G>
        <Path d="M128 38 C140 47 152 48 162 43 L162 64 C162 81 145 91 145 91 C145 91 127 81 127 64 Z" fill="url(#clinicalShield)" stroke={dark ? "#D2AAF4" : "#FFFFFF"} strokeWidth="2" />
        <Path d="M135 61 L143 69 L155 55" stroke="#FFFFFF" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx="36" cy="41" r="7" fill={dark ? "#C89ADE" : "#E4ADEB"} opacity=".75" />
        <Circle cx="163" cy="124" r="5" fill={dark ? "#CB9DE5" : "#DFB8F0"} opacity=".8" />
        <Path d="M29 135 Q44 157 79 163 M144 28 Q177 39 176 75" fill="none" stroke={dark ? "#8F6BB4" : "#C9ACE2"} strokeWidth="1.6" opacity=".75" />
      </Svg>
    </Animated.View>
  );
}