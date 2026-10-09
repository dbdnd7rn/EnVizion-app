import { themeTint } from "../themeColors";
import { themeBackground, themeForeground, themeBorder, themeShadow, themeAction } from "../themeColors";
import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Keyboard, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import Svg, { Circle, Defs, Ellipse, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import { useCare } from "../store";
import {
  loadCareAccessRecertificationAttention,
  loadCareInvitationAttention,
  loadCareSpaces,
  setActiveCareRecipient,
  type CareAccessRecertificationAttention,
  type CareInvitationAttention,
  type CareSpace,
} from "../careTeam";
import { loadPublishedGuides, type ClinicalContentRecord } from "../clinicalContent";
import { NotificationBell } from "../notifications";
import { ProfileAvatar } from "../profileAvatar";
import { findCareTools, type CareToolScope, type CareToolSort } from "../careToolSearch";
import { CareToolFilters } from "./CareToolFilters";
import {
  loadToolPreferences,
  recordToolUse,
  togglePinnedTool,
  withRecordedUse,
  withToggledPin,
  type ToolPreferences,
} from "../toolPreferences";
import {
  Brand,
  Button,
  C,
  Card,
  Fade,
  Heading,
  Icon,
  HomeLandscape,
  Landscape,
  Page,
  Row,
  S,
  Safety,
  Section,
  Txt,
} from "../ui";
export const useNav = () =>
  useNavigation<NativeStackNavigationProp<RootStack>>();
function HomeReveal({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) {
        opacity.setValue(1);
        translateY.setValue(0);
        return;
      }

      animation = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 430,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 430,
          delay,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: Platform.OS !== "web",
        }),
      ]);
      animation.start();
    });

    return () => {
      active = false;
      animation?.stop();
    };
  }, [delay, opacity, translateY]);

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

function HomeFloat({
  children,
  distance = 5,
  duration = 1800,
}: {
  children: React.ReactNode;
  distance?: number;
  duration?: number;
}) {
  const y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let active = true;
    let loop: Animated.CompositeAnimation | null = null;

    AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) return;

      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(y, {
            toValue: -distance,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== "web",
          }),
          Animated.timing(y, {
            toValue: 0,
            duration,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: Platform.OS !== "web",
          }),
        ]),
      );
      loop.start();
    });

    return () => {
      active = false;
      loop?.stop();
    };
  }, [distance, duration, y]);

  return (
    <Animated.View style={{ transform: [{ translateY: y }] }}>
      {children}
    </Animated.View>
  );
}

