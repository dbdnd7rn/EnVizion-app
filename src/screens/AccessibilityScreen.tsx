import React, { useCallback, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  PixelRatio,
  Platform,
  Text,
  View,
} from "react-native";
import {
  accessibilityReadiness,
  MINIMUM_TOUCH_TARGET,
} from "../accessibilityHelpers";
import {
  Button,
  C,
  Card,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";

export function AccessibilityScreen() {
  const [fontScale, setFontScale] = useState(PixelRatio.getFontScale());
  const [reduceMotion, setReduceMotion] = useState(false);
  const [screenReader, setScreenReader] = useState(false);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const [motion, reader] = await Promise.all([
        AccessibilityInfo.isReduceMotionEnabled(),
        AccessibilityInfo.isScreenReaderEnabled(),
      ]);
      setReduceMotion(motion);
      setScreenReader(reader);
      setFontScale(PixelRatio.getFontScale());
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    const reader = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReader,
    );
    return () => {
      motion.remove();
      reader.remove();
    };
  }, [refresh]);

  const readiness = accessibilityReadiness({
    fontScale,
    reduceMotion,
    screenReader,
  });

  return (
    <Page>
      <Heading
        eyebrow="ACCESSIBILITY & DISPLAY"
        title="Built to adapt to the way you use your device."
        body="EnVizion follows system text scaling and reduced-motion preferences, uses labelled controls, and keeps primary touch targets at least 44 points high."
      />

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 145 }}>
          <Text style={S.eyebrow}>TEXT SIZE</Text>
          <Text style={S.h3}>{readiness.fontScaleLabel}</Text>
          <Txt style={S.small}>System scale {fontScale.toFixed(2)}×</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 145 }}>
          <Text style={S.eyebrow}>MOTION</Text>
          <Text style={S.h3}>
            {reduceMotion ? "Reduced motion on" : "Standard motion"}
          </Text>
          <Txt style={S.small}>Animations respect the system preference.</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 145 }}>
          <Text style={S.eyebrow}>SCREEN READER</Text>
          <Text style={S.h3}>{screenReader ? "Active" : "Not detected"}</Text>
          <Txt style={S.small}>
            Interactive controls expose labels and roles.
          </Txt>
        </Card>
      </View>

      <Section title="Interaction contract" />
      <Card>
        <View style={S.row}>
          <Icon name="finger-print-outline" size={26} />
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>Comfortable touch targets</Text>
            <Txt style={S.small}>
              Core buttons and navigation actions use at least {MINIMUM_TOUCH_TARGET}
              -point interaction height.
            </Txt>
          </View>
        </View>
        <View style={S.row}>
          <Icon name="text-outline" size={26} />
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>Dynamic text</Text>
            <Txt style={S.small}>
              Text follows the device font scale instead of locking users to one size.
            </Txt>
          </View>
        </View>
        <View style={S.row}>
          <Icon name="eye-outline" size={26} />
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>Meaning beyond color</Text>
            <Txt style={S.small}>
              Important states also use words, icons, or counts instead of color alone.
            </Txt>
          </View>
        </View>
      </Card>

      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>Device settings remain in control.</Text>
        <Txt>
          Change text size, VoiceOver/TalkBack, contrast, or motion preferences in
          your {Platform.OS === "ios" ? "iPhone or iPad" : Platform.OS === "android" ? "Android" : "device"} settings.
          EnVizion rechecks these system preferences while the app is open.
        </Txt>
      </Card>

      <Button
        title={checking ? "Checking settings…" : "Recheck accessibility settings"}
        secondary
        disabled={checking}
        icon="refresh-outline"
        onPress={() => void refresh()}
      />
    </Page>
  );
}
