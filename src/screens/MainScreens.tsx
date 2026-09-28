import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Platform, Pressable, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import { useCare } from "../store";
import { loadPublishedGuides, type ClinicalContentRecord } from "../clinicalContent";
import { NotificationBell } from "../notifications";
import {
  loadToolPreferences,
  rankToolTitles,
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
  const { state } = useCare();
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
  const profileInitial = displayName.slice(0, 1).toUpperCase();

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
                  backgroundColor: "#F1E8F8",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.72 : 1,
                  transform: [{ scale: pressed ? 0.96 : 1 }],
                })}
              >
                <Text
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    fontSize: 20,
                    color: "#6F2F8E",
                  }}
                >
                  {profileInitial}
                </Text>
              </Pressable>
            </View>
          </View>
        </HomeReveal>

        <HomeReveal delay={65}>
          <View
            style={{
              position: "relative",
              minHeight: 224,
              borderRadius: 30,
              overflow: "hidden",
              backgroundColor: "#FFFDFC",
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
                  { color: "#7A3F96", fontSize: 11, letterSpacing: 2.8 },
                ]}
              >
                YOUR CARE COMPANION
              </Text>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: compact ? 36 : 40,
                  lineHeight: compact ? 42 : 47,
                  letterSpacing: -1.15,
                  color: "#17153A",
                }}
              >
                {greeting},{"\n"}{displayName}.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 18,
                  lineHeight: 25,
                  color: "#77758B",
                  maxWidth: heroTextWidth,
                }}
              >
                Here for a calmer, more confident day of care.
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
              backgroundColor: "#63307D",
              paddingHorizontal: 23,
              paddingVertical: 22,
              minHeight: 205,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.988 : 1 }],
              shadowColor: "#5A246C",
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
                backgroundColor: "#FFFFFF0C",
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
                backgroundColor: "#FFFFFF0A",
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
                backgroundColor: "#B277CA17",
              }}
            />

            <Text
              style={[
                S.eyebrow,
                {
                  color: "#F1DAF7",
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
                    color: "#EEE2F2",
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
                      backgroundColor: "#F7EDFB",
                      alignItems: "center",
                      justifyContent: "center",
                      transform: [{ rotate: "4deg" }],
                    }}
                  >
                    <Icon name={priority.icon} size={35} color="#9B58B3" />
                  </View>
                </HomeFloat>
                <View
                  style={{
                    width: 53,
                    height: 53,
                    borderRadius: 27,
                    backgroundColor: C.white,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#2A1831",
                    shadowOpacity: 0.08,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 2,
                  }}
                >
                  <Icon name="arrow-forward" size={25} color="#6E3288" />
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
              backgroundColor: "#FBF8FD",
              borderColor: "#EDE4F1",
            }}
          >
            <View style={S.between}>
              <Text
                style={[
                  S.eyebrow,
                  { color: "#72408F", fontSize: 10.5, letterSpacing: 2.4 },
                ]}
              >
                TODAY AT A GLANCE
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => n.navigate("CarePlan")}
                style={{ minHeight: 36, justifyContent: "center" }}
              >
                <Text
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    fontSize: 12,
                    color: "#74328F",
                  }}
                >
                  View details →
                </Text>
              </Pressable>
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
                label="Overdue tasks"
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
              <HomeActionCard
                title="Check-in"
                subtitle="Record health"
                icon="pulse-outline"
                background="#F6F0FB"
                iconBackground="#EEE5F8"
                onPress={() => n.navigate("Tracker", { kind: "Vitals" })}
              />
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
              <HomeActionCard
                title="Care plan"
                subtitle="See today"
                icon="document-text-outline"
                background="#FFF3F1"
                iconBackground="#FFE8E5"
                iconColor="#C64D69"
                onPress={() => n.navigate("CarePlan")}
              />
            </View>
          </View>
        </HomeReveal>

        <HomeReveal delay={285}>
          <Card
            onPress={() => n.navigate("Assistant")}
            label="Ask EnVizion Assistant"
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: 25,
              minHeight: 138,
              padding: 20,
              backgroundColor: "#F5EEFA",
              borderColor: "#E5D8EE",
            }}
          >
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: 150,
                height: 150,
                borderRadius: 75,
                right: -58,
                bottom: -83,
                backgroundColor: "#E5D3F2",
              }}
            />
            <View style={{ gap: 8, paddingRight: 58 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="sparkles-outline" color="#B34E9A" size={19} />
                <Text
                  style={[
                    S.eyebrow,
                    { color: "#7B4196", fontSize: 10, letterSpacing: 2.2 },
                  ]}
                >
                  ENVIZION ASSISTANT
                </Text>
              </View>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 21,
                  lineHeight: 27,
                  color: "#18163C",
                }}
              >
                A question is a good place to start.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 13,
                  lineHeight: 19,
                  color: "#77758B",
                }}
              >
                Get guidance, find resources, or bring up a concern.
              </Text>
            </View>
            <View
              style={{
                position: "absolute",
                right: 18,
                top: 44,
              }}
            >
              <HomeFloat distance={4} duration={1400}>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: C.white,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: "#4B3155",
                    shadowOpacity: 0.06,
                    shadowRadius: 9,
                    shadowOffset: { width: 0, height: 4 },
                    elevation: 2,
                  }}
                >
                  <Icon name="arrow-forward" size={23} color="#74328F" />
                </View>
              </HomeFloat>
            </View>
          </Card>
        </HomeReveal>

        <HomeReveal delay={340}>
          <Card
            style={{
              position: "relative",
              overflow: "hidden",
              minHeight: 146,
              borderRadius: 25,
              padding: 20,
              backgroundColor: "#FFFDFD",
              borderColor: "#F0E9ED",
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
            <View style={{ maxWidth: 250, gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Icon name="heart" color="#EF8FA9" size={18} />
                <Text
                  style={[
                    S.eyebrow,
                    { color: "#824A9D", fontSize: 10, letterSpacing: 2.1 },
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
                  color: "#18163C",
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
        backgroundColor: C.white,
        gap: 7,
        borderWidth: 1,
        borderColor: "#F1EBF3",
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
          color: "#18163C",
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
          color: "#77758B",
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
        borderColor: "#EEE7F0",
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
            color: "#18163C",
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
            color: "#77758B",
          }}
        >
          {subtitle}
        </Text>
      </View>
    </Pressable>
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
    <Card onPress={onPress} label={title} style={{ flex: 1, padding: 17 }}>
      <Icon name={icon} size={26} />
      <View style={{ gap: 4 }}>
        <Text style={[S.h3, { fontSize: 14 }]}>{title}</Text>
        <Text style={S.small}>{subtitle}</Text>
      </View>
    </Card>
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
      style={[
        S.card,
        {
          padding: 0,
          flexDirection: "row",
          alignItems: "stretch",
          overflow: "hidden",
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${item.subtitle}`}
        accessibilityHint="Open this care tool"
        onPress={() => onOpen(item)}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: 76,
          padding: 15,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          opacity: pressed ? 0.72 : 1,
        })}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 13,
            backgroundColor: C.lavender,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={item.icon} size={21} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={S.h3}>{item.title}</Text>
          <Text style={S.small}>{item.subtitle}</Text>
        </View>
        <Icon name="chevron-forward" color="#A092A6" size={17} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={pinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
        accessibilityState={{ selected: pinned }}
        onPress={() => onTogglePin(item.title)}
        style={({ pressed }) => ({
          width: 50,
          alignItems: "center",
          justifyContent: "center",
          borderLeftWidth: 1,
          borderLeftColor: C.line,
          backgroundColor: pinned ? "#F7F1F9" : C.white,
          opacity: pressed ? 0.65 : 1,
        })}
      >
        <Icon
          name={pinned ? "star" : "star-outline"}
          color={pinned ? C.purple : C.muted}
          size={20}
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

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}. ${subtitle}`}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [
          S.card,
          {
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 14,
            backgroundColor: open ? "#F7F1F9" : C.white,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: C.lavender,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={icon} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={S.h3}>{title}</Text>
          <Text style={S.small}>{subtitle}</Text>
        </View>
        <View
          style={{
            minWidth: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: C.white,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon name={open ? "chevron-up" : "chevron-down"} size={17} />
        </View>
      </Pressable>

      {open && (
        <Fade>
          <View style={{ gap: 10, paddingLeft: 6 }}>
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
  const { state } = useCare();
  const [query, setQuery] = useState("");
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
    {
      title: "Understand & advocate",
      subtitle: "Healthcare navigation and clinically governed guidance",
      icon: "shield-checkmark-outline",
      items: [
        {
          title: "Healthcare navigation",
          subtitle: "Understand each specialist’s role",
          icon: "compass-outline",
          keywords: "specialists healthcare navigation doctors",
          onPress: () => n.navigate("Specialists"),
        },
        {
          title: "Patient rights",
          subtitle: "Available after EnVizion clinical publication",
          icon: "shield-checkmark-outline",
          keywords: "rights advocacy patient",
          onPress: () => n.navigate("Guide", { id: "rights" }),
        },
        {
          title: "Advance directive starter",
          subtitle: "Available after EnVizion clinical publication",
          icon: "chatbubbles-outline",
          keywords: "advance directive wishes planning advocate",
          onPress: () => n.navigate("Guide", { id: "advance" }),
        },
      ],
    },
  ];

  const allItems = groups.flatMap((group) => group.items);

  function openTool(item: ToolItem) {
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

  const learnedTitles = rankToolTitles(preferences);
  const roleSuggestions = !state.careRecipientId
    ? ["Care team & sharing", "Daily care plan & routines", "Appointment prep"]
    : state.accessRole === "owner"
      ? [
          "Needs coordination",
          "Weekly coverage approval",
          "Care team & sharing",
          "Family care calendar & agenda",
        ]
      : state.accessRole === "caregiver"
        ? [
            "Today & caregiver shift board",
            "On-shift caregiver mode",
            "Daily care plan & routines",
            "Family care calendar & agenda",
          ]
        : [
            "Care summary",
            "Care timeline & insights",
            "Family communication center",
            "Care contacts & providers",
          ];

  const forYouTitles = [...learnedTitles, ...roleSuggestions].filter(
    (title, index, items) => items.indexOf(title) === index,
  );

  const personalizedItems = forYouTitles
    .map((title) => allItems.find((item) => item.title === title))
    .filter((item): item is ToolItem => Boolean(item))
    .slice(0, 4);

  const hasLearnedPreferences =
    preferences.pinned.length > 0 || preferences.recent.length > 0;

  const normalizedQuery = query.trim().toLowerCase();
  const matches = groups.flatMap((group) =>
    group.items.filter((item) =>
      `${item.title} ${item.subtitle} ${item.keywords || ""}`
        .toLowerCase()
        .includes(normalizedQuery),
    ),
  );

  return (
    <Page>
      <Fade>
        <Heading
          eyebrow="FIND WHAT YOU NEED"
          title="Care tools, without the clutter"
          body="Search by what you want to do, open a category, or pin the tools you use most. Every existing care feature is still here."
        />

        <View style={[S.input, S.row]}>
          <Icon name="search-outline" size={20} />
          <TextInput
            accessibilityLabel="Search care tools"
            placeholder="Try “medication”, “coverage”, “documents”…"
            placeholderTextColor="#AAA0AF"
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
              accessibilityLabel="Clear tool search"
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
          <QuickCard
            title="Today"
            subtitle="Tasks & handoffs"
            icon="checkbox-outline"
            onPress={() => {
              const item = allItems.find(
                (tool) => tool.title === "Today & caregiver shift board",
              );
              if (item) openTool(item);
            }}
          />
          <QuickCard
            title="Calendar"
            subtitle="Visits & shifts"
            icon="calendar-outline"
            onPress={() => {
              const item = allItems.find(
                (tool) => tool.title === "Family care calendar & agenda",
              );
              if (item) openTool(item);
            }}
          />
        </View>

        <Safety onPress={() => n.navigate("Emergency")} />

        {normalizedQuery ? (
          <View style={{ gap: 10 }}>
            <Section title={`${matches.length} matching ${matches.length === 1 ? "tool" : "tools"}`} />
            {matches.map((item) => (
              <ToolItemRow
                key={item.title}
                item={item}
                pinned={preferences.pinned.includes(item.title)}
                onOpen={openTool}
                onTogglePin={togglePin}
              />
            ))}
            {!matches.length && (
              <Card>
                <Icon name="search-outline" />
                <Text style={S.h3}>No tool matched that search.</Text>
                <Txt>
                  Try a task word such as medication, documents, coverage,
                  calendar, family, appointment, or emergency.
                </Txt>
              </Card>
            )}
          </View>
        ) : (
          <View style={{ gap: 14 }}>
            {personalizedItems.length > 0 && (
              <View style={{ gap: 10 }}>
                <Section
                  title={
                    preferences.pinned.length
                      ? "Your shortcuts"
                      : hasLearnedPreferences
                        ? "Pick up where you left off"
                        : "Suggested for you"
                  }
                />
                <Txt style={S.small}>
                  {preferences.pinned.length
                    ? "Pinned tools stay first. Recent activity helps fill the remaining spots."
                    : hasLearnedPreferences
                      ? "Recent and frequently used tools rise automatically."
                      : state.accessRole === "owner"
                        ? "Owner-focused shortcuts for coordination, coverage, and shared care."
                        : state.accessRole === "caregiver"
                          ? "Caregiver-focused shortcuts for today’s work and handoffs."
                          : state.accessRole === "viewer"
                            ? "Quick ways to stay informed without changing shared care records."
                            : "Start with the tools that help organize a shared care profile."}
                </Txt>
                {personalizedItems.map((item) => (
                  <ToolItemRow
                    key={`personal-${item.title}`}
                    item={item}
                    pinned={preferences.pinned.includes(item.title)}
                    onOpen={openTool}
                    onTogglePin={togglePin}
                  />
                ))}
              </View>
            )}

            <Section title="All care tools" />

            {groups.map((group, index) => (
              <ToolGroup
                key={group.title}
                title={group.title}
                subtitle={group.subtitle}
                icon={group.icon}
                items={group.items}
                preferences={preferences}
                onOpenTool={openTool}
                onTogglePin={togglePin}
                defaultOpen={index === 0 && personalizedItems.length === 0}
              />
            ))}
          </View>
        )}
      </Fade>
    </Page>
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
    { title: "Medications", icon: "medical-outline", query: "medication", bg: "#F1E5FA", color: "#8B46A8" },
    { title: "Symptoms", icon: "pulse-outline", query: "symptom", bg: "#F2E7FA", color: "#9850B1" },
    { title: "Home care", icon: "home-outline", query: "home", bg: "#F8EAF3", color: "#8A4AA2" },
    { title: "Appointments", icon: "calendar-outline", query: "appointment", bg: "#E9EEFF", color: "#6275C8" },
  ];

  return (
    <Page>
      <Fade>
        <View
          style={{
            position: "relative",
            minHeight: 215,
            overflow: "hidden",
          }}
        >
          <View style={{ gap: 8, maxWidth: 255, paddingTop: 4 }}>
            <Text
              style={[
                S.eyebrow,
                { color: "#74328F", fontSize: 10.5, letterSpacing: 2.5 },
              ]}
            >
              KNOWLEDGE BRINGS CLARITY
            </Text>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 42,
                lineHeight: 47,
                letterSpacing: -1.05,
                color: "#141238",
              }}
            >
              Learn simply.
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 16,
                lineHeight: 23,
                color: "#7A748A",
                maxWidth: 250,
              }}
            >
              Trusted, easy-to-understand resources for your caregiving journey.
            </Text>
          </View>

          <HomeFloat distance={4} duration={3000}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                right: -12,
                top: 3,
                width: 190,
                height: 190,
              }}
            >
              <View
                style={{
                  position: "absolute",
                  width: 154,
                  height: 154,
                  borderRadius: 77,
                  right: 0,
                  top: 5,
                  backgroundColor: "#F1E9FA",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 31,
                  height: 80,
                  borderRadius: 18,
                  right: 15,
                  top: 27,
                  backgroundColor: "#CBB5E5",
                  transform: [{ rotate: "22deg" }],
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 29,
                  height: 72,
                  borderRadius: 18,
                  right: 50,
                  top: 16,
                  backgroundColor: "#BCA0D9",
                  transform: [{ rotate: "-14deg" }],
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 88,
                  height: 88,
                  borderRadius: 44,
                  right: 42,
                  top: 27,
                  backgroundColor: "#49324F",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 59,
                  height: 59,
                  borderRadius: 30,
                  right: 54,
                  top: 38,
                  backgroundColor: "#F0C7B5",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 115,
                  height: 72,
                  borderTopLeftRadius: 48,
                  borderTopRightRadius: 48,
                  right: 15,
                  bottom: 4,
                  backgroundColor: "#FFF9F5",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 84,
                  height: 55,
                  borderRadius: 9,
                  right: 61,
                  bottom: 15,
                  backgroundColor: "#66317F",
                  transform: [{ rotate: "-7deg" }],
                  borderWidth: 3,
                  borderColor: "#814A99",
                }}
              />
              <View
                style={{
                  position: "absolute",
                  width: 33,
                  height: 33,
                  borderRadius: 10,
                  right: 12,
                  bottom: 38,
                  backgroundColor: C.white,
                  borderWidth: 2,
                  borderColor: "#E8DDEB",
                }}
              />
            </View>
          </HomeFloat>
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
            placeholderTextColor="#A9A1B1"
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
                backgroundColor: filter === item ? C.purple : "#F1EDF2",
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
              minHeight: 240,
              borderRadius: 28,
              overflow: "hidden",
              backgroundColor: "#F4ECFA",
              padding: 22,
              opacity: pressed ? 0.9 : 1,
              transform: [{ scale: pressed ? 0.995 : 1 }],
            })}
          >
            <View style={{ maxWidth: 225, gap: 8 }}>
              <Text
                style={[
                  S.eyebrow,
                  { color: "#74328F", fontSize: 10.5, letterSpacing: 2.3 },
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
                  color: "#17153A",
                }}
              >
                Trusted guides,{"\n"}real answers.
              </Text>
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 14,
                  lineHeight: 20,
                  color: "#77718A",
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
                  backgroundColor: C.purple,
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

            <HomeFloat distance={4} duration={2400}>
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  right: -4,
                  bottom: -5,
                  width: 150,
                  height: 150,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <View
                  style={{
                    position: "absolute",
                    width: 70,
                    height: 118,
                    borderRadius: 35,
                    left: 4,
                    bottom: 0,
                    backgroundColor: "#D6C2EB",
                    transform: [{ rotate: "20deg" }],
                  }}
                />
                <View
                  style={{
                    position: "absolute",
                    width: 68,
                    height: 110,
                    borderRadius: 34,
                    right: 2,
                    top: 8,
                    backgroundColor: "#E5D7F2",
                    transform: [{ rotate: "-19deg" }],
                  }}
                />
                <View
                  style={{
                    width: 96,
                    height: 118,
                    borderRadius: 14,
                    backgroundColor: "#FFFDFE",
                    padding: 18,
                    gap: 9,
                    transform: [{ rotate: "-5deg" }],
                    shadowColor: "#5A2E6E",
                    shadowOpacity: 0.08,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 5 },
                    elevation: 2,
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignSelf: "center",
                      backgroundColor: "#E6D4F3",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="heart" size={17} color="#9862B0" />
                  </View>
                  {[84, 96, 70, 54].map((w, index) => (
                    <View
                      key={index}
                      style={{
                        width: w,
                        maxWidth: "100%",
                        height: 5,
                        borderRadius: 3,
                        backgroundColor: "#DCC9EA",
                      }}
                    />
                  ))}
                </View>
              </View>
            </HomeFloat>
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
            <Pressable
              accessibilityRole="button"
              onPress={() => n.navigate("Resources")}
              style={{ minHeight: 40, justifyContent: "center" }}
            >
              <Text
                style={{
                  fontFamily: "DMSans_600SemiBold",
                  fontSize: 12,
                  color: C.purple,
                }}
              >
                See all →
              </Text>
            </Pressable>
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
                  backgroundColor: C.white,
                  borderWidth: 1,
                  borderColor: "#EEE8F0",
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
                    fontSize: 11.5,
                    lineHeight: 15,
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
                  backgroundColor: "#F7F2FA",
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
            <View style={S.between}>
              <Text
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 21,
                  lineHeight: 27,
                  color: C.ink,
                }}
              >
                Popular guides
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => n.navigate("Resources")}
                style={{ minHeight: 40, justifyContent: "center" }}
              >
                <Text
                  style={{
                    fontFamily: "DMSans_600SemiBold",
                    fontSize: 12,
                    color: C.purple,
                  }}
                >
                  See all →
                </Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              {[0, 1].map((index) => {
                const guide = popular[index];
                const medication = index === 0;
                const title = guide
                  ? guide.title
                  : medication
                    ? "Medication basics"
                    : "Understanding symptoms";
                const subtitle = guide
                  ? guide.category + " · " + guide.readTime
                  : medication
                    ? "What to know, what to expect."
                    : "Common signs and how to respond.";

                return (
                  <Pressable
                    key={index}
                    accessibilityRole="button"
                    accessibilityLabel={title}
                    onPress={() =>
                      guide
                        ? n.navigate("Guide", { id: guide.id })
                        : n.navigate("Resources")
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      minWidth: 0,
                      borderRadius: 22,
                      backgroundColor: C.white,
                      borderWidth: 1,
                      borderColor: "#EEE8F0",
                      padding: 10,
                      gap: 9,
                      opacity: pressed ? 0.75 : 1,
                      transform: [{ scale: pressed ? 0.99 : 1 }],
                    })}
                  >
                    <View
                      style={{
                        height: 108,
                        borderRadius: 16,
                        overflow: "hidden",
                        backgroundColor: "#F4ECFB",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <View
                        style={{
                          position: "absolute",
                          width: 86,
                          height: 86,
                          borderRadius: 43,
                          left: -18,
                          bottom: -34,
                          backgroundColor: "#E1D0F0",
                        }}
                      />
                      <View
                        style={{
                          position: "absolute",
                          width: 70,
                          height: 70,
                          borderRadius: 35,
                          right: -12,
                          top: -20,
                          backgroundColor: "#F9E9EB",
                        }}
                      />
                      {medication ? (
                        <>
                          <View
                            style={{
                              width: 48,
                              height: 68,
                              borderRadius: 10,
                              backgroundColor: "#CF6F2A",
                              borderWidth: 4,
                              borderColor: "#F6F0EA",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <View
                              style={{
                                width: 38,
                                height: 20,
                                backgroundColor: C.white,
                                borderRadius: 4,
                              }}
                            />
                          </View>
                          <Icon
                            name="medical-outline"
                            size={23}
                            color="#7E5C91"
                          />
                        </>
                      ) : (
                        <View
                          style={{
                            width: 74,
                            height: 78,
                            borderTopLeftRadius: 42,
                            borderTopRightRadius: 42,
                            borderBottomLeftRadius: 25,
                            borderBottomRightRadius: 32,
                            backgroundColor: "#8A68A0",
                            alignItems: "center",
                            justifyContent: "center",
                            transform: [{ rotate: "-8deg" }],
                          }}
                        >
                          <View
                            style={{
                              width: 38,
                              height: 38,
                              borderRadius: 19,
                              backgroundColor: "#F1DFF4",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Icon name="heart" size={19} color="#6A3B80" />
                          </View>
                        </View>
                      )}
                    </View>

                    <Text
                      numberOfLines={2}
                      style={{
                        fontFamily: "DMSans_700Bold",
                        fontSize: 14,
                        lineHeight: 18,
                        color: C.ink,
                      }}
                    >
                      {title}
                    </Text>
                    <Text
                      numberOfLines={2}
                      style={{
                        fontFamily: "DMSans_400Regular",
                        fontSize: 11,
                        lineHeight: 15,
                        color: C.muted,
                      }}
                    >
                      {subtitle}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {!guides.length && (
              <Card
                style={{
                  borderRadius: 24,
                  padding: 16,
                  minHeight: 88,
                  backgroundColor: "#FAF6FC",
                  borderColor: "#EDE4F2",
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
                    backgroundColor: "#EFE4F8",
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
                <Icon name="sparkles-outline" size={20} color="#B57AC8" />
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
        <Icon name="people-outline" color="#E5C8ED" size={32} />
        <Text style={[S.h2, { color: C.white }]}>
          An advocate. A listening ear.{"\n"}A clearer next step.
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
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
      <Row
        title="Walking Through the Transition"
        subtitle="Feel more prepared for the move home"
        icon="home-outline"
        onPress={() => n.navigate("Transition")}
      />
      <Row
        title="Find your way through healthcare"
        subtitle="Meet the roles on your care team"
        icon="compass-outline"
        onPress={() => n.navigate("Specialists")}
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
