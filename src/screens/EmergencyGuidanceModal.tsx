import React, { useEffect, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { themeBackground, themeBorder, themeForeground } from "../themeColors";
import { Button, C, Card, Icon, S, Txt } from "../ui";
import {
  emergencyWarningSigns,
  safeEmergencyDialNumber,
  strokeBEFAST,
} from "../emergencyGuidanceHelpers";

type EmergencyGuidanceModalProps = {
  visible: boolean;
  emergencyNumber: string;
  canEdit: boolean;
  onClose: () => void;
  onEditNumber: () => void;
  onViewContacts: () => void;
};

export function EmergencyGuidanceModal({
  visible,
  emergencyNumber,
  canEdit,
  onClose,
  onEditNumber,
  onViewContacts,
}: EmergencyGuidanceModalProps) {
  const [callError, setCallError] = useState("");
  const dialNumber = safeEmergencyDialNumber(emergencyNumber);

  useEffect(() => {
    if (visible) setCallError("");
  }, [visible, emergencyNumber]);

  async function openPhoneDialer() {
    if (!dialNumber) return;
    setCallError("");
    try {
      // Explicit user action only: EnVizion NEVER calls or notifies responders automatically.
      await Linking.openURL("tel:" + dialNumber);
    } catch {
      setCallError(
        "The phone dialer could not open. Call your local emergency service directly using a phone.",
      );
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: themeBackground(C.paper) }}>
        <ScrollView
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 38,
            gap: 16,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close emergency guidance"
              onPress={onClose}
              style={({ pressed }) => ({
                width: 46,
                height: 46,
                borderRadius: 23,
                backgroundColor: themeBackground("#F0E5F8"),
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name="arrow-back-outline" color={themeForeground("#7438A8")} size={23} />
            </Pressable>
            <View style={{ flex: 1 }}>
              <Text accessibilityRole="header" style={[S.h2, { fontSize: 23 }]}>
                Emergency help
              </Text>
              <Txt style={S.small}>Know when and how to get urgent help</Txt>
            </View>
          </View>

          <Card style={{
            borderRadius: 25,
            gap: 10,
            borderColor: themeBorder("#E4A9B8"),
            backgroundColor: themeBackground("#FFF0F3"),
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Icon name="alert-circle-outline" color={themeForeground("#B92C55")} size={27} />
              <Text style={[S.h3, { flex: 1, color: themeForeground("#A8284C"), fontSize: 19 }]}>
                In immediate danger?
              </Text>
            </View>
            <Txt style={{ color: themeForeground("#7A344B"), lineHeight: 22 }}>
              Contact local emergency services directly now. Do not wait for an app notification,
              a care-team reply, or this page to load.
            </Txt>
            {dialNumber ? (
              <Button
                title={"Open phone dialer · " + dialNumber}
                icon="call-outline"
                onPress={() => void openPhoneDialer()}
              />
            ) : (
              <>
                <Text style={[S.h3, { fontSize: 14 }]}>
                  No valid emergency service number is saved for this care profile.
                </Text>
                <Txt style={S.small}>
                  Use the emergency number for your location from a trusted source.
                  EnVizion cannot determine or dial it automatically.
                </Txt>
                {canEdit && (
                  <Button
                    title="Add emergency number"
                    icon="create-outline"
                    secondary
                    onPress={onEditNumber}
                  />
                )}
              </>
            )}
            {!!callError && (
              <Text accessibilityRole="alert" style={{ color: themeForeground("#B92C55") }}>
                {callError}
              </Text>
            )}
            <Txt style={{ fontSize: 11, color: themeForeground("#71475C") }}>
              This is guidance only. Opening the dialer does not confirm a call was connected;
              EnVizion does not automatically alert or dispatch emergency responders.
            </Txt>
          </Card>

          <Card style={{
            borderRadius: 25,
            gap: 14,
            backgroundColor: themeBackground("#FCF9FF"),
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Icon name="pulse-outline" size={23} color={themeForeground("#A4366E")} />
              <Text style={[S.h2, { fontSize: 19, flex: 1 }]}>Warning signs</Text>
            </View>
            {emergencyWarningSigns.map((sign) => (
              <View key={sign.title} style={{ flexDirection: "row", gap: 9 }}>
                <Icon name="alert-circle-outline" size={18} color={themeForeground("#B92C55")} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[S.h3, { fontSize: 14 }]}>{sign.title}</Text>
                  <Txt style={[S.small, { lineHeight: 19 }]}>{sign.detail}</Txt>
                </View>
              </View>
            ))}
          </Card>

          <Card style={{
            borderRadius: 25,
            gap: 11,
            backgroundColor: themeBackground("#F7F1FF"),
          }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Icon name="shield-checkmark-outline" size={23} color={themeForeground("#7432AF")} />
              <Text style={[S.h2, { fontSize: 19, flex: 1 }]}>Stroke warning signs</Text>
            </View>
            <Txt style={S.small}>Remember B.E. F.A.S.T. — sudden symptoms are an emergency.</Txt>
            {strokeBEFAST.map((step) => (
              <View key={step.letter} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{
                  width: 35, height: 35, borderRadius: 12,
                  backgroundColor: themeBackground("#E9D8FA"),
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Text style={[S.h3, { color: themeForeground("#7432AF") }]}>
                    {step.letter}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[S.h3, { fontSize: 14 }]}>{step.label}</Text>
                  <Txt style={S.small}>{step.detail}</Txt>
                </View>
              </View>
            ))}
            <Txt style={[S.small, { lineHeight: 19 }]}>
              Call emergency services even if sudden stroke-like symptoms seem to improve.
              Tell responders when the symptoms started, if known.
            </Txt>
          </Card>

          <Card style={{ borderRadius: 25, gap: 9 }}>
            <Text style={[S.h2, { fontSize: 19 }]}>While getting help</Text>
            <Txt>1. Tell the dispatcher the location, symptoms, and when they started.</Txt>
            <Txt>2. Stay with the person when safe and follow the dispatcher's instructions.</Txt>
            <Txt>
              3. If readily available, share allergies, current medications, important conditions,
              and care directives from the verified Emergency summary.
            </Txt>
            <Txt style={S.small}>
              Follow the person's clinician-approved emergency action plan if one is available.
              This general guidance is not a substitute for that plan.
            </Txt>
          </Card>

          <Button
            title="View care contacts"
            icon="people-outline"
            secondary
            onPress={onViewContacts}
          />
          <Button
            title="Back to emergency information"
            icon="arrow-back-outline"
            secondary
            onPress={onClose}
          />
          <Txt style={[S.small, { textAlign: "center", lineHeight: 19 }]}>
            Educational safety guidance only. No diagnosis, emergency monitoring,
            automated call, or emergency dispatch is provided.
          </Txt>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
