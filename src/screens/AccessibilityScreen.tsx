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
} from "./ProfileLinkedUI";

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
        title="Comfort in every detail."
        body="Your device's text, motion and accessibility preferences guide your experience."
      />

      <Card style={{ backgroundColor: "#F7F0FC", paddingHorizontal: 8, paddingVertical: 19 }}>
        <Text style={[S.eyebrow, { paddingHorizontal: 9 }]}>YOUR DEVICE RIGHT NOW</Text>
        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
          {[
            { icon: "text-outline", label: "Text size", value: readiness.fontScaleLabel, detail: fontScale.toFixed(2) + "× scale" },
            { icon: "sparkles-outline", label: "Motion", value: reduceMotion ? "Reduced" : "Standard", detail: "System setting" },
            { icon: "accessibility-outline", label: "Screen reader", value: screenReader ? "Active" : "Off", detail: screenReader ? "Detected" : "Not detected" },
          ].map((item, index) => (
            <React.Fragment key={item.label}>
              {index > 0 && <View style={{ width: 1, marginVertical: 7, backgroundColor: "#E2D3EA" }} />}
              <View style={{ flex: 1, minWidth: 0, alignItems: "center", gap: 5, paddingHorizontal: 6 }}>
                <Icon name={item.icon} color={C.purple} size={23}/>
                <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 12.5, lineHeight: 18, color: C.ink, textAlign: "center" }}>
                  {item.value}
                </Text>
                <Text style={[S.small, { fontSize: 10.5, textAlign: "center" }]}>{item.label}</Text>
                <Text style={[S.small, { fontSize: 9.5, textAlign: "center" }]}>{item.detail}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>
      </Card>

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
