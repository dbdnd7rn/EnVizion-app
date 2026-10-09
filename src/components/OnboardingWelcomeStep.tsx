import { themeForeground, themeTint } from "../themeColors";
import React, { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { Brand, Icon } from "../ui";

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReducedMotion(value);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}

function Entrance({
  children,
  delay,
  enabled,
}: {
  children: React.ReactNode;
  delay: number;
  enabled: boolean;
}) {
  const progress = useRef(new Animated.Value(enabled ? 0 : 1)).current;

  useEffect(() => {
    if (!enabled) {
      progress.stopAnimation();
      progress.setValue(1);
      return;
    }

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      delay,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== "web",
    });
    animation.start();
    return () => animation.stop();
  }, [delay, enabled, progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [10, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

function useFloatLoop(
  active: boolean,
  distance: number,
  halfDuration: number,
) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    value.stopAnimation();
    value.setValue(0);
    if (!active) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, {
          toValue: 1,
          duration: halfDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(value, {
          toValue: 0,
          duration: halfDuration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]),
    );

    loop.start();
    return () => {
      loop.stop();
      value.stopAnimation();
    };
  }, [active, halfDuration, value]);

  return value.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -distance],
  });
}

function GlassHeart() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 220 190">
      <Defs>
        <LinearGradient id="welcomeHeartBase" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FCF4FF" stopOpacity="0.98" />
          <Stop offset="0.28" stopColor="#DABAF0" stopOpacity="0.9" />
          <Stop offset="0.56" stopColor="#A969D0" stopOpacity="0.76" />
          <Stop offset="0.8" stopColor="#F6DDF8" stopOpacity="0.88" />
          <Stop offset="1" stopColor="#7E3AA5" stopOpacity="0.8" />
        </LinearGradient>
        <RadialGradient id="welcomeHeartGlow" cx="40%" cy="28%" r="73%">
          <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.96" />
          <Stop offset="0.4" stopColor="#F8E9FF" stopOpacity="0.44" />
          <Stop offset="1" stopColor="#8E4CB5" stopOpacity="0.04" />
        </RadialGradient>
        <LinearGradient id="welcomeHeartEdge" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#6E318E" stopOpacity="0.82" />
          <Stop offset="0.48" stopColor="#FFFFFF" stopOpacity="0.88" />
          <Stop offset="1" stopColor="#8D4FB6" stopOpacity="0.82" />
        </LinearGradient>
      </Defs>

      <Path
        d="M110 174C92 149 36 115 29 69C23 29 51 9 78 14C96 17 106 31 110 41C115 31 125 17 143 14C170 9 198 29 191 69C184 115 128 149 110 174Z"
        fill="url(#welcomeHeartBase)"
        stroke="url(#welcomeHeartEdge)"
        strokeWidth="2.7"
      />
      <Path
        d="M110 168C91 145 45 112 39 72C34 40 54 24 77 27C93 29 104 43 110 56C118 42 129 29 145 27C168 24 188 40 182 72C176 112 129 145 110 168Z"
        fill="url(#welcomeHeartGlow)"
      />
      <Path
        d="M55 55C72 31 98 38 106 58C88 52 72 58 55 55Z"
        fill="#FFFFFF"
        opacity="0.72"
      />
      <Path
        d="M48 74C64 93 94 105 131 107C109 123 80 114 58 98C50 91 46 82 48 74Z"
        fill="#FFFFFF"
        opacity="0.24"
      />
      <Path
        d="M126 40C144 24 169 35 177 55"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <Path
        d="M93 153C110 163 126 151 141 137"
        fill="none"
        stroke="#FCEBFF"
        strokeWidth="3"
        strokeLinecap="round"
        opacity="0.58"
      />
    </Svg>
  );
}