export function HomeScreen() {
  const n = useNav();
  const { state, refresh: refreshCare } = useCare();
  const [careSpaces, setCareSpaces] = useState<CareSpace[]>([]);
  const [invitationAttention, setInvitationAttention] =
    useState<CareInvitationAttention | null>(null);
  const [recertificationAttention, setRecertificationAttention] =
    useState<CareAccessRecertificationAttention | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switchingCareId, setSwitchingCareId] = useState<string | null>(null);
  const { width: windowWidth } = useWindowDimensions();
  const compact = windowWidth < 430;
  const contentWidth = Math.min(Math.max(windowWidth - 40, 280), 440);
  const heroTextWidth = Math.min(compact ? 215 : 255, contentWidth * 0.62);
  const heroArtLeft = Math.max(contentWidth * 0.50, compact ? 178 : 205);

  const logged = state.entries.length > 0;
  const doseRecorded = state.medicationRecords.some(
    (record) => !record.correctedAt,
  );
  const attentionCount =
    Number(!logged) +
    Number(state.medications.length > 0 && !doseRecorded);
  const upcomingCount = state.appointment.date.trim() ? 1 : 0;
  const coordinationCount = Number(!state.careRecipientId);
  const fullName = state.name.trim() || "Caregiver";
  const displayName = fullName.split(/\s+/)[0];

  useEffect(() => {
    let active = true;

    loadCareSpaces()
      .then((spaces) => {
        if (active) setCareSpaces(spaces);
      })
      .catch(() => {
        if (active) setCareSpaces([]);
      });

    return () => {
      active = false;
    };
  }, [state.careRecipientId]);

  useEffect(() => {
    let active = true;

    if (!state.careRecipientId || state.accessRole !== "owner") {
      setInvitationAttention(null);
      setRecertificationAttention(null);
      return () => {
        active = false;
      };
    }

    Promise.all([
      loadCareInvitationAttention(state.careRecipientId),
      loadCareAccessRecertificationAttention(state.careRecipientId),
    ])
      .then(([invitationSummary, recertificationSummary]) => {
        if (!active) return;
        setInvitationAttention(invitationSummary);
        setRecertificationAttention(recertificationSummary);
      })
      .catch(() => {
        if (!active) return;
        setInvitationAttention(null);
        setRecertificationAttention(null);
      });

    return () => {
      active = false;
    };
  }, [state.accessRole, state.careRecipientId]);

  const activeSpace =
    careSpaces.find((space) => space.active) ??
    careSpaces.find((space) => space.careRecipientId === state.careRecipientId) ??
    null;

  async function switchCareSpace(space: CareSpace) {
    if (space.active || switchingCareId) {
      setSwitcherOpen(false);
      return;
    }

    setSwitchingCareId(space.careRecipientId);
    try {
      await setActiveCareRecipient(space.careRecipientId);
      await refreshCare();
      const spaces = await loadCareSpaces();
      setCareSpaces(spaces);
      setSwitcherOpen(false);
    } finally {
      setSwitchingCareId(null);
    }
  }

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const priority =
    !state.careRecipientId
      ? {
          title: "Set up shared care",
          body: "Create or join a care profile so your care team stays connected.",
          icon: "people-outline",
          onPress: () => n.navigate("CareTeam"),
        }
      : !logged
        ? {
            title: "Start today’s check-in",
            body: "Record what you’re noticing today so the care team has the full picture.",
            icon: "document-text-outline",
            onPress: () => n.navigate("Tracker", { kind: "Vitals" }),
          }
        : {
            title: "Review today’s care",
            body: "See what matters next across your care plan, tasks, and appointments.",
            icon: "checkmark-circle-outline",
            onPress: () => n.navigate("CarePlan"),
          };

  return (
    <Page>
      <View style={{ gap: 19 }}>
        <HomeReveal>
          <View style={S.between}>
            <Brand />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <NotificationBell onPress={() => n.navigate("Notifications")} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open your profile"
                onPress={() => n.navigate("Profile")}
                style={({ pressed }) => ({
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: themeBackground("#F1E8F8"),
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.72 : 1,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <ProfileAvatar name={fullName} size={42} />
              </Pressable>
            </View>
          </View>
        </HomeReveal>

        {state.careRecipientId && (
          <HomeReveal delay={35}>
            <View style={{ gap: 8 }}>
              <Text
                style={[
                  S.eyebrow,
                  {
                    color: themeForeground("#8C8290"),
                    fontSize: 10,
                    letterSpacing: 2.2,
                    marginLeft: 2,
                  },
                ]}
              >
                {state.careMode === "self" ? "MY CARE PROFILE" : "CARING FOR"}
              </Text>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  careSpaces.length > 1
                    ? `Switch care profile. Currently ${state.careRecipientName}`
                    : `Open care team for ${state.careRecipientName}`
                }
                onPress={() => {
                  if (careSpaces.length > 1) {
                    setSwitcherOpen((value) => !value);
                  } else {
                    n.navigate("CareTeam");
                  }
                }}
                style={({ pressed }) => ({
                  minHeight: 68,
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: switcherOpen ? "#CAB1D6" : "#E9E1EB",
                  backgroundColor: switcherOpen ? "#F8F2FA" : C.white,
                  paddingHorizontal: 15,
                  paddingVertical: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 16,
                    backgroundColor:
                      state.careMode === "self" ? "#FCEAF1" : "#EEE3F4",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={state.careMode === "self" ? "person-outline" : "heart-outline"}
                    size={23}
                    color={state.careMode === "self" ? "#B13D70" : C.purple}
                  />
                </View>

                <View style={{ flex: 1, gap: 2 }}>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: "DMSans_700Bold",
                      fontSize: 17,
                      color: themeForeground("#211B2C"),
                    }}
                  >
                    {state.careRecipientName || "Care profile"}
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={{
                      fontFamily: "DMSans_400Regular",
                      fontSize: 12.5,
                      color: themeForeground("#817789"),
                    }}
                  >
                    {state.careMode === "self"
                      ? "Your personal care space"
                      : activeSpace?.relationship || state.relationship}
                  </Text>
                </View>

                <View
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 13,
                    backgroundColor: themeBackground("#F4EDF7"),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={
                      careSpaces.length > 1
                        ? switcherOpen
                          ? "chevron-up"
                          : "chevron-down"
                        : "people-outline"
                    }
                    size={18}
                    color={C.purple}
                  />
                </View>
              </Pressable>

              {switcherOpen && careSpaces.length > 1 && (
                <Card style={{ gap: 7, padding: 9, backgroundColor: themeBackground("#FFFEFF") }}>
                  {careSpaces.map((space) => {
                    const selected =
                      space.active ||
                      space.careRecipientId === state.careRecipientId;
                    return (
                      <Pressable
                        key={space.careRecipientId}
                        disabled={switchingCareId !== null}
                        accessibilityRole="button"
                        accessibilityLabel={
                          selected
                            ? `${space.careRecipientName}, current care profile`
                            : `Switch to ${space.careRecipientName}`
                        }
                        onPress={() => void switchCareSpace(space)}
                        style={({ pressed }) => ({
                          minHeight: 58,
                          borderRadius: 17,
                          paddingHorizontal: 11,
                          paddingVertical: 9,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          backgroundColor: selected ? "#F4EBF8" : "transparent",
                          opacity:
                            switchingCareId === space.careRecipientId
                              ? 0.55
                              : pressed
                                ? 0.7
                                : 1,
                        })}
                      >
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 13,
                            backgroundColor: selected ? "#E8D8F0" : "#F4F0F5",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Text
                            style={{
                              fontFamily: "DMSans_700Bold",
                              color: C.purple,
                              fontSize: 15,
                            }}
                          >
                            {space.careRecipientName.slice(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[S.h3, { fontSize: 14.5 }]}>
                            {space.careRecipientName}
                          </Text>
                          <Text style={S.small}>
                            {space.relationship} · {space.role === "owner" ? "Primary Advocate" : space.role === "caregiver" ? "Caregiver" : space.role === "patient" ? "Care Recipient" : "Family Member"}
                          </Text>
                        </View>
                        {selected && (
                          <Icon
                            name="checkmark-circle"
                            size={20}
                            color={C.purple}
                          />
                        )}
                      </Pressable>
                    );
                  })}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Manage care profiles and sharing"
                    onPress={() => n.navigate("CareTeam")}
                    style={({ pressed }) => ({
                      minHeight: 44,
                      borderRadius: 14,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 7,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Icon name="settings-outline" size={17} color={C.purple} />
                    <Text
                      style={{
                        fontFamily: "DMSans_600SemiBold",
                        fontSize: 12.5,
                        color: C.purple,
                      }}
                    >
                      Manage care profiles
                    </Text>
                  </Pressable>
                </Card>
              )}
            </View>
          </HomeReveal>
        )}

        {recertificationAttention &&
          recertificationAttention.needsAttention > 0 && (
            <HomeReveal delay={48}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${recertificationAttention.needsAttention} care access review${recertificationAttention.needsAttention === 1 ? "" : "s"} need attention`}
                onPress={() => n.navigate("CareAccessRecertification")}
                style={({ pressed }) => ({
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor:
                    recertificationAttention.overdue14 > 0
                      ? "#E9BFB2"
                      : recertificationAttention.due > 0
                        ? "#E4D3B1"
                        : "#D9D1E4",
                  backgroundColor:
                    recertificationAttention.overdue14 > 0
                      ? "#FFF5F1"
                      : recertificationAttention.due > 0
                        ? "#FFFAF0"
                        : "#FAF7FC",
                  paddingHorizontal: 15,
                  paddingVertical: 14,
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 15,
                    backgroundColor:
                      recertificationAttention.overdue14 > 0
                        ? "#FBE3DA"
                        : recertificationAttention.due > 0
                          ? "#F7ECD7"
                          : "#EFE7F5",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={
                      recertificationAttention.overdue14 > 0
                        ? "alert-circle-outline"
                        : recertificationAttention.due > 0
                          ? "shield-outline"
                          : "calendar-outline"
                    }
                    size={22}
                    color={
                      recertificationAttention.overdue14 > 0
                        ? "#B55235"
                        : recertificationAttention.due > 0
                          ? "#906622"
                          : C.purple
                    }
                  />
                </View>

                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={[
                      S.eyebrow,
                      {
                        color:
                          recertificationAttention.overdue14 > 0
                            ? "#A44E36"
                            : recertificationAttention.due > 0
                              ? "#8A6530"
                              : C.purple,
                      },
                    ]}
                  >
                    ACCESS REVIEW
                  </Text>
                  <Text style={[S.h3, { fontSize: 14.5 }]}>
                    {recertificationAttention.overdue14 > 0
                      ? `${recertificationAttention.overdue14} review${recertificationAttention.overdue14 === 1 ? "" : "s"} overdue 14+ days`
                      : recertificationAttention.due > 0
                        ? `${recertificationAttention.due} 90-day review${recertificationAttention.due === 1 ? "" : "s"} due`
                        : `${recertificationAttention.upcoming7} review${recertificationAttention.upcoming7 === 1 ? "" : "s"} due within 7 days`}
                  </Text>
                  <Txt style={S.small}>
                    {recertificationAttention.next
                      ? recertificationAttention.next.isDue
                        ? `${recertificationAttention.next.displayName} · ${recertificationAttention.next.overdueDays > 0 ? `${recertificationAttention.next.overdueDays} days overdue` : "review due now"}`
                        : `${recertificationAttention.next.displayName} · due ${new Date(recertificationAttention.next.dueAt).toLocaleDateString()}`
                      : "Open the 90-day access review center."}
                  </Txt>
                </View>

                <Icon name="chevron-forward" size={20} color={C.purple} />
              </Pressable>
            </HomeReveal>
          )}

        {invitationAttention &&
          invitationAttention.needsAttention > 0 && (
            <HomeReveal delay={50}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${invitationAttention.needsAttention} care invitation${invitationAttention.needsAttention === 1 ? "" : "s"} need attention`}
                onPress={() => n.navigate("CareTeam")}
                style={({ pressed }) => ({
                  borderRadius: 22,
                  borderWidth: 1,
                  borderColor: invitationAttention.expired
                    ? "#F2C7B7"
                    : "#E3D2B8",
                  backgroundColor: invitationAttention.expired
                    ? "#FFF7F2"
                    : "#FFFAF1",
                  paddingHorizontal: 15,
                  paddingVertical: 14,
                  flexDirection: "row",
                  gap: 12,
                  alignItems: "center",
                  opacity: pressed ? 0.78 : 1,
                })}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 15,
                    backgroundColor: invitationAttention.expired
                      ? "#FCE5DA"
                      : "#F8ECD9",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon
                    name={
                      invitationAttention.expired
                        ? "alert-circle-outline"
                        : "time-outline"
                    }
                    size={22}
                    color={invitationAttention.expired ? "#B95734" : "#946B24"}
                  />
                </View>

                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[S.eyebrow, { color: themeForeground("#8A6530") }]}>
                    CARE TEAM NEEDS ATTENTION
                  </Text>
                  <Text style={[S.h3, { fontSize: 14.5 }]}>
                    {invitationAttention.expired
                      ? `${invitationAttention.expired} invitation${invitationAttention.expired === 1 ? "" : "s"} expired`
                      : `${invitationAttention.nearExpiry} invitation${invitationAttention.nearExpiry === 1 ? "" : "s"} expiring soon`}
                  </Text>
                  <Txt style={S.small}>
                    {invitationAttention.next
                      ? `${invitationAttention.next.displayName} · ${invitationAttention.next.isExpired ? "re-open invitation" : "expires within 48 hours"}`
                      : "Open Care Team to review pending invitations."}
                  </Txt>
                </View>

                <Icon name="chevron-forward" size={20} color={C.purple} />
              </Pressable>
            </HomeReveal>
          )}

        <HomeReveal delay={65}>
          <View
            style={{
              position: "relative",
              minHeight: 224,
              borderRadius: 30,
              overflow: "hidden",
              backgroundColor: themeBackground("#FFFDFC"),
              marginHorizontal: -2,
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: heroArtLeft,
                right: -20,
                bottom: -4,
                opacity: 0.94,
              }}
            >
              <HomeFloat distance={4} duration={3300}>
                <HomeLandscape height={190} />
              </HomeFloat>
            </View>

            <View
              style={{
                gap: 8,
                paddingTop: 7,
                paddingHorizontal: 4,
                maxWidth: heroTextWidth,
              }}
            >
              <Text
                style={[
                  S.eyebrow,
                  { color: themeForeground("#7A3F96"), fontSize: 11, letterSpacing: 2.8 },
                ]}
              >
                {state.careMode === "self" ? "YOUR CARE DASHBOARD" : "YOUR CARE COMPANION"}
              </Text>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: compact ? 36 : 40,
                  lineHeight: compact ? 42 : 47,
                  letterSpacing: -1.15,
                  color: themeForeground("#17153A"),
                }}
              >
                {greeting},{"\n"}{displayName}.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 18,
                  lineHeight: 25,
                  color: themeForeground("#77758B"),
                  maxWidth: heroTextWidth,
                }}
              >
                {state.careMode === "self"
                  ? "Your health, appointments, and next steps in one calm place."
                  : "Here for a calmer, more confident day of care."}
              </Text>
            </View>
          </View>
        </HomeReveal>

        <HomeReveal delay={120}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={priority.title}
            onPress={priority.onPress}
            style={({ pressed }) => ({
              position: "relative",
              overflow: "hidden",
              borderRadius: 28,
              backgroundColor: themeBackground("#63307D"),
              paddingHorizontal: 23,
              paddingVertical: 22,
              minHeight: 205,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.988 : 1 }],
              shadowColor: themeShadow("#5A246C"),
              shadowOpacity: 0.2,
              shadowRadius: 20,
              shadowOffset: { width: 0, height: 10 },
              elevation: 5,
            })}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 240,
                height: 240,
                borderRadius: 120,
                right: -104,
                top: -124,
                backgroundColor: themeBackground("#FFFFFF0C"),
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 154,
                height: 154,
                borderRadius: 77,
                right: 52,
                bottom: -105,
                backgroundColor: themeBackground("#FFFFFF0A"),
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 78,
                height: 78,
                borderRadius: 39,
                left: -22,
                bottom: -28,
                backgroundColor: themeBackground("#B277CA17"),
              }}
            />

            <Text
              style={[
                S.eyebrow,
                {
                  color: themeForeground("#F1DAF7"),
                  fontSize: 11,
                  letterSpacing: 2.8,
                  marginBottom: 14,
                },
              ]}
            >
              YOUR NEXT STEP
            </Text>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text
                  style={{
                    fontFamily: "DMSans_700Bold",
                    fontSize: 31,
                    lineHeight: 37,
                    letterSpacing: -0.65,
                    color: C.white,
                    maxWidth: 240,
                  }}
                >
                  {priority.title}
                </Text>
                <Text
                  style={{
                    fontFamily: "DMSans_400Regular",
                    fontSize: 15,
                    lineHeight: 22,
                    color: themeForeground("#EEE2F2"),
                    maxWidth: 258,
                  }}
                >
                  {priority.body}
                </Text>
              </View>

              <View style={{ width: 76, alignItems: "center", gap: 17 }}>
                <HomeFloat distance={6} duration={1550}>
                  <View
                    style={{
                      width: 72,
                      height: 72,
                      borderRadius: 23,
                      backgroundColor: themeBackground("#F7EDFB"),
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ rotate: "4deg" }],
                    }}
                  >
                    <Icon name={priority.icon} size={35} color={themeForeground("#9B58B3")} />
                  </View>
                </HomeFloat>
                <View
                  style={{
                    width: 53,
                    height: 53,
                    borderRadius: 27,
                    backgroundColor: themeBackground(C.white),
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: themeShadow("#2A1831"),
                    shadowOpacity: 0.08,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 2,
                  }}
                >
                  <Icon name="arrow-forward" size={25} color={themeForeground("#6E3288")} />
                </View>
              </View>
            </View>
          </Pressable>
        </HomeReveal>

        <HomeReveal delay={175}>
          <Card
            style={{
              borderRadius: 25,
              padding: 15,
              gap: 13,
              backgroundColor: themeBackground("#FBF8FD"),
              borderColor: themeBorder("#EDE4F1"),
            }}
          >
            <View style={S.between}>
              <Text
                style={[
                  S.eyebrow,
                  { color: themeForeground("#72408F"), fontSize: 10.5, letterSpacing: 2.4 },
                ]}
              >
                TODAY AT A GLANCE
              </Text>
              <Text style={[S.small, { color: themeForeground("#80758B") }]}>
                From your care records
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 8 }}>
              <HomeStat
                icon="alert-circle-outline"
                iconColor="#C53E6E"
                iconBackground="#FFF0F4"
                value={attentionCount}
                label="Needs attention"
              />
              <HomeStat
                icon="calendar-outline"
                iconColor="#74328F"
                iconBackground="#F1E9FA"
                value={upcomingCount}
                label="Upcoming visits"
              />
              <HomeStat
                icon="people-outline"
                iconColor="#74328F"
                iconBackground="#F1E9FA"
                value={coordinationCount}
                label="Coordination"
              />
            </View>
          </Card>
        </HomeReveal>

        <HomeReveal delay={230}>
          <View style={{ gap: 13 }}>
            <Section
              title="Quick actions"
              action="See all tools"
              onPress={() => n.navigate("Main", { screen: "Toolkit" })}
            />

            <View style={{ flexDirection: "row", gap: 8 }}>
              {logged && (
                <HomeActionCard
                  title="Check-in"
                  subtitle="Record health"
                  icon="pulse-outline"
                  background="#F6F0FB"
                  iconBackground="#EEE5F8"
                  onPress={() => n.navigate("Tracker", { kind: "Vitals" })}
                />
              )}
              <HomeActionCard
                title="Medications"
                subtitle="Open log"
                icon="medical-outline"
                background="#FFF1F5"
                iconBackground="#FFE4EC"
                iconColor="#C43873"
                onPress={() => n.navigate("Medications")}
              />
              <HomeActionCard
                title="Calendar"
                subtitle="Visits & tasks"
                icon="calendar-outline"
                background="#F6F0FB"
                iconBackground="#EEE5F8"
                onPress={() => n.navigate("CareCalendar")}
              />
              {!logged && (
                <HomeActionCard
                  title="Care plan"
                  subtitle="See today"
                  icon="document-text-outline"
                  background="#FFF3F1"
                  iconBackground="#FFE8E5"
                  iconColor="#C64D69"
                  onPress={() => n.navigate("CarePlan")}
                />
              )}
            </View>
          </View>
        </HomeReveal>

        <HomeReveal delay={340}>
          <Card
            style={{
              position: "relative",
              overflow: "hidden",
              minHeight: 146,
              borderRadius: 25,
              padding: 20,
              backgroundColor: themeBackground("#FFFDFD"),
              borderColor: themeBorder("#F0E9ED"),
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: 178,
                right: -42,
                bottom: -25,
                opacity: 0.62,
              }}
            >
              <HomeFloat distance={3} duration={3600}>
                <HomeLandscape height={116} />
              </HomeFloat>
            </View>
            <View style={{ maxWidth: 275, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="heart" color={themeForeground("#EF8FA9")} size={18} />
                <Text
                  style={[
                    S.eyebrow,
                    { color: themeForeground("#824A9D"), fontSize: 10, letterSpacing: 2.1 },
                  ]}
                >
                  YOU’RE MAKING A DIFFERENCE
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 21,
                  lineHeight: 28,
                  color: themeForeground("#18163C"),
                }}
              >
                “Small steps today{"\n"}create brighter tomorrows.”
              </Text>
            </View>
          </Card>
        </HomeReveal>
      </View>
    </Page>
  );
}

