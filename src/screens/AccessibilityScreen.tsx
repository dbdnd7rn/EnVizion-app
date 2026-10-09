import React, { useCallback, useEffect, useState } from "react";
import {
  AccessibilityInfo,
  PixelRatio,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { useAppearance } from "../appearance";
import { themeBackground, themeBorder } from "../themeColors";
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
  const { mode, dark, setMode, saveError } = useAppearance();
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
        body="A calmer experience, shaped around the way you like to read and navigate."
      />


      <Section title="Appearance" />
      <Card style={{ padding: 16, gap: 14, backgroundColor: dark ? "#211B30" : "#FFFFFF" }}>
        <View style={{ flexDirection: "row", gap: 11, alignItems: "center" }}>
          <View style={{
            width: 44, height: 44, borderRadius: 16,
            alignItems: "center", justifyContent: "center",
            backgroundColor: dark ? "#39294F" : "#F2E5FC",
          }}>
            <Icon name={dark ? "moon" : "sunny-outline"} color={C.purple} size={23} />
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={S.h3}>Choose your look</Text>
            <Txt style={S.small}>Switch instantly. Your choice is saved on this device.</Txt>
          </View>
        </View>

        <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 10 }}>
          {(["light", "dark"] as const).map((choice) => {
            const selected = mode === choice;
            const isDarkPreview = choice === "dark";
            return (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityLabel={isDarkPreview ? "Dark theme" : "Light theme"}
                accessibilityState={{ selected }}
                accessibilityHint="Change the app's appearance without changing your care records"
                onPress={() => void setMode(choice)}
                style={({ pressed }) => ({
                  flex: 1, minWidth: 0, borderRadius: 20,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? C.purple : C.line,
                  backgroundColor: isDarkPreview ? "#191624" : "#FAF5FF",
                  padding: 10, gap: 10, opacity: pressed ? 0.82 : 1,
                })}
              >
                <View style={{
                  height: 80, borderRadius: 13, overflow: "hidden",
                  backgroundColor: isDarkPreview ? "#2B243A" : "#FFFFFF",
                  borderWidth: 1,
                  borderColor: isDarkPreview ? "#4F3C64" : "#EDE3F4",
                  padding: 10, gap: 7,
                }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <View style={{
                      width: 35, height: 6, borderRadius: 10,
                      backgroundColor: isDarkPreview ? "#D7A8FF" : "#74328F",
                    }} />
                    <View style={{
                      width: 11, height: 11, borderRadius: 6,
                      backgroundColor: isDarkPreview ? "#7E59A1" : "#E0C3F4",
                    }} />
                  </View>
                  <View style={{
                    height: 21, borderRadius: 8,
                    backgroundColor: isDarkPreview ? "#443553" : "#F3E9FC",
                  }} />
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <View style={{
                      flex: 1, height: 15, borderRadius: 6,
                      backgroundColor: isDarkPreview ? "#42324F" : "#EDE1F7",
                    }} />
                    <View style={{
                      flex: 1, height: 15, borderRadius: 6,
                      backgroundColor: isDarkPreview ? "#352B43" : "#F5EEF9",
                    }} />
                  </View>
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Icon
                    name={selected ? "checkmark-circle" : isDarkPreview ? "moon-outline" : "sunny-outline"}
                    color={selected ? (isDarkPreview ? "#D7B0FF" : C.purple) : (isDarkPreview ? "#C1B4D5" : C.muted)}
                    size={17}
                  />
                  <Text style={{
                    fontFamily: "DMSans_700Bold", fontSize: 13,
                    color: isDarkPreview ? "#F7F2FF" : "#201537",
                  }}>
                    {isDarkPreview ? "Dark" : "Light"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
        <Txt style={S.small}>
          {dark
            ? "Dark is on — soft charcoal surfaces, luminous lavender details and comfortable contrast."
            : "Light is on — the original bright lavender design."}
        </Txt>
        {saveError && <Text accessibilityRole="alert" style={{ color: C.rose, fontSize: 12 }}>{saveError}</Text>}
      </Card>

      <Card style={{ backgroundColor: themeBackground("#F7F0FC"), paddingHorizontal: 8, paddingVertical: 19 }}>
        <Text style={[S.eyebrow, { paddingHorizontal: 9 }]}>YOUR DEVICE RIGHT NOW</Text>
        <View style={{ flexDirection: "row", alignItems: "stretch" }}>
          {[
            { icon: "text-outline", label: "Text size", value: readiness.fontScaleLabel, detail: fontScale.toFixed(2) + "× scale" },
            { icon: "sparkles-outline", label: "Motion", value: reduceMotion ? "Reduced" : "Standard", detail: "System setting" },
            { icon: "accessibility-outline", label: "Screen reader", value: screenReader ? "Active" : "Off", detail: screenReader ? "Detected" : "Not detected" },
          ].map((item, index) => (
            <React.Fragment key={item.label}>
              {index > 0 && <View style={{ width: 1, marginVertical: 7, backgroundColor: themeBorder("#E2D3EA") }} />}
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
        <Text style={S.h3}>Device accessibility settings remain in control.</Text>
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