function GlassTile({ icon, size = 62 }: { icon: string; size?: number }) {
  const gradientId = "welcomeTile-" + icon;
  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#6F318E",
        shadowOpacity: 0.11,
        shadowRadius: 11,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      }}
    >
      <Svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        style={{ position: "absolute" }}
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.96" />
            <Stop offset="0.5" stopColor="#F3E7FA" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#D9B8EB" stopOpacity="0.76" />
          </LinearGradient>
        </Defs>
        <Rect
          x="3"
          y="3"
          width="58"
          height="58"
          rx="15"
          fill={"url(#" + gradientId + ")"}
          stroke="#D6B3E5"
          strokeWidth="1.4"
        />
        <Path
          d="M10 16C20 9 40 8 53 17"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="4"
          strokeLinecap="round"
          opacity="0.76"
        />
      </Svg>
      <Icon name={icon} size={27} color="#70338F" />
    </View>
  );
}

function WelcomeHeroArtwork({
  reducedMotion,
  active,
  compact,
}: {
  reducedMotion: boolean;
  active: boolean;
  compact: boolean;
}) {
  const { width } = useWindowDimensions();
  const artWidth = Math.min(Math.max(width - 40, 300), 440);
  const heroHeight = compact ? 328 : 370;
  const scaleX = artWidth / 440;
  const scaleY = heroHeight / 370;
  const animate = active && !reducedMotion;

  const heartY = useFloatLoop(animate, 8, 2800);
  const calendarY = useFloatLoop(animate, 5, 2400);
  const peopleY = useFloatLoop(animate, 7, 3150);
  const shieldY = useFloatLoop(animate, 6, 2700);

  const orbitTravel = useRef(new Animated.Value(0)).current;
  const pathTravel = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    orbitTravel.stopAnimation();
    pathTravel.stopAnimation();
    orbitTravel.setValue(0);
    pathTravel.setValue(0);
    if (!animate) return;

    const orbit = Animated.loop(
      Animated.timing(orbitTravel, {
        toValue: 1,
        duration: 6200,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );
    const journey = Animated.loop(
      Animated.timing(pathTravel, {
        toValue: 1,
        duration: 5200,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== "web",
      }),
    );

    orbit.start();
    journey.start();
    return () => {
      orbit.stop();
      journey.stop();
      orbitTravel.stopAnimation();
      pathTravel.stopAnimation();
    };
  }, [animate, orbitTravel, pathTravel]);

  const orbitX = orbitTravel.interpolate({
    inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
    outputRange: [210, 286, 330, 286, 210, 134, 90, 134, 210].map(
      (value) => value * scaleX,
    ),
  });
  const orbitY = orbitTravel.interpolate({
    inputRange: [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
    outputRange: [72, 92, 130, 166, 180, 165, 130, 92, 72].map(
      (value) => value * scaleY,
    ),
  });
  const journeyX = pathTravel.interpolate({
    inputRange: [0, 0.28, 0.55, 0.78, 1],
    outputRange: [232, 302, 250, 320, 382].map((value) => value * scaleX),
  });
  const journeyY = pathTravel.interpolate({
    inputRange: [0, 0.28, 0.55, 0.78, 1],
    outputRange: [220, 248, 278, 311, 350].map((value) => value * scaleY),
  });

  return (
    <View
      accessible
      accessibilityLabel="Lavender glass heart above a glowing care journey through soft hills"
      style={{
        width: "100%",
        height: heroHeight,
        overflow: "hidden",
        borderRadius: 30,
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 440 370"
        preserveAspectRatio="xMidYMid slice"
      >
        <Defs>
          <LinearGradient id="welcomeSky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFDF8" />
            <Stop offset="0.36" stopColor="#F8ECF8" />
            <Stop offset="0.7" stopColor="#E7D3F2" />
            <Stop offset="1" stopColor="#D3B9E4" />
          </LinearGradient>
          <LinearGradient id="welcomeFarHill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#D9C1E8" />
            <Stop offset="1" stopColor="#B899D0" />
          </LinearGradient>
          <LinearGradient id="welcomeNearHill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#B798CD" />
            <Stop offset="1" stopColor="#8767AB" />
          </LinearGradient>
          <LinearGradient id="welcomePath" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFF9E8" />
            <Stop offset="0.55" stopColor="#FFE1B7" />
            <Stop offset="1" stopColor="#FFFFFF" />
          </LinearGradient>
          <RadialGradient id="welcomeSunGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFF9DE" stopOpacity="0.95" />
            <Stop offset="0.55" stopColor="#FFE9AD" stopOpacity="0.56" />
            <Stop offset="1" stopColor="#FFE9AD" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="welcomeOrbit" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#E3A2CC" stopOpacity="0.3" />
            <Stop offset="0.44" stopColor="#FFD89A" stopOpacity="0.96" />
            <Stop offset="0.7" stopColor="#F1A9D1" stopOpacity="0.8" />
            <Stop offset="1" stopColor="#D793CB" stopOpacity="0.32" />
          </LinearGradient>
        </Defs>

        <Rect x="0" y="0" width="440" height="370" fill="url(#welcomeSky)" />
        <Circle cx="382" cy="138" r="70" fill="url(#welcomeSunGlow)" />
        <Circle cx="382" cy="139" r="25" fill="#FFF8DE" opacity="0.96" />

        <Path
          d="M0 175C50 151 85 151 125 165C168 179 203 185 247 171C304 153 347 156 440 183V250H0Z"
          fill="#E4D3EE"
          opacity="0.96"
        />
        <Path
          d="M0 206C54 173 98 172 141 189C184 206 219 225 269 207C322 188 366 187 440 211V286H0Z"
          fill="url(#welcomeFarHill)"
        />
        <Path
          d="M0 250C64 213 105 219 153 235C195 250 231 273 286 250C335 230 378 232 440 249V370H0Z"
          fill="url(#welcomeNearHill)"
        />

        <Path
          d="M229 205C270 214 299 219 306 230C312 241 291 250 266 258C239 267 234 277 260 286C289 297 327 302 341 315C354 327 329 338 300 347C282 353 270 360 265 370"
          fill="none"
          stroke="#FFF1CF"
          strokeWidth="22"
          strokeLinecap="round"
          opacity="0.28"
        />
        <Path
          d="M229 205C270 214 299 219 306 230C312 241 291 250 266 258C239 267 234 277 260 286C289 297 327 302 341 315C354 327 329 338 300 347C282 353 270 360 265 370"
          fill="none"
          stroke="url(#welcomePath)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        <Ellipse
          cx="214"
          cy="128"
          rx="145"
          ry="62"
          fill="none"
          stroke="url(#welcomeOrbit)"
          strokeWidth="2.2"
        />

        <G opacity="0.76">
          <Ellipse cx="34" cy="302" rx="8" ry="41" fill="#70508A" transform="rotate(-28 34 302)" />
          <Ellipse cx="62" cy="317" rx="7" ry="35" fill="#9676A9" transform="rotate(22 62 317)" />
          <Ellipse cx="93" cy="327" rx="6" ry="30" fill="#B096C0" transform="rotate(-18 93 327)" />
          <Ellipse cx="401" cy="303" rx="7" ry="37" fill={themeTint("#795791")} transform="rotate(24 401 303)" />
          <Ellipse cx="372" cy="320" rx="6" ry="30" fill="#A184B4" transform="rotate(-18 372 320)" />
        </G>

        <G fill="#D4A8D1" opacity="0.68">
          <Circle cx="84" cy="286" r="3" />
          <Circle cx="103" cy="299" r="2.4" />
          <Circle cx="55" cy="282" r="2.8" />
          <Circle cx="360" cy="291" r="2.7" />
          <Circle cx="383" cy="282" r="2.2" />
          <Circle cx="405" cy="291" r="2.8" />
        </G>
      </Svg>

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: compact ? "22%" : "25%",
          top: compact ? 54 : 57,
          width: compact ? 190 : 214,
          height: compact ? 164 : 184,
          transform: [{ translateY: heartY }],
        }}
      >
        <GlassHeart />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: compact ? 42 : 54,
          top: compact ? 92 : 99,
          transform: [{ translateY: calendarY }],
        }}
      >
        <GlassTile icon="calendar-outline" size={compact ? 56 : 62} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: compact ? 28 : 46,
          top: compact ? 54 : 63,
          transform: [{ translateY: peopleY }],
        }}
      >
        <GlassTile icon="people-outline" size={compact ? 56 : 62} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          right: compact ? 49 : 66,
          top: compact ? 169 : 181,
          transform: [{ translateY: shieldY }],
        }}
      >
        <GlassTile icon="shield-checkmark-outline" size={compact ? 56 : 62} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -5,
          top: -5,
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: "#FFF4C5",
          shadowColor: "#FFD37C",
          shadowOpacity: 0.8,
          shadowRadius: 9,
          shadowOffset: { width: 0, height: 0 },
          transform: [{ translateX: orbitX }, { translateY: orbitY }],
        }}
      />

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: -4,
          top: -4,
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: "#FFF7D9",
          shadowColor: "#FFD58B",
          shadowOpacity: 0.75,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          transform: [{ translateX: journeyX }, { translateY: journeyY }],
        }}
      />
    </View>
  );
}