function HomeStat({
  icon,
  iconColor,
  iconBackground,
  value,
  label,
}: {
  icon: string;
  iconColor: string;
  iconBackground: string;
  value: number;
  label: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: 19,
        paddingHorizontal: 9,
        paddingVertical: 12,
        backgroundColor: themeBackground(C.white),
        gap: 7,
        borderWidth: 1,
        borderColor: themeBorder("#F1EBF3"),
      }}
    >
      <View
        style={{
          width: 35,
          height: 35,
          borderRadius: 13,
          backgroundColor: iconBackground,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <Text
        style={{
          fontFamily: "DMSans_700Bold",
          fontSize: 21,
          lineHeight: 25,
          color: themeForeground("#18163C"),
        }}
      >
        {value}
      </Text>
      <Text
        numberOfLines={2}
        style={{
          fontFamily: "DMSans_400Regular",
          fontSize: 10.5,
          lineHeight: 14,
          color: themeForeground("#77758B"),
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function HomeActionCard({
  title,
  subtitle,
  icon,
  background,
  iconBackground,
  iconColor = "#74328F",
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  background: string;
  iconBackground: string;
  iconColor?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 122,
        borderRadius: 21,
        backgroundColor: background,
        paddingHorizontal: 9,
        paddingVertical: 11,
        gap: 8,
        borderWidth: 1,
        borderColor: themeBorder("#EEE7F0"),
        opacity: pressed ? 0.76 : 1,
        transform: [{ scale: pressed ? 0.965 : 1 }],
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 15,
          backgroundColor: iconBackground,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={22} color={iconColor} />
      </View>
      <View style={{ gap: 2 }}>
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          style={{
            fontFamily: "DMSans_600SemiBold",
            fontSize: 12.5,
            lineHeight: 17,
            color: themeForeground("#18163C"),
          }}
        >
          {title}
        </Text>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: "DMSans_400Regular",
            fontSize: 10,
            lineHeight: 13,
            color: themeForeground("#77758B"),
          }}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
}

function ToolkitWave({ tint = "#F4ECFB" }: { tint?: string }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        right: -26,
        bottom: -30,
        width: 190,
        height: 118,
        opacity: 0.72,
      }}
    >
      <Svg width="100%" height="100%" viewBox="0 0 190 118">
        <Path
          d="M8 118 C54 86 72 36 190 10 L190 118 Z"
          fill={tint}
          opacity="0.75"
        />
        <Path
          d="M54 118 C99 91 113 66 190 48 L190 118 Z"
          fill={themeTint("#FBF8FE")}
          opacity="0.88"
        />
      </Svg>
    </View>
  );
}

function ToolkitHeroGraphic() {
  return (
    <View style={{ width: 176, height: 156 }}>
      <View
        style={{
          position: "absolute",
          width: 96,
          height: 96,
          borderRadius: 48,
          right: 2,
          top: 0,
          backgroundColor: themeBackground("#EEE4FB"),
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 74,
          height: 74,
          borderRadius: 37,
          left: 9,
          bottom: 8,
          backgroundColor: themeBackground("#FBECEE"),
        }}
      />
      <View
        style={{
          position: "absolute",
          width: 112,
          height: 112,
          borderRadius: 56,
          right: 0,
          top: 28,
          borderWidth: 2,
          borderStyle: "dotted",
          borderColor: themeBorder("#B998F2"),
          opacity: 0.9,
        }}
      />

      <HomeFloat distance={5} duration={2500}>
        <View
          style={{
            position: "absolute",
            right: 32,
            top: 18,
            width: 94,
            height: 94,
            borderRadius: 26,
            backgroundColor: themeBackground("#F7F1FF"),
            borderWidth: 1,
            borderColor: themeBorder("#ECE2F6"),
            alignItems: "center",
            justifyContent: "center",
            transform: [{ rotate: "-10deg" }],
            shadowColor: themeShadow("#6F4D8A"),
            shadowOpacity: 0.08,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
          }}
        >
          <Icon name="heart-outline" size={44} color={themeForeground("#8739B2")} />
          <View
            style={{
              position: "absolute",
              top: 13,
              right: 27,
              width: 4,
              height: 14,
              borderRadius: 2,
              backgroundColor: themeBackground("#A75BCE"),
              transform: [{ rotate: "18deg" }],
            }}
          />
          <View
            style={{
              position: "absolute",
              top: 20,
              right: 14,
              width: 13,
              height: 4,
              borderRadius: 2,
              backgroundColor: themeBackground("#A75BCE"),
              transform: [{ rotate: "20deg" }],
            }}
          />
        </View>
      </HomeFloat>

      <HomeFloat distance={3} duration={2050}>
        <View
          style={{
            position: "absolute",
            left: 23,
            bottom: 20,
            width: 57,
            height: 57,
            borderRadius: 17,
            backgroundColor: themeBackground("#F4EEFF"),
            borderWidth: 1,
            borderColor: themeBorder("#E9DFF3"),
            alignItems: "center",
            justifyContent: "center",
            transform: [{ rotate: "8deg" }],
          }}
        >
          <Icon name="calendar-outline" size={27} color={themeForeground("#8739B2")} />
        </View>
      </HomeFloat>

      <HomeFloat distance={4} duration={2300}>
        <View
          style={{
            position: "absolute",
            right: 1,
            bottom: 9,
            width: 58,
            height: 58,
            borderRadius: 17,
            backgroundColor: themeBackground("#FFF2F1"),
            borderWidth: 1,
            borderColor: themeBorder("#F4DFE2"),
            alignItems: "center",
            justifyContent: "center",
            transform: [{ rotate: "10deg" }],
          }}
        >
          <Icon name="checkbox-outline" size={28} color={themeForeground("#B34B83")} />
        </View>
      </HomeFloat>
    </View>
  );
}

