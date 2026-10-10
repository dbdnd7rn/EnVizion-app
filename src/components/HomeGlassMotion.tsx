import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Platform,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, RadialGradient, Stop } from "react-native-svg";
import { useAppearance } from "../appearance";

/** Motion is decorative: stop it when reduced motion is on or the app is inactive. */
function useDecorativeMotion() {
  const [allowMotion, setAllowMotion] = useState(false);
  const [active, setActive] = useState(
    Platform.OS === "web" || AppState.currentState === "active",
  );

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (mounted) setAllowMotion(!reduced);
      })
      .catch(() => {
        // Accessibility information unavailable: prefer the still design.
      });

    const reduceSubscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (reduced) => setAllowMotion(!reduced),
    );
    const stateSubscription = AppState.addEventListener("change", (state) => {
      if (Platform.OS !== "web") setActive(state === "active");
    });

    return () => {
      mounted = false;
      reduceSubscription.remove();
      stateSubscription.remove();
    };
  }, []);

  return allowMotion && active;
}

/** Small, slow-bobbing, translucent glass orbs above the landscape only. */
export function HomeGlassOrb({
  size,
  style,
  id,
  delay = 0,
}: {
  size: number;
  style: StyleProp<ViewStyle>;
  id: "a" | "b";
  delay?: number;
}) {
  const { dark } = useAppearance();
  const enabled = useDecorativeMotion();
  const offset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!enabled) {
      offset.stopAnimation();
      offset.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(offset, {
          toValue: -6,
          duration: 2700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(offset, {
          toValue: 2,
          duration: 2900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      offset.setValue(0);
    };
  }, [delay, enabled, offset]);

  const glow = `homeGlassGlow-${id}`;
  const sheen = `homeGlassSheen-${id}`;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: size,
          height: size,
          opacity: dark ? 0.55 : 0.88,
          transform: [{ translateY: offset }],
        },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Defs>
          <RadialGradient id={glow} cx="36%" cy="25%" r="74%">
            <Stop offset="0%" stopColor={dark ? "#E4CCFA" : "#FFFFFF"} stopOpacity="0.85" />
            <Stop offset="40%" stopColor={dark ? "#AD85C4" : "#E9D1FA"} stopOpacity="0.54" />
            <Stop offset="84%" stopColor={dark ? "#75528C" : "#B991D4"} stopOpacity="0.23" />
            <Stop offset="100%" stopColor={dark ? "#62447F" : "#9E74C2"} stopOpacity="0.72" />
          </RadialGradient>
          <LinearGradient id={sheen} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.06" />
          </LinearGradient>
        </Defs>
        <Circle cx="50" cy="50" r="43" fill={`url(#${glow})`} />
        <Circle cx="50" cy="50" r="42" stroke={`url(#${sheen})`} strokeWidth="2.5" fill="none" />
        <Ellipse cx="34" cy="26" rx="18" ry="10" transform="rotate(-28 34 26)" fill="#FFFFFF" opacity="0.54" />
        <Path d="M21 62 Q39 82 67 73" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.35" />
      </Svg>
    </Animated.View>
  );
}

/**
 * A faint sweep of light behind card contents. Pointer events never intercept
 * the actual profile switcher or next-step action.
 */
export function HomeGlassSheen({ variant }: { variant: "profile" | "nextStep" }) {
  const { dark } = useAppearance();
  const { width } = useWindowDimensions();
  const enabled = useDecorativeMotion();
  const offset = useRef(new Animated.Value(-150)).current;
  const travel = Math.min(width - 40, 440) + 180;

  useEffect(() => {
    if (!enabled) {
      offset.stopAnimation();
      offset.setValue(-150);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(variant === "profile" ? 900 : 2650),
        Animated.timing(offset, {
          toValue: travel,
          duration: 4400,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.delay(3900),
        Animated.timing(offset, {
          toValue: -150,
          duration: 0,
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );
    loop.start();

    return () => {
      loop.stop();
      offset.setValue(-150);
    };
  }, [enabled, offset, travel, variant]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, overflow: "hidden" }}
    >
      <Animated.View
        style={{
          position: "absolute",
          top: -100,
          left: 0,
          width: 79,
          height: 390,
          borderRadius: 38,
          backgroundColor:
            variant === "profile"
              ? (dark ? "#E0C8F015" : "#FFFFFF47")
              : "#FFFFFF19",
          transform: [{ translateX: offset }, { rotate: "22deg" }],
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 1,
          left: 24,
          right: 24,
          height: 1,
          backgroundColor:
            variant === "profile"
              ? (dark ? "#D7B6F53A" : "#FFFFFFAD")
              : "#FFFFFF56",
        }}
      />
    </View>
  );
}