function FeatureTile({ icon }: { icon: string }) {
  const gradientId = "welcomeFeature-" + icon;
  return (
    <View
      style={{
        width: 54,
        height: 54,
        borderRadius: 18,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        shadowColor: "#7A458F",
        shadowOpacity: 0.08,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 1,
      }}
    >
      <Svg
        width="54"
        height="54"
        viewBox="0 0 54 54"
        style={{ position: "absolute" }}
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.62" stopColor="#F4E8FA" />
            <Stop offset="1" stopColor="#E4CDEF" />
          </LinearGradient>
        </Defs>
        <Rect
          x="1"
          y="1"
          width="52"
          height="52"
          rx="17"
          fill={"url(#" + gradientId + ")"}
          stroke="#E0C5EA"
          strokeWidth="1.2"
        />
        <Path
          d="M8 13C19 6 35 7 46 13"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.8"
        />
      </Svg>
      <Icon name={icon} size={26} color="#70338F" />
    </View>
  );
}

function PrimaryWelcomeButton({ onPress }: { onPress: () => void }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Let’s get started"
      onPress={onPress}
      {...(Platform.OS === "web"
        ? ({
            onMouseEnter: () => setHovered(true),
            onMouseLeave: () => setHovered(false),
          } as any)
        : {})}
      style={({ pressed }) => ({
        minHeight: 62,
        borderRadius: 32,
        overflow: "hidden",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        opacity: pressed ? 0.9 : 1,
        transform: [{ scale: pressed ? 0.988 : hovered ? 1.004 : 1 }],
        shadowColor: "#63257F",
        shadowOpacity: hovered ? 0.23 : 0.16,
        shadowRadius: hovered ? 18 : 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 4,
        ...(Platform.OS === "web" ? ({ cursor: "pointer" } as any) : {}),
      })}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 440 64"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
      >
        <Defs>
          <LinearGradient id="welcomeButtonGradient" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#7B369B" />
            <Stop offset="0.52" stopColor="#8D3EB0" />
            <Stop offset="1" stopColor="#70338F" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="440" height="64" rx="32" fill="url(#welcomeButtonGradient)" />
      </Svg>
      <Icon name="arrow-forward" size={25} color="#FFFFFF" />
      <Text
        style={{
          fontFamily: "DMSans_700Bold",
          fontSize: 16,
          lineHeight: 22,
          color: "#FFFFFF",
        }}
      >
        Let’s get started
      </Text>
    </Pressable>
  );
}