function QuickCard({
  title,
  subtitle,
  icon,
  onPress,
}: {
  title: string;
  subtitle: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 130,
        borderRadius: 24,
        overflow: "hidden",
        padding: 16,
        backgroundColor: themeBackground("#FFFFFF"),
        borderWidth: 1,
        borderColor: themeBorder("#EDE6F1"),
        shadowColor: themeShadow("#43324E"),
        shadowOpacity: 0.035,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 7 },
        elevation: 2,
        opacity: pressed ? 0.76 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <ToolkitWave />
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 18,
          backgroundColor: themeBackground("#F4ECFB"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={27} color={themeForeground("#8233A6")} />
      </View>

      <View style={{ marginTop: 18, gap: 4 }}>
        <Text
          style={{
            fontFamily: "DMSans_700Bold",
            fontSize: 17,
            color: themeForeground("#15153D"),
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontFamily: "DMSans_400Regular",
            fontSize: 13,
            lineHeight: 18,
            color: themeForeground("#817B91"),
          }}
        >
          {subtitle}
        </Text>
      </View>

      <View
        style={{
          position: "absolute",
          right: 15,
          bottom: 17,
          width: 34,
          height: 34,
          borderRadius: 17,
          backgroundColor: themeBackground("#F3EBFA"),
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="chevron-forward" color={themeForeground("#7F2FA1")} size={18} />
      </View>
    </Pressable>
  );
}

type ToolItem = {
  title: string;
  subtitle: string;
  icon: string;
  keywords?: string;
  onPress: () => void;
};

function ToolItemRow({
  item,
  pinned,
  onOpen,
  onTogglePin,
}: {
  item: ToolItem;
  pinned: boolean;
  onOpen: (item: ToolItem) => void;
  onTogglePin: (title: string) => void;
}) {
  return (
    <View
      style={{
        minHeight: 104,
        borderRadius: 24,
        overflow: "hidden",
        backgroundColor: themeBackground("#FFFFFF"),
        borderWidth: 1,
        borderColor: themeBorder("#ECE6F0"),
        flexDirection: "row",
        alignItems: "stretch",
        shadowColor: themeShadow("#44334E"),
        shadowOpacity: 0.035,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 7 },
        elevation: 2,
      }}
    >
      <ToolkitWave tint="#F7F0FD" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle}`}
        onPress={() => onOpen(item)}
        style={({ pressed }) => ({
          flex: 1,
          paddingHorizontal: 14,
          paddingVertical: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 18,
            backgroundColor: themeBackground("#F3EAFB"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={item.icon} size={27} color={themeForeground("#8233A6")} />
        </View>

        <View style={{ flex: 1, gap: 5 }}>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 15.5,
              lineHeight: 20,
              color: themeForeground("#15153D"),
            }}
          >
            {item.title}
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 12.5,
              lineHeight: 18,
              color: themeForeground("#7E788F"),
            }}
          >
            {item.subtitle}
          </Text>
        </View>

        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: themeBackground("#F4ECFB"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name="chevron-forward" color={themeForeground("#7F2FA1")} size={18} />
        </View>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
        accessibilityState={{ selected: pinned }}
        onPress={() => onTogglePin(item.title)}
        style={({ pressed }) => ({
          width: 55,
          borderLeftWidth: 1,
          borderLeftColor: themeBorder("#EEE8F1"),
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: pinned ? "#FBF7FD" : "transparent",
          opacity: pressed ? 0.6 : 1,
        })}
      >
        <Icon
          name={pinned ? "star" : "star-outline"}
          color={pinned ? "#8D3CAA" : "#7D7B95"}
          size={25}
        />
      </Pressable>
    </View>
  );
}

function ToolGroup({
  title,
  subtitle,
  icon,
  items,
  preferences,
  onOpenTool,
  onTogglePin,
  defaultOpen = false,
}: {
  title: string;
  subtitle: string;
  icon: string;
  items: ToolItem[];
  preferences: ToolPreferences;
  onOpenTool: (item: ToolItem) => void;
  onTogglePin: (title: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const turn = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(turn, {
      toValue: open ? 1 : 0,
      damping: 16,
      stiffness: 170,
      mass: 0.7,
      useNativeDriver: Platform.OS !== "web",
    }).start();
  }, [open, turn]);

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}. ${subtitle}`}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => ({
          minHeight: 116,
          borderRadius: 25,
          overflow: "hidden",
          backgroundColor: themeBackground("#FFFFFF"),
          borderWidth: 1,
          borderColor: themeBorder("#ECE6F0"),
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 15,
          gap: 15,
          shadowColor: themeShadow("#44334E"),
          shadowOpacity: 0.035,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 7 },
          elevation: 2,
          opacity: pressed ? 0.77 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        })}
      >
        <ToolkitWave />
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 19,
            backgroundColor: themeBackground("#F3EAFB"),
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} size={29} color={themeForeground("#8233A6")} />
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 18,
              lineHeight: 22,
              color: themeForeground("#15153D"),
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 13,
              lineHeight: 19,
              color: themeForeground("#7D788F"),
            }}
          >
            {subtitle}
          </Text>
        </View>

        <Animated.View
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: themeBackground("#F3EBFA"),
            alignItems: "center",
            justifyContent: "center",
            transform: [
              {
                rotate: turn.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", "180deg"],
                }),
              },
            ],
          }}
        >
          <Icon name="chevron-down" color={themeForeground("#7F2FA1")} size={20} />
        </Animated.View>
      </Pressable>

      {open && (
        <Fade>
          <View style={{ gap: 10 }}>
            {items.map((item) => (
              <ToolItemRow
                key={item.title}
                item={item}
                pinned={preferences.pinned.includes(item.title)}
                onOpen={onOpenTool}
                onTogglePin={onTogglePin}
              />
            ))}
          </View>
        </Fade>
      )}
    </View>
  );
}

