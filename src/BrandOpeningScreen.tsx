import React, { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, Text, View } from "react-native";

/**
 * A lightweight, native-driver opening sequence. The native splash and this
 * screen share the same ivory background and authentic EnVizion Life artwork.
 * No animation library, network request, or customer data is involved.
 */
export function BrandOpeningScreen({
  reducedMotion,
}: {
  reducedMotion: boolean | null;
}) {
  const reveal = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const caption = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Wait for the platform accessibility setting before animating.
    if (reducedMotion === null) return;
    if (reducedMotion) {
      reveal.setValue(1);
      glow.setValue(1);
      caption.setValue(1);
      return;
    }

    const animation = Animated.parallel([
      Animated.timing(reveal, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(glow, {
        toValue: 1,
        duration: 2400,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(740),
        Animated.timing(caption, {
          toValue: 1,
          duration: 920,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);
    animation.start();
    return () => animation.stop();
  }, [caption, glow, reducedMotion, reveal]);

  return (
    <View
      style={styles.stage}
      accessible
      accessibilityLabel="EnVizion Life is opening"
    >
      <View style={styles.ambientGlow} importantForAccessibility="no-hide-descendants" />
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.outerRing,
          {
            opacity: glow.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [0.25, 0.57, 0.2],
            }),
            transform: [
              {
                scale: glow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.78, 1.16],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.innerRing,
          {
            opacity: glow.interpolate({
              inputRange: [0, 1],
              outputRange: [0.36, 0.72],
            }),
            transform: [
              {
                scale: glow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.86, 1.06],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: reveal,
            transform: [
              {
                translateY: reveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [26, 0],
                }),
              },
              {
                scale: reveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1],
                }),
              },
            ],
          },
        ]}
      >
        <View style={styles.logoGlass}>
          <Image
            accessible={false}
            source={require("../assets/envizion-original.png")}
            resizeMode="contain"
            style={styles.logo}
          />
        </View>
      </Animated.View>
      <Animated.View
        importantForAccessibility="no-hide-descendants"
        style={[
          styles.taglineContainer,
          {
            opacity: caption,
            transform: [
              {
                translateY: caption.interpolate({
                  inputRange: [0, 1],
                  outputRange: [12, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.tagline}>CARE IN MOTION</Text>
        <View style={styles.accentLine} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: "#FCF9F6",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  ambientGlow: {
    width: 350,
    height: 350,
    borderRadius: 175,
    position: "absolute",
    backgroundColor: "#F4E9FA",
    opacity: 0.6,
  },
  outerRing: {
    width: 355,
    height: 355,
    borderRadius: 178,
    position: "absolute",
    borderWidth: 1,
    borderColor: "#C8A0D9",
    backgroundColor: "rgba(247, 236, 251, 0.20)",
  },
  innerRing: {
    width: 305,
    height: 305,
    borderRadius: 153,
    position: "absolute",
    borderWidth: 1,
    borderColor: "#E0C8E9",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  logoContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoGlass: {
    width: 318,
    height: 214,
    borderRadius: 32,
    backgroundColor: "rgba(255, 255, 255, 0.50)",
    borderColor: "rgba(255, 255, 255, 0.75)",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#70338F",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 28,
    elevation: 3,
  },
  logo: {
    width: 276,
    height: 170,
  },
  taglineContainer: {
    marginTop: 18,
    alignItems: "center",
    gap: 12,
  },
  tagline: {
    color: "#70338F",
    fontFamily: "DMSans_600SemiBold",
    fontSize: 11,
    letterSpacing: 4,
  },
  accentLine: {
    width: 48,
    height: 2,
    borderRadius: 2,
    backgroundColor: "#B889CB",
  },
});