export function OnboardingWelcomeStep({
  step,
  totalSteps,
  onContinue,
}: {
  step: number;
  totalSteps: number;
  onContinue: () => void;
}) {
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotionPreference();
  const isFocused = useIsFocused();
  const compact = width < 380;
  const motionEnabled = isFocused && !reducedMotion;

  const features = [
    {
      icon: "heart-outline",
      title: "Organize everyday care",
      body: "Keep medicines, appointments, observations, and tasks together.",
    },
    {
      icon: "people-outline",
      title: "Coordinate the people around care",
      body: "Share the right information with family and caregivers.",
    },
    {
      icon: "shield-checkmark-outline",
      title: "Be ready when it matters",
      body: "Keep important care information easier to find in urgent moments.",
    },
  ];

  return (
    <View
      style={{
        marginHorizontal: -20,
        marginTop: -18,
        paddingHorizontal: 20,
        paddingTop: 18,
        gap: 19,
        backgroundColor: "#FFFDFC",
        overflow: "hidden",
      }}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 480 1600"
        preserveAspectRatio="none"
        style={{ position: "absolute", inset: 0 }}
        pointerEvents="none"
      >
        <Defs>
          <RadialGradient id="welcomeBlush" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#F6DDE9" stopOpacity="0.34" />
            <Stop offset="1" stopColor="#F6DDE9" stopOpacity="0" />
          </RadialGradient>
          <RadialGradient id="welcomeLavenderWash" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#E9D8F5" stopOpacity="0.36" />
            <Stop offset="1" stopColor="#E9D8F5" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="42" cy="120" r="170" fill="url(#welcomeBlush)" />
        <Circle cx="454" cy="390" r="210" fill="url(#welcomeLavenderWash)" />
        <Circle cx="245" cy="1280" r="250" fill="url(#welcomeLavenderWash)" opacity="0.34" />
      </Svg>

      <View
        style={{
          minHeight: 76,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
        }}
      >
        <Brand />
        <Text
          accessibilityLabel={`Welcome, step ${step + 1} of ${totalSteps}`}
          style={{
            fontFamily: "DMSans_500Medium",
            fontSize: 13,
            lineHeight: 18,
            letterSpacing: 0.7,
            color: "#615E78",
          }}
        >
          WELCOME • {step + 1} / {totalSteps}
        </Text>
      </View>

      <WelcomeHeroArtwork
        reducedMotion={reducedMotion}
        active={isFocused}
        compact={compact}
      />

      <Entrance delay={40} enabled={motionEnabled}>
        <View style={{ gap: 9, paddingHorizontal: 3 }}>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 11,
              lineHeight: 16,
              letterSpacing: 3.1,
              color: "#70338F",
              textTransform: "uppercase",
            }}
          >
            Faith. Clarity. Compassion.
          </Text>
          <Text
            accessibilityRole="header"
            style={{
              fontFamily: "Lora_500Medium",
              fontSize: compact ? 38 : 43,
              lineHeight: compact ? 45 : 50,
              letterSpacing: -1.3,
              color: "#11123E",
            }}
          >
            Care is a journey.{"\n"}Let’s walk together.
          </Text>
        </View>
      </Entrance>

      <Entrance delay={90} enabled={motionEnabled}>
        <Text
          style={{
            paddingHorizontal: 3,
            fontFamily: "DMSans_400Regular",
            fontSize: compact ? 15 : 16,
            lineHeight: compact ? 22 : 24,
            color: "#6F6C82",
          }}
        >
          A calmer place to organize care, prepare for appointments, coordinate
          family, and keep important information close.
        </Text>
      </Entrance>

      <View style={{ gap: compact ? 14 : 16 }}>
        {features.map((feature, index) => (
          <Entrance
            key={feature.title}
            delay={135 + index * 55}
            enabled={motionEnabled}
          >
            <View
              style={{
                minHeight: 64,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
              }}
            >
              <FeatureTile icon={feature.icon} />
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={{
                    fontFamily: "DMSans_700Bold",
                    fontSize: 15.5,
                    lineHeight: 21,
                    color: themeForeground("#151541"),
                  }}
                >
                  {feature.title}
                </Text>
                <Text
                  style={{
                    fontFamily: "DMSans_400Regular",
                    fontSize: 13.5,
                    lineHeight: 20,
                    color: themeForeground("#777387"),
                  }}
                >
                  {feature.body}
                </Text>
              </View>
            </View>
          </Entrance>
        ))}
      </View>

      <Entrance delay={320} enabled={motionEnabled}>
        <PrimaryWelcomeButton onPress={onContinue} />
      </Entrance>

      <View
        accessibilityLabel={`Onboarding page ${step + 1} of ${totalSteps}`}
        style={{
          minHeight: 18,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 13,
        }}
      >
        {Array.from({ length: totalSteps }).map((_, index) => {
          const selected = index === step;
          return (
            <View
              key={index}
              style={{
                width: selected ? 40 : 10,
                height: 10,
                borderRadius: 999,
                backgroundColor: selected ? "#70338F" : "#E2D6EB",
              }}
            />
          );
        })}
      </View>
    </View>
  );
}