export function ToolkitScreen() {
  const n = useNav();
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scope, setScope] = useState<CareToolScope>("all");
  const [sort, setSort] = useState<CareToolSort>("relevance");
  const [preferences, setPreferences] = useState<ToolPreferences>({
    pinned: [],
    recent: [],
    usage: {},
  });

  useEffect(() => {
    let active = true;
    loadToolPreferences().then((saved) => {
      if (active) setPreferences(saved);
    });
    return () => {
      active = false;
    };
  }, []);

  const groups: Array<{
    title: string;
    subtitle: string;
    icon: string;
    items: ToolItem[];
  }> = [
    {
      title: "Daily care",
      subtitle: "Check-ins, observations, summaries, and trends",
      icon: "pulse-outline",
      items: [
        {
          title: "Vitals",
          subtitle: "Blood pressure, pulse, and temperature",
          icon: "pulse-outline",
          keywords: "health check in blood pressure temperature",
          onPress: () => n.navigate("Tracker", { kind: "Vitals" }),
        },
        {
          title: "Blood sugar",
          subtitle: "Record a reading and its context",
          icon: "water-outline",
          keywords: "glucose diabetes health check in",
          onPress: () => n.navigate("Tracker", { kind: "Blood sugar" }),
        },
        {
          title: "CHF symptoms",
          subtitle: "Weight, breathing, and swelling",
          icon: "heart-outline",
          keywords: "heart failure breathing swelling weight",
          onPress: () => n.navigate("Tracker", { kind: "CHF symptoms" }),
        },
        {
          title: "Behavior & delirium monitoring",
          subtitle: "Notice changes from their usual self",
          icon: "flower-outline",
          keywords: "memory behavior confusion delirium",
          onPress: () => n.navigate("Tracker", { kind: "Behavior & memory" }),
        },
        {
          title: "Red-flag symptoms",
          subtitle: "Keep a record after seeking help",
          icon: "flag-outline",
          keywords: "warning red flag symptoms urgent",
          onPress: () => n.navigate("Tracker", { kind: "Red-flag symptoms" }),
        },
        {
          title: "Care summary",
          subtitle: "Observations, medicines, and visit questions",
          icon: "document-text-outline",
          keywords: "summary overview records",
          onPress: () => n.navigate("Summary"),
        },
        {
          title: "Care timeline & insights",
          subtitle: "Visual trends and recent care activity",
          icon: "analytics-outline",
          keywords: "timeline trends charts insights history",
          onPress: () => n.navigate("Insights"),
        },
      ],
    },
    {
      title: "Plan & prepare",
      subtitle: "Routines, medicines, appointments, documents, and transitions",
      icon: "calendar-outline",
      items: [
        {
          title: "Daily care plan & routines",
          subtitle: "Meals, medications, mobility, hygiene, monitoring, and everyday care",
          icon: "list-outline",
          keywords: "routine daily plan meals mobility hygiene",
          onPress: () => n.navigate("CarePlan"),
        },
        {
          title: "Medication management",
          subtitle: "Medication list, PRN records, refills, and reconciliation",
          icon: "medical-outline",
          keywords: "medicine medication refill prn dose",
          onPress: () => n.navigate("Medications"),
        },
        {
          title: "Appointment prep",
          subtitle: "Bring your questions and observations",
          icon: "calendar-outline",
          keywords: "visit doctor appointment questions",
          onPress: () => n.navigate("Appointments"),
        },
        {
          title: "Doctor Visit Companion",
          subtitle: "Prepare questions, capture notes, review the recap, and share it",
          icon: "medkit-outline",
          keywords: "doctor visit companion transcript summary questions appointment recap",
          onPress: () => n.navigate("DoctorVisitCompanion"),
        },
        {
          title: "Care Document Vault",
          subtitle: "Private discharge papers, care plans, insurance files, and more",
          icon: "folder-open-outline",
          keywords: "documents files discharge insurance papers",
          onPress: () => n.navigate("CareDocuments"),
        },
        {
          title: "Care contacts & providers",
          subtitle: "Keep the people and organizations around this care profile together",
          icon: "call-outline",
          keywords: "doctor provider pharmacy insurance phone contacts",
          onPress: () => n.navigate("CareContacts"),
        },
        {
          title: "Care packet & printable summary",
          subtitle: "Build privacy-controlled visit, handoff, and emergency PDFs",
          icon: "reader-outline",
          keywords: "packet pdf print summary handoff",
          onPress: () => n.navigate("CarePacket"),
        },
        {
          title: "Hospital-to-home transition",
          subtitle: "Discharge plan, equipment, warning signs, and follow-ups",
          icon: "home-outline",
          keywords: "hospital home discharge transition",
          onPress: () => n.navigate("Transition"),
        },
        {
          title: "Emergency Information Center",
          subtitle: "Quick contacts, key records, medication reconciliation, and preparedness",
          icon: "alert-circle-outline",
          keywords: "emergency urgent warning safety",
          onPress: () => n.navigate("Emergency"),
        },
      ],
    },
    {
      title: "Care team & coordination",
      subtitle: "People, schedules, tasks, coverage, communication, and handoffs",
      icon: "people-outline",
      items: [
        {
          title: "Care team & sharing",
          subtitle: "Invite family, switch care profiles, and manage access",
          icon: "people-outline",
          keywords: "family invite access roles team share",
          onPress: () => n.navigate("CareTeam"),
        },
        {
          title: "Today & caregiver shift board",
          subtitle: "Coverage, due work, reassignment, and shift handoffs",
          icon: "people-outline",
          keywords: "today shift board handoff caregiver",
          onPress: () => n.navigate("CareShiftBoard"),
        },
        {
          title: "On-shift caregiver mode",
          subtitle: "My work, shared work, notes, care context, and shift closeout",
          icon: "pulse-outline",
          keywords: "shift caregiver work takeover closeout",
          onPress: () => n.navigate("OnShiftCaregiver"),
        },
        {
          title: "Live care team & continuity",
          subtitle: "Current caregiver, next shift, coverage bridge, and handoff history",
          icon: "git-compare-outline",
          keywords: "continuity current caregiver handoff next shift",
          onPress: () => n.navigate("CareContinuity"),
        },
        {
          title: "Recurring care coverage",
          subtitle: "Define repeatable times when caregiver coverage is required",
          icon: "time-outline",
          keywords: "recurring coverage requirement schedule",
          onPress: () => n.navigate("CareCoverageRequirements"),
        },
        {
          title: "Weekly coverage approval",
          subtitle: "Review the week, publish assignments, and track caregiver responses",
          icon: "checkmark-done-outline",
          keywords: "weekly approval publish assignment response deadline",
          onPress: () => n.navigate("WeeklyCoveragePlan"),
        },
        {
          title: "Smart Coverage Planner",
          subtitle: "Scan the next 7 days, match caregivers, and review coverage suggestions",
          icon: "sparkles-outline",
          keywords: "smart planner match caregiver suggestions coverage",
          onPress: () => n.navigate("SmartCoveragePlanner"),
        },
        {
          title: "Open caregiver coverage",
          subtitle: "Request help for an uncovered window or claim available coverage",
          icon: "megaphone-outline",
          keywords: "open coverage uncovered request claim backup",
          onPress: () => n.navigate("CareCoverageRequests"),
        },
        {
          title: "Caregiver availability & schedule",
          subtitle: "Plan shifts, check-ins, attendance, swaps, and uncovered responsibilities",
          icon: "calendar-outline",
          keywords: "availability schedule shifts swap attendance",
          onPress: () => n.navigate("CareSchedule"),
        },
        {
          title: "Care coordination analytics",
          subtitle: "Weekly workload, attendance, tasks, and coverage trends",
          icon: "bar-chart-outline",
          keywords: "analytics workload coverage attendance trends",
          onPress: () => n.navigate("CareAnalytics"),
        },
        {
          title: "Needs coordination",
          subtitle: "Overlaps, uncovered work, appointment clashes, and long care days",
          icon: "warning-outline",
          keywords: "conflicts inbox coordination overlap uncovered",
          onPress: () => n.navigate("CareCoordinationInbox"),
        },
        {
          title: "Care tasks & shared care plan",
          subtitle: "Assign responsibilities and track what the care team completes",
          icon: "checkbox-outline",
          keywords: "tasks assign responsibilities follow up",
          onPress: () => n.navigate("CareTasks"),
        },
        {
          title: "Family care calendar & agenda",
          subtitle: "One day and week view across the shared care plan",
          icon: "notifications-outline",
          keywords: "calendar agenda day week reminder",
          onPress: () => n.navigate("CareCalendar"),
        },
        {
          title: "Family communication center",
          subtitle: "Share family care updates and track acknowledgements",
          icon: "chatbubbles-outline",
          keywords: "family communication updates acknowledgement",
          onPress: () => n.navigate("FamilyCommunication"),
        },
        {
          title: "Provider & insurance communication",
          subtitle: "Calls, portal messages, decisions, and follow-ups",
          icon: "document-text-outline",
          keywords: "provider insurance calls messages portal follow up",
          onPress: () => n.navigate("CareCommunicationLog"),
        },
      ],
    },
  ];

  // Index real registered destinations with their category for discovery.
  // No patient data or fabricated search results are included.
  const searchableItems = groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      category: group.title,
      groupSubtitle: group.subtitle,
    })),
  );
  const categoryOptions = groups.map((group) => ({
    title: group.title,
    count: group.items.length,
  }));

  function openTool(item: ToolItem) {
    Keyboard.dismiss();
    const next = withRecordedUse(preferences, item.title);
    setPreferences(next);
    void recordToolUse(preferences, item.title);
    item.onPress();
  }

  function togglePin(title: string) {
    const next = withToggledPin(preferences, title);
    setPreferences(next);
    void togglePinnedTool(preferences, title);
  }

  const normalizedQuery = query.trim();
  const hasActiveResults =
    Boolean(normalizedQuery) || scope !== "all" || sort !== "relevance";
  const matches = findCareTools(searchableItems, normalizedQuery, scope, sort, preferences);

  return (
    <Page>
      <Fade>
        <View
          style={{
            minHeight: 245,
            position: "relative",
            overflow: "hidden",
            paddingTop: 4,
          }}
        >
          <View style={{ maxWidth: 300, paddingRight: 80, gap: 10 }}>
            <Text
              style={[
                S.eyebrow,
                {
                  color: themeForeground("#7A2F9E"),
                  fontSize: 10.5,
                  letterSpacing: 2.6,
                },
              ]}
            >
              FIND WHAT YOU NEED
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 39,
                lineHeight: 44,
                letterSpacing: -1.05,
                color: themeForeground("#12133D"),
              }}
            >
              Care tools, without the clutter
            </Text>
            <Text
              style={{
                marginTop: 4,
                maxWidth: 280,
                fontFamily: "DMSans_400Regular",
                fontSize: 15.5,
                lineHeight: 23,
                color: themeForeground("#777489"),
              }}
            >
              Search by what you want to do, open a category, or pin the tools
              you use most. Every existing care feature is still here.
            </Text>
          </View>

          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -14,
              top: 5,
            }}
          >
            <ToolkitHeroGraphic />
          </View>
        </View>

        <View
          style={{
            minHeight: 60,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: themeBorder("#E7DDEE"),
            backgroundColor: themeBackground("#FFFFFF"),
            flexDirection: "row",
            alignItems: "center",
            paddingLeft: 17,
            shadowColor: themeShadow("#5B3C6B"),
            shadowOpacity: 0.03,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 5 },
            elevation: 1,
          }}
        >
          <Icon name="search-outline" size={24} color={themeForeground("#7F2FA1")} />
          <TextInput
            accessibilityLabel="Search care tools"
            placeholder="Try “medication”, “coverage”, “documents”…"
            placeholderTextColor={themeForeground("#AAA0B2")}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={{
              flex: 1,
              minHeight: 58,
              paddingHorizontal: 13,
              fontFamily: "DMSans_400Regular",
              fontSize: 14,
              color: C.ink,
            }}
          />
          {Boolean(query) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear care tool search"
              onPress={() => setQuery("")}
              style={({ pressed }) => ({
                width: 43,
                minHeight: 58,
                alignItems: "center",
                justifyContent: "center",
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Icon name="close-circle-outline" size={22} color={themeForeground("#897C9B")} />
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={filtersOpen ? "Close care tool filters" : "Open care tool filters"}
            accessibilityState={{ expanded: filtersOpen }}
            onPress={() => {
              Keyboard.dismiss();
              setFiltersOpen((value) => !value);
            }}
            style={({ pressed }) => ({
              width: 56,
              minHeight: 58,
              borderLeftWidth: 1,
              borderLeftColor: themeBorder("#EEE6F2"),
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: filtersOpen || scope !== "all" || sort !== "relevance"
                ? "#F5ECFB" : "transparent",
              borderTopRightRadius: 23,
              borderBottomRightRadius: 23,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Icon name="options-outline" size={24} color={themeForeground("#7F2FA1")} />
            {(scope !== "all" || sort !== "relevance") && (
              <View
                style={{
                  position: "absolute",
                  right: 10,
                  top: 10,
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: themeBackground("#70338F"),
                }}
              />
            )}
          </Pressable>
        </View>

        {filtersOpen && (
          <Fade>
            <CareToolFilters
              scope={scope}
              sort={sort}
              categoryOptions={categoryOptions}
              pinnedCount={preferences.pinned.length}
              recentCount={preferences.recent.length}
              onScopeChange={setScope}
              onSortChange={setSort}
              onClose={() => setFiltersOpen(false)}
              onReset={() => {
                setScope("all");
                setSort("relevance");
              }}
            />
          </Fade>
        )}

        {!hasActiveResults && (
          <>
        <HomeReveal delay={110}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Emergency and warning signs"
            onPress={() => n.navigate("Emergency")}
            style={({ pressed }) => ({
              minHeight: 88,
              borderRadius: 24,
              overflow: "hidden",
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              backgroundColor: themeBackground("#FFF0F1"),
              borderWidth: 1,
              borderColor: themeBorder("#F5CFD5"),
              opacity: pressed ? 0.78 : 1,
            })}
          >
            <ToolkitWave tint="#FFE3E7" />
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: themeBackground("#FFE0E6"),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="alert-circle-outline" size={29} color={themeForeground("#CE365C")} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 15.5,
                  color: themeForeground("#A92F47"),
                }}
              >
                Emergency & warning signs
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 13,
                  color: themeForeground("#A95865"),
                }}
              >
                Know when to get help
              </Text>
            </View>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: themeBackground("#FFDDE4"),
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="chevron-forward" size={19} color={themeForeground("#D1395D")} />
            </View>
          </Pressable>
        </HomeReveal>
          </>
        )}

        {hasActiveResults ? (
          <View style={{ gap: 12 }}>
            <View style={{ gap: 4, marginTop: 5 }}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 23,
                  color: themeForeground("#15153D"),
                }}
              >
                {normalizedQuery ? "Search results" : "Filtered care tools"}
              </Text>
              <Text style={[S.small, { fontSize: 12.5 }]}>
                {matches.length} matching {matches.length === 1 ? "tool" : "tools"}
                {scope.startsWith("category:") ? ` · ${scope.slice("category:".length)}` : ""}
                {scope === "pinned" ? " · Pinned" : scope === "recent" ? " · Recently used" : ""}
              </Text>
            </View>

            {matches.map((item, index) => (
              <HomeReveal key={item.title} delay={Math.min(80 + index * 40, 280)}>
                <ToolItemRow
                  item={item}
                  pinned={preferences.pinned.includes(item.title)}
                  onOpen={openTool}
                  onTogglePin={togglePin}
                />
              </HomeReveal>
            ))}

            {!matches.length && (
              <View
                style={{
                  borderRadius: 24,
                  padding: 20,
                  backgroundColor: themeBackground("#F7F2FA"),
                  borderWidth: 1,
                  borderColor: themeBorder("#ECE4F1"),
                  gap: 10,
                }}
              >
                <Icon name="search-outline" size={27} color={themeForeground("#70338F")} />
                <Text style={S.h3}>
                  {scope === "pinned" && !normalizedQuery
                    ? "No pinned tools yet."
                    : scope === "recent" && !normalizedQuery
                      ? "No recent tools yet."
                      : "No tools match those options."}
                </Text>
                <Txt>
                  {scope === "pinned" && !normalizedQuery
                    ? "Tap the star beside any tool to pin it here."
                    : scope === "recent" && !normalizedQuery
                      ? "Tools you open will appear here for quick access."
                      : "Try a different phrase or broaden your filters. You can search for medications, appointments, documents, or coverage."}
                </Txt>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Clear search and filters"
                  onPress={() => {
                    setQuery("");
                    setScope("all");
                    setSort("relevance");
                    setFiltersOpen(false);
                  }}
                  style={({ pressed }) => ({
                    alignSelf: "flex-start",
                    minHeight: 44,
                    paddingHorizontal: 17,
                    borderRadius: 18,
                    backgroundColor: themeBackground("#70338F"),
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: pressed ? 0.8 : 1,
                  })}
                >
                  <Text style={{ fontFamily: "DMSans_600SemiBold", color: themeForeground("#FFFFFF"), fontSize: 13 }}>
                    Show all tools
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        ) : (
          <View style={{ gap: 18 }}>
            <View style={{ gap: 5, marginTop: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text
                  style={{
                    fontFamily: "DMSans_700Bold",
                    fontSize: 27,
                    lineHeight: 33,
                    color: themeForeground("#14153D"),
                  }}
                >
                  All care tools
                </Text>
                <HomeFloat distance={3} duration={1800}>
                  <View style={{ flexDirection: "row", gap: 4 }}>
                    <View
                      style={{
                        width: 5,
                        height: 16,
                        borderRadius: 3,
                        backgroundColor: themeBackground("#C486ED"),
                        transform: [{ rotate: "32deg" }],
                      }}
                    />
                    <View
                      style={{
                        marginTop: 11,
                        width: 13,
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: themeBackground("#D2A0F3"),
                        transform: [{ rotate: "12deg" }],
                      }}
                    />
                  </View>
                </HomeFloat>
              </View>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 14,
                  lineHeight: 20,
                  color: themeForeground("#777489"),
                }}
              >
                Open a category to choose a task, or use search and the pinned filter above for your favorites.
              </Text>
            </View>

            {groups.map((group, index) => (
              <HomeReveal key={group.title} delay={Math.min(80 + index * 55, 280)}>
                <ToolGroup
                  title={group.title}
                  subtitle={group.subtitle}
                  icon={group.icon}
                  items={group.items}
                  preferences={preferences}
                  onOpenTool={openTool}
                  onTogglePin={togglePin}
                  defaultOpen={false}
                />
              </HomeReveal>
            ))}
          </View>
        )}
      </Fade>
    </Page>
  );
}


function LearnHeroGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 300 240">
      <Defs>
        <LinearGradient id="learnHalo" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#F7F1FC")} />
          <Stop offset="1" stopColor={themeTint("#E7D9F5")} />
        </LinearGradient>
        <LinearGradient id="learnHair" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#51375F")} />
          <Stop offset="1" stopColor={themeTint("#36263F")} />
        </LinearGradient>
        <LinearGradient id="learnTop" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#8150A2")} />
          <Stop offset="1" stopColor={themeTint("#64357F")} />
        </LinearGradient>
        <LinearGradient id="learnBook" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#75408F")} />
          <Stop offset="1" stopColor={themeTint("#4F2967")} />
        </LinearGradient>
      </Defs>

      {/* soft illustration halo */}
      <Circle cx="178" cy="105" r="92" fill="url(#learnHalo)" />

      {/* layered leaves behind the reader */}
      <Ellipse cx="224" cy="50" rx="17" ry="55" fill={themeTint("#C7AFE3")} transform="rotate(17 224 50)" />
      <Ellipse cx="252" cy="79" rx="14" ry="47" fill={themeTint("#B89AD8")} transform="rotate(34 252 79)" />
      <Ellipse cx="270" cy="121" rx="14" ry="43" fill={themeTint("#D7C6EB")} transform="rotate(51 270 121)" />
      <Ellipse cx="197" cy="37" rx="12" ry="37" fill={themeTint("#DCCEF0")} transform="rotate(-10 197 37)" />

      {/* shoulders / cardigan */}
      <Path
        d="M119 194 C126 151 153 127 191 127 C228 127 255 153 261 196 L261 222 L113 222 C113 211 115 202 119 194 Z"
        fill={themeTint("#FFF9F6")}
      />
      <Path
        d="M119 185 C132 161 147 149 162 145 L174 219 L108 219 C107 205 110 193 119 185 Z"
        fill="url(#learnTop)"
      />
      <Path
        d="M218 145 C237 151 250 166 260 188 L266 219 L207 219 L208 161 Z"
        fill={themeTint("#F5ECE7")}
      />

      {/* hair mass */}
      <Path
        d="M126 92 C126 46 154 22 194 22 C233 22 259 49 257 89 C256 111 248 127 234 141 L146 141 C132 124 126 109 126 92 Z"
        fill="url(#learnHair)"
      />

      {/* face and neck */}
      <Rect x="181" y="119" width="24" height="25" rx="10" fill={themeTint("#EDC0AC")} />
      <Circle cx="193" cy="84" r="38" fill={themeTint("#F0C8B5")} />
      <Path
        d="M158 72 C168 43 198 36 223 47 C239 54 248 67 249 83 C239 70 226 63 208 62 C188 61 172 66 158 72 Z"
        fill="url(#learnHair)"
      />
      <Path d="M164 58 C151 72 150 95 156 113 C143 102 139 84 145 69 C149 59 155 52 164 47 Z" fill={themeTint("#4B3255")} />

      {/* face details */}
      <Circle cx="181" cy="84" r="2.6" fill={themeTint("#74505A")} />
      <Circle cx="206" cy="84" r="2.6" fill={themeTint("#74505A")} />
      <Path d="M184 101 C190 106 198 106 204 101" stroke={themeTint("#C77976")} strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <Path d="M181 75 C176 73 172 73 168 75" stroke={themeTint("#B07C76")} strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <Path d="M207 75 C212 73 216 73 220 75" stroke={themeTint("#B07C76")} strokeWidth="1.8" strokeLinecap="round" fill="none" />

      {/* open book */}
      <Path
        d="M101 166 C126 154 151 156 177 170 L171 222 C146 208 124 206 99 215 Z"
        fill={themeTint("#7A45A0")}
      />
      <Path
        d="M177 170 C200 156 225 154 250 166 L252 215 C228 206 204 208 171 222 Z"
        fill="url(#learnBook)"
      />
      <Path d="M177 171 L171 222" stroke={themeTint("#A983BC")} strokeWidth="2" />
      <Path d="M112 173 C131 167 148 169 165 178" stroke={themeTint("#AA7CC0")} strokeWidth="3" strokeLinecap="round" fill="none" />
      <Path d="M113 184 C131 180 146 181 160 187" stroke={themeTint("#AA7CC0")} strokeWidth="2.4" strokeLinecap="round" fill="none" />

      {/* hands */}
      <Ellipse cx="126" cy="161" rx="14" ry="22" fill={themeTint("#F0C8B5")} transform="rotate(-19 126 161)" />
      <Ellipse cx="228" cy="154" rx="14" ry="23" fill={themeTint("#F0C8B5")} transform="rotate(10 228 154)" />

      {/* mug */}
      <Rect x="234" y="121" width="42" height="43" rx="10" fill={themeTint("#FFFFFF")} stroke={themeTint("#E8DDEB")} strokeWidth="3" />
      <Path d="M275 132 C287 131 291 151 278 154" stroke={themeTint("#D9CCE0")} strokeWidth="4" fill="none" strokeLinecap="round" />
      <Path d="M241 128 C249 124 260 124 269 128" stroke={themeTint("#F4EDF6")} strokeWidth="3" strokeLinecap="round" />
    </Svg>
  );
}

function LearnFeaturedGraphic() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 190 178">
      <Defs>
        <LinearGradient id="featuredPaper" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#FFFFFF")} />
          <Stop offset="1" stopColor={themeTint("#F8F4FB")} />
        </LinearGradient>
        <LinearGradient id="featuredLeaf" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={themeTint("#D7C3EB")} />
          <Stop offset="1" stopColor={themeTint("#B495D4")} />
        </LinearGradient>
      </Defs>

      <Circle cx="126" cy="90" r="65" fill={themeTint("#EDE0F7")} />
      <Ellipse cx="47" cy="121" rx="19" ry="61" fill="url(#featuredLeaf)" transform="rotate(28 47 121)" />
      <Ellipse cx="76" cy="116" rx="15" ry="50" fill={themeTint("#D2BDE7")} transform="rotate(-8 76 116)" />
      <Ellipse cx="160" cy="105" rx="18" ry="57" fill={themeTint("#D9C9EC")} transform="rotate(24 160 105)" />

      {/* rear paper */}
      <G transform="translate(76 30) rotate(10 50 62)">
        <Rect x="18" y="11" width="93" height="122" rx="15" fill={themeTint("#DCCFE8")} opacity="0.85" />
      </G>

      {/* front resource card */}
      <G transform="translate(63 22) rotate(8 50 62)">
        <Rect x="0" y="0" width="101" height="127" rx="15" fill="url(#featuredPaper)" />
        <Circle cx="50" cy="34" r="21" fill={themeTint("#E7D6F2")} />
        <Path
          d="M50 47 C35 36 33 27 41 23 C47 20 50 25 50 25 C50 25 53 20 59 23 C67 27 65 36 50 47 Z"
          fill={themeTint("#9D6FB8")}
        />
        <Rect x="22" y="68" width="58" height="7" rx="3.5" fill={themeTint("#D6C2E5")} />
        <Rect x="22" y="84" width="66" height="7" rx="3.5" fill={themeTint("#D6C2E5")} />
        <Rect x="22" y="100" width="51" height="7" rx="3.5" fill={themeTint("#D6C2E5")} />
      </G>

      {/* small sparkle */}
      <Path d="M156 26 L160 36 L170 40 L160 44 L156 54 L152 44 L142 40 L152 36 Z" fill={themeTint("#B489CC")} opacity="0.75" />
    </Svg>
  );
}

function LearnGuideGraphic({ kind }: { kind: "medication" | "symptoms" }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 180 100">
      <Circle cx="28" cy="91" r="42" fill={themeTint("#DCC8ED")} />
      <Circle cx="160" cy="13" r="42" fill={themeTint("#F7E9EB")} />
      {kind === "medication" ? (
        <>
          <Ellipse cx="74" cy="67" rx="13" ry="38" fill={themeTint("#A283B6")} transform="rotate(38 74 67)" />
          <Rect x="82" y="18" width="43" height="65" rx="8" fill={themeTint("#C97836")} />
          <Rect x="86" y="26" width="35" height="17" rx="4" fill={themeTint("#FFFFFF")} />
          <Rect x="90" y="12" width="27" height="10" rx="4" fill={themeTint("#EAE2E5")} />
          <Ellipse cx="126" cy="77" rx="11" ry="5" fill={themeTint("#FFFDFD")} stroke={themeTint("#D8CADF")} strokeWidth="1.5" transform="rotate(-10 126 77)" />
          <Ellipse cx="146" cy="70" rx="11" ry="5" fill={themeTint("#FFFDFD")} stroke={themeTint("#D8CADF")} strokeWidth="1.5" transform="rotate(17 146 70)" />
        </>
      ) : (
        <>
          <Path d="M91 15c28 0 47 20 47 46 0 11-4 21-10 29H78c-10-9-16-22-16-36 0-22 9-39 29-39Z" fill={themeTint("#8A6AA0")} />
          <Path d="M79 36c-12 14-17 25-17 43 0 12 4 20 12 29h35v-14c-10-8-15-16-15-28 0-12 4-22 12-30H79Z" fill={themeTint("#7A5C91")} />
          <Circle cx="111" cy="45" r="17" fill={themeTint("#F1DFF4")} />
          <Path d="M111 54c-11-8-13-14-6-17 4-2 6 2 6 2s2-4 6-2c7 3 5 9-6 17Z" fill={themeTint("#6E3D82")} />
          <Line x1="145" y1="29" x2="154" y2="20" stroke={themeTint("#B58BC6")} strokeWidth="3" strokeLinecap="round" />
          <Line x1="150" y1="43" x2="162" y2="41" stroke={themeTint("#B58BC6")} strokeWidth="3" strokeLinecap="round" />
          <Line x1="141" y1="17" x2="145" y2="6" stroke={themeTint("#B58BC6")} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

export function LibraryScreen() {
  const n = useNav();
  const { state } = useCare();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [guides, setGuides] = useState<ClinicalContentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function refresh() {
    setLoading(true);
    setMessage("");
    try {
      setGuides(await loadPublishedGuides());
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the published resource library.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const filtered = guides.filter(
    (g) =>
      (g.title + " " + g.category)
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter !== "Saved" || state.saved.includes(g.id)) &&
      (filter !== "Conditions" || g.category === "Condition guide"),
  );

  const popular = filtered.slice(0, 2);

  const topicItems = [
    { title: "Medications", icon: "medical-outline", query: "medication", bg: "#F1E5FA", color: themeForeground("#8B46A8") },
    { title: "Symptoms", icon: "pulse-outline", query: "symptom", bg: "#F2E7FA", color: themeForeground("#9850B1") },
    { title: "Home care", icon: "home-outline", query: "home", bg: "#F8EAF3", color: themeForeground("#8A4AA2") },
    { title: "Appointments", icon: "calendar-outline", query: "appointment", bg: "#E9EEFF", color: themeForeground("#6275C8") },
  ];

  return (
    <Page>
      <Fade>
        <View
          style={{
            position: "relative",
            minHeight: 236,
            overflow: "hidden",
          }}
        >
          <View style={{ gap: 10, maxWidth: 300, paddingTop: 4, paddingRight: 96 }}>
            <Text
              style={[
                S.eyebrow,
                { color: themeForeground("#74328F"), fontSize: 10.5, letterSpacing: 2.5 },
              ]}
            >
              KNOWLEDGE BRINGS CLARITY
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 40,
                lineHeight: 45,
                letterSpacing: -1.05,
                color: themeForeground("#141238"),
              }}
            >
              Learn simply.
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 16,
                lineHeight: 24,
                color: themeForeground("#7A748A"),
                maxWidth: 245,
              }}
            >
              Trusted, easy-to-understand resources for your caregiving journey.
            </Text>
          </View>

          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              right: -14,
              top: 2,
              width: 210,
              height: 224,
            }}
          >
            <HomeFloat distance={4} duration={3000}>
              <LearnHeroGraphic />
            </HomeFloat>
          </View>
        </View>

        <View
          style={[
            S.input,
            {
              minHeight: 58,
              borderRadius: 23,
              paddingHorizontal: 16,
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
            },
          ]}
        >
          <Icon name="search-outline" size={23} />
          <TextInput
            accessibilityLabel="Search resources"
            placeholder="Search guides, topics, or conditions"
            placeholderTextColor={themeForeground("#A9A1B1")}
            value={query}
            onChangeText={setQuery}
            style={{
              flex: 1,
              fontFamily: "DMSans_400Regular",
              fontSize: 14,
              color: C.ink,
            }}
          />
          {Boolean(query) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              onPress={() => setQuery("")}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="close" size={18} color={C.muted} />
            </Pressable>
          )}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {["All", "Conditions", "Saved"].map((item) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: filter === item }}
              key={item}
              onPress={() => setFilter(item)}
              style={({ pressed }) => ({
                minWidth: item === "Conditions" ? 126 : 102,
                minHeight: 54,
                borderRadius: 27,
                paddingHorizontal: 20,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: filter === item ? themeAction(C.purple) : "#F1EDF2",
                opacity: pressed ? 0.76 : 1,
              })}
            >
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 14,
                  color: filter === item ? C.white : "#716B7E",
                }}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </View>

        {filter === "All" && !query && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Explore trusted care guides"
            onPress={() => n.navigate("Resources")}
            style={({ pressed }) => ({
              minHeight: 252,
              borderRadius: 30,
              overflow: "hidden",
              backgroundColor: themeBackground("#F4ECFA"),
              padding: 22,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.995 : 1 }],
            })}
          >
            <View style={{ maxWidth: 225, gap: 8 }}>
              <Text
                style={[
                  S.eyebrow,
                  { color: themeForeground("#74328F"), fontSize: 10.5, letterSpacing: 2.3 },
                ]}
              >
                FEATURED GUIDE
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 28,
                  lineHeight: 33,
                  letterSpacing: -0.55,
                  color: themeForeground("#17153A"),
                }}
              >
                Trusted guides,{"\n"}real answers.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 14,
                  lineHeight: 20,
                  color: themeForeground("#77718A"),
                  maxWidth: 210,
                }}
              >
                Clinically reviewed resources for everyday caregiving.
              </Text>
              <View
                style={{
                  alignSelf: "flex-start",
                  minHeight: 46,
                  borderRadius: 23,
                  paddingHorizontal: 18,
                  backgroundColor: themeAction(C.purple),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 9,
                  marginTop: 5,
                }}
              >
                <Text
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    fontSize: 13,
                    color: C.white,
                  }}
                >
                  Explore guides
                </Text>
                <Icon name="arrow-forward" color={C.white} size={17} />
              </View>
            </View>

            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: -4,
                bottom: 0,
                width: 172,
                height: 182,
              }}
            >
              <HomeFloat distance={4} duration={2400}>
                <LearnFeaturedGraphic />
              </HomeFloat>
            </View>
          </Pressable>
        )}

        <View style={{ gap: 12 }}>
          <View style={S.between}>
            <Text
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 21,
                lineHeight: 27,
                color: C.ink,
              }}
            >
              Explore by topic
            </Text>
          </View>

          <View style={{ flexDirection: "row", gap: 8 }}>
            {topicItems.map((item) => (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                accessibilityLabel={item.title}
                onPress={() => {
                  setFilter("All");
                  setQuery(item.query);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 0,
                  minHeight: 116,
                  borderRadius: 21,
                  backgroundColor: themeBackground(C.white),
                  borderWidth: 1,
                  borderColor: themeBorder("#EEE8F0"),
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 7,
                  gap: 10,
                  opacity: pressed ? 0.72 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                })}
              >
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: item.bg,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name={item.icon} size={27} color={item.color} />
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    fontSize: 10.8,
                    lineHeight: 14,
                    textAlign: "center",
                    color: C.ink,
                  }}
                >
                  {item.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Row
          title="Healthcare navigation"
          subtitle="Learn what different specialists do and how they help"
          icon="compass-outline"
          onPress={() => n.navigate("Specialists")}
        />

        {Boolean(message) && (
          <Card style={{ backgroundColor: C.redBg }}>
            <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
              {message}
            </Text>
            <Button title="Try again" secondary onPress={() => void refresh()} />
          </Card>
        )}

        {loading ? (
          <Card
            style={{
              minHeight: 130,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="book-outline" size={28} />
            <Txt>Loading trusted guides…</Txt>
          </Card>
        ) : query || filter !== "All" ? (
          <View style={{ gap: 12 }}>
            <Section title="Guides" />
            {filtered.map((guide) => (
              <Row
                key={guide.id}
                title={guide.title}
                subtitle={guide.category + " · " + guide.readTime}
                icon={guide.icon}
                onPress={() => n.navigate("Guide", { id: guide.id })}
              />
            ))}

            {!filtered.length && (
              <Card
                style={{
                  borderRadius: 24,
                  padding: 18,
                  backgroundColor: themeBackground("#F7F2FA"),
                }}
              >
                <Icon name="book-outline" size={26} />
                <Text style={S.h3}>
                  {filter === "Saved" ? "No saved guides yet" : "No guides found"}
                </Text>
                <Txt>
                  {filter === "Saved"
                    ? "Save a published guide and it will appear here."
                    : "Try another topic or browse the trusted resource directory."}
                </Txt>
              </Card>
            )}
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {popular.length > 0 && (
              <View style={{ gap: 11 }}>
                <Text style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 21,
                  lineHeight: 27,
                  color: C.ink,
                }}>
                  Popular guides
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {popular.map((guide, index) => (
                    <Pressable
                      key={guide.id}
                      accessibilityRole="button"
                      accessibilityLabel={guide.title}
                      onPress={() => n.navigate("Guide", { id: guide.id })}
                      style={({ pressed }) => ({
                        flex: 1,
                        minWidth: 0,
                        borderRadius: 22,
                        backgroundColor: themeBackground(C.white),
                        borderWidth: 1,
                        borderColor: themeBorder("#EEE8F0"),
                        padding: 10,
                        gap: 9,
                        opacity: pressed ? 0.75 : 1,
                        transform: [{ scale: pressed ? 0.99 : 1 }],
                      })}
                    >
                      <View style={{
                        height: 108,
                        borderRadius: 16,
                        overflow: "hidden",
                        backgroundColor: themeBackground("#F4ECFB"),
                      }}>
                        <LearnGuideGraphic kind={index === 0 ? "medication" : "symptoms"} />
                      </View>
                      <Text numberOfLines={2} style={{
                        fontFamily: "DMSans_700Bold",
                        fontSize: 14,
                        lineHeight: 18,
                        color: C.ink,
                      }}>
                        {guide.title}
                      </Text>
                      <Text numberOfLines={2} style={{
                        fontFamily: "DMSans_400Regular",
                        fontSize: 11,
                        lineHeight: 15,
                        color: C.muted,
                      }}>
                        {guide.category + " · " + guide.readTime}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {!guides.length && (
              <Card
                style={{
                  borderRadius: 24,
                  padding: 16,
                  minHeight: 88,
                  backgroundColor: themeBackground("#FAF6FC"),
                  borderColor: themeBorder("#EDE4F2"),
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <View
                  style={{
                    width: 54,
                    height: 54,
                    borderRadius: 18,
                    backgroundColor: themeBackground("#EFE4F8"),
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon name="library-outline" size={27} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[S.h3, { fontSize: 14 }]}>
                    Our library is growing
                  </Text>
                  <Text style={[S.small, { fontSize: 12 }]}>
                    More trusted guides are on the way.
                  </Text>
                </View>
                <Icon name="sparkles-outline" size={20} color={themeForeground("#B57AC8")} />
              </Card>
            )}
          </View>
        )}
      </Fade>
    </Page>
  );
}
export function SupportScreen() {
  const n = useNav();
  return (
    <Page>
      <Heading
        eyebrow="YOU ARE NOT ALONE"
        title="Care for the caregiver"
        body="Support for the practical, emotional, and spiritual parts of your journey."
      />
      <Row
        title="Ask EnVizion Assistant"
        subtitle="Basic guidance, with a path to a person"
        icon="chatbubbles-outline"
        onPress={() => n.navigate("Assistant")}
      />
      <Row
        title="Your team conversation"
        subtitle="View your latest request or ask for personal support"
        icon="people-outline"
        onPress={() => n.navigate("TeamConversation")}
      />
      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Icon name="people-outline" color={themeForeground("#E5C8ED")} size={32} />
        <Text style={[S.h2, { color: C.white }]}>
          An advocate. A listening ear.{"\n"}A clearer next step.
        </Text>
        <Txt style={{ color: themeForeground("#E9DDED") }}>
          Explore one-on-one and group support with EnVizion Life.
        </Txt>
        <Button
          title="Explore advocate coaching"
          onPress={() => n.navigate("Coaching")}
        />
      </Card>
      <Row
        title="Spiritual Wellness"
        subtitle="Faith, reflection, and room to breathe"
        icon="sparkles-outline"
        onPress={() => n.navigate("Wellness")}
      />
      <Card>
        <Text style={S.eyebrow}>A GENTLE REMINDER</Text>
        <Text style={S.h2}>You can ask for help and still be strong.</Text>
        <Txt>
          Consider one small task you could share with someone you trust today.
        </Txt>
      </Card>
      <Safety onPress={() => n.navigate("Emergency")} />
    </Page>
  );
}
