import { themeForeground } from "../themeColors";
import { themeAction } from "../themeColors";
import { useAppearance } from "../appearance";
import { supabase } from "../supabase";
import { useFocusEffect } from "@react-navigation/native";
import { ProfileAvatar } from "../profileAvatar";
import { StaffCareArtwork, StaffVolumeSparkline, requestVolumeByDay } from "../components/StaffWorkspaceVisuals";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import { useAuth } from "../auth";
import { NotificationBell } from "../notifications";
import {
  getStaffMembership,
  loadStaffDashboard,
  loadStaffSupportThread,
  sendStaffReply,
  updateCoachingRequestStatus,
  updateSupportRequestStatus,
  type StaffCoachingRequest,
  type StaffMembership,
  type StaffSupportRequest,
  type StaffSupportThread as StaffThread,
} from "../staff";
import {
  Brand,
  Button,
  C,
  Card,
  Field,
  Heading,
  Icon,
  Page,
  S,
  Section,
  Txt,
} from "../ui";
import { useNav } from "./MainScreens";

function labelStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function StatusPill({ status }: { status: string }) {
  const complete =
    status === "closed" || status === "completed" || status === "cancelled";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: complete ? "#E8F1ED" : C.lavender,
      }}
    >
      <Text
        style={[
          S.small,
          {
            color: complete ? C.green : C.deep,
            fontFamily: "DMSans_600SemiBold",
          },
        ]}
      >
        {labelStatus(status)}
      </Text>
    </View>
  );
}

function AccessRestricted() {
  const { signOut } = useAuth();
  return (
    <Page>
      <Brand />
      <Heading
        eyebrow="ENVIZION LIFE STAFF"
        title="Staff access required."
        body="This workspace is only available to accounts activated as EnVizion Life staff."
      />
      <Card>
        <Icon name="shield-checkmark-outline" size={30} />
        <Text style={S.h3}>Your account is signed in, but it is not an active staff account.</Text>
        <Txt>
          Staff access is controlled in the secure EnVizion Life database and
          cannot be enabled from this screen.
        </Txt>
      </Card>
      <Button title="Sign out" secondary onPress={() => void signOut()} />
    </Page>
  );
}

function StaffMetricCard({
  label,
  count,
  active,
  all,
  icon,
  series,
  id,
  dark,
}: {
  label: string;
  count: number;
  active: number;
  all: number;
  icon: "chatbubbles-outline" | "people-outline";
  series: number[];
  id: "support" | "coaching";
  dark: boolean;
}) {
  const ink = dark ? "#F5EEFF" : "#17143D";
  const muted = dark ? "#C7B7D5" : "#77718F";
  const recent = series.reduce((sum, value) => sum + value, 0);
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 188,
        borderRadius: 23,
        borderWidth: 1,
        borderColor: dark ? "#59476C" : "#EDE6F3",
        backgroundColor: dark ? "#282039" : "#FFFEFF",
        padding: 14,
        overflow: "hidden",
        justifyContent: "space-between",
        shadowColor: dark ? "#000000" : "#654181",
        shadowOpacity: dark ? 0 : 0.065,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 9 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 13,
          backgroundColor: dark ? "#49335F" : "#F2EAFB",
          alignItems: "center", justifyContent: "center",
        }}>
          <Icon name={icon} size={20} color={dark ? "#D4A8FF" : "#8438AC"} />
        </View>
        <Text
          numberOfLines={3}
          style={{
            flex: 1, fontFamily: "DMSans_600SemiBold",
            fontSize: 12.5, lineHeight: 17, color: ink,
          }}
        >
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
        <View style={{ minWidth: 55, paddingBottom: 5 }}>
          <Text style={{
            fontFamily: "DMSans_700Bold", fontSize: 37, lineHeight: 44, color: ink,
          }}>
            {count}
          </Text>
          <Text style={{
            fontFamily: "DMSans_500Medium", fontSize: 11.2, color: muted, lineHeight: 16,
          }}>
            {active} of {all} active
          </Text>
        </View>
        <StaffVolumeSparkline values={series} id={id} dark={dark} />
      </View>
      <Text style={{
        fontFamily: "DMSans_400Regular", fontSize: 11, color: muted,
      }}>
        {recent} new in the last 7 days
      </Text>
    </View>
  );
}

function StaffQuickTile({
  title, body, icon, onPress, width, dark,
}: {
  title: string;
  body: string;
  icon: "notifications-outline" | "people-circle-outline" | "analytics-outline" | "document-text-outline";
  onPress: () => void;
  width: "48.4%" | "23.3%";
  dark: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={body}
      onPress={onPress}
      style={({ pressed }) => ({
        width,
        minHeight: 160,
        padding: 14,
        borderRadius: 23,
        borderWidth: 1,
        borderColor: dark ? "#4E3E5F" : "#EEE9F3",
        backgroundColor: dark ? "#282137" : "#FFFEFF",
        opacity: pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.982 : 1 }],
        shadowColor: dark ? "#000000" : "#66507F",
        shadowOpacity: dark ? 0 : 0.06,
        shadowRadius: 9,
        shadowOffset: { width: 0, height: 5 },
        gap: 9,
      })}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{
          width: 39, height: 39, borderRadius: 13,
          alignItems: "center", justifyContent: "center",
          backgroundColor: dark ? "#49345E" : "#F1E7FC",
        }}>
          <Icon name={icon} size={23} color={dark ? "#D7B3F8" : "#8339AE"} />
        </View>
        <Icon name="chevron-forward" size={15} color={dark ? "#B7A0CA" : "#9688AB"} />
      </View>
      <Text style={{
        fontFamily: "DMSans_700Bold", fontSize: 14.3, lineHeight: 19,
        color: dark ? "#F5EEFF" : "#19153E",
      }}>
        {title}
      </Text>
      <Text style={{
        fontFamily: "DMSans_400Regular", fontSize: 11.7, lineHeight: 17,
        color: dark ? "#C7B9D5" : "#79708D",
      }}>
        {body}
      </Text>
    </Pressable>
  );
}

function RequestAvatar({ name, dark }: { name: string; dark: boolean }) {
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join("") || "?";
  return (
    <View style={{
      width: 43, height: 43, borderRadius: 22,
      backgroundColor: dark ? "#49325B" : "#F2E9FA",
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{
        fontFamily: "DMSans_700Bold", fontSize: 15,
        color: dark ? "#DCC1FB" : "#883BAD",
      }}>
        {initials}
      </Text>
    </View>
  );
}

function StaffRequestCard({
  name, recipient, topic, status, detail, channel, createdAt, dark, onPress, children,
}: {
  name: string;
  recipient: string;
  topic: string;
  status: string;
  detail: string;
  channel: string;
  createdAt: string;
  dark: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
}) {
  const content = (
    <>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <Text
          numberOfLines={1}
          style={{
            flex: 1, fontFamily: "DMSans_700Bold", letterSpacing: 1.9,
            fontSize: 10.5, color: dark ? "#D3A4ED" : "#73378D",
          }}
        >
          {topic.toUpperCase()}
        </Text>
        <StatusPill status={status} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
        <RequestAvatar name={name} dark={dark} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text numberOfLines={1} style={{
            fontFamily: "DMSans_700Bold", fontSize: 16.5,
            color: dark ? "#F5EEFF" : "#19143D",
          }}>
            {name}
          </Text>
          <Text numberOfLines={2} style={{
            fontFamily: "DMSans_400Regular", fontSize: 12.5,
            color: dark ? "#C6B8D5" : "#7D748C",
          }}>
            Care recipient: {recipient}
          </Text>
        </View>
        {onPress && <Icon name="chevron-forward" size={18} color={dark ? "#BBA6CB" : "#9786A7"} />}
      </View>
      {Boolean(detail.trim()) && (
        <Text numberOfLines={2} style={{
          fontFamily: "DMSans_400Regular", fontSize: 13.3, lineHeight: 19,
          color: dark ? "#EDE5F7" : "#2B254A",
        }}>
          {detail}
        </Text>
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <Text style={{
          flex: 1, fontFamily: "DMSans_400Regular", fontSize: 11.5,
          color: dark ? "#B9A8CA" : "#81788F",
        }}>
          {channel}
        </Text>
        <Text style={{
          fontFamily: "DMSans_400Regular", fontSize: 11,
          color: dark ? "#B9A8CA" : "#81788F",
        }}>
          {new Date(createdAt).toLocaleString()}
        </Text>
      </View>
      {children}
    </>
  );
  const cardStyle = {
    backgroundColor: dark ? "#262037" : "#FFFEFF",
    borderColor: dark ? "#4D3C60" : "#EDE6F1",
    borderWidth: 1,
    borderRadius: 23,
    padding: 16,
    gap: 13,
    shadowColor: dark ? "#000000" : "#61447C",
    shadowOpacity: dark ? 0 : 0.055,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
  } as const;
  if (onPress) return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open support request from ${name}, ${labelStatus(status)}`}
      onPress={onPress}
      style={({ pressed }) => ({ ...cardStyle, opacity: pressed ? 0.77 : 1 })}
    >
      {content}
    </Pressable>
  );
  return <View style={cardStyle}>{content}</View>;
}

export function StaffWorkspaceScreen() {
  const n = useNav();
  const { signOut } = useAuth();
  const { dark } = useAppearance();
  const { width: windowWidth } = useWindowDimensions();
  const narrow = windowWidth < 690;
  const [member, setMember] = useState<StaffMembership | null>(null);
  const [support, setSupport] = useState<StaffSupportRequest[]>([]);
  const [coaching, setCoaching] = useState<StaffCoachingRequest[]>([]);
  const [section, setSection] = useState<"support" | "coaching">("support");
  const [sortNewest, setSortNewest] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [liveConnected, setLiveConnected] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    setMessage("");
    try {
      const [membership, dashboard] = await Promise.all([
        getStaffMembership(),
        loadStaffDashboard(),
      ]);
      setMember(membership);
      setSupport(dashboard.support);
      setCoaching(dashboard.coaching);
      setLastUpdated(new Date());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not load the staff workspace.");
    } finally {
      setLoading(false);
      if (!silent) setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh(true);
  }, [refresh]));

  useFocusEffect(useCallback(() => {
    if (!member) return;
    let alive = true;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    setLiveConnected(false);
    const queueRefresh = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => { if (alive) void refresh(true); }, 550);
    };
    let channel = supabase
      .channel(`staff-operations-${member.userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_requests" }, queueRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, queueRefresh);
    if (member.role !== "support") {
      channel = channel.on("postgres_changes", {
        event: "*", schema: "public", table: "coaching_requests",
      }, queueRefresh);
    }
    channel.subscribe((status) => {
      if (alive) setLiveConnected(status === "SUBSCRIBED");
    });
    return () => {
      alive = false;
      if (debounce) clearTimeout(debounce);
      setLiveConnected(false);
      void supabase.removeChannel(channel);
    };
  }, [member?.userId, member?.role, refresh]));

  const paper = dark ? "#171320" : "#FFFDFE";
  const ink = dark ? "#F5EFFF" : "#17143C";
  const muted = dark ? "#C6B8D5" : "#7A728F";
  const card = dark ? "#261F36" : "#FFFFFFD9";
  const border = dark ? "#514164" : "#EEE6F2";
  const openSupport = support.filter((item) => item.status !== "closed").length;
  const openCoaching = coaching.filter((item) => !["completed", "cancelled"].includes(item.status)).length;
  const supportVolumes = requestVolumeByDay(support.map((item) => item.createdAt));
  const coachingVolumes = requestVolumeByDay(coaching.map((item) => item.createdAt));
  const sortedSupport = [...support].sort((a, b) => (sortNewest ? -1 : 1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  const sortedCoaching = [...coaching].sort((a, b) => (sortNewest ? -1 : 1) * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()));
  const quickLinks: Array<{
    title: string; body: string;
    icon: "notifications-outline" | "people-circle-outline" | "analytics-outline" | "document-text-outline";
    onPress: () => void;
  }> = member ? [
    {
      title: "Notification preferences",
      body: "Push updates, quiet hours and staff alerts.",
      icon: "notifications-outline",
      onPress: () => n.navigate("NotificationSettings"),
    },
    ...(member.role === "admin" ? [
      {
        title: "Manage staff access", body: "Invitations, roles and admin activity.",
        icon: "people-circle-outline" as const, onPress: () => n.navigate("StaffManagement"),
      },
      {
        title: "Pilot administration", body: "Participants, consent and readiness.",
        icon: "analytics-outline" as const, onPress: () => n.navigate("PilotAdmin"),
      },
    ] : []),
    ...(member.role !== "support" ? [
      {
        title: "Clinical content", body: "Draft, review and publish learning content.",
        icon: "document-text-outline" as const, onPress: () => n.navigate("ClinicalContent"),
      },
    ] : []),
  ] : [];

  if (loading) return (
    <Page>
      <Brand />
      <View style={{ minHeight: 320, justifyContent: "center", alignItems: "center", gap: 14 }}>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading staff workspace…</Txt>
      </View>
    </Page>
  );

  if (!member && !message) return <AccessRestricted />;

  if (!member) return (
    <Page>
      <Brand />
      <Heading title="Could not load staff access" body={message} />
      <Button title="Try again" onPress={() => void refresh()} />
      <Button title="Sign out" secondary onPress={() => void signOut()} />
    </Page>
  );

  const showSupport = section === "support" || member.role === "support";

  const statusAction = async (
    requestId: string, status: StaffCoachingRequest["status"],
  ) => {
    try {
      await updateCoachingRequestStatus(requestId, status);
      await refresh(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not update coaching status.");
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: paper }}
      contentContainerStyle={{ paddingHorizontal: narrow ? 18 : 24, paddingTop: 18, paddingBottom: 46 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ width: "100%", maxWidth: 1000, alignSelf: "center", gap: 21 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <Brand />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <NotificationBell onPress={() => n.navigate("Notifications")} />
            <View style={{
              width: 43, height: 43, borderRadius: 23, borderWidth: 2,
              borderColor: dark ? "#735693" : "#EBDDFA",
              alignItems: "center", justifyContent: "center",
              backgroundColor: dark ? "#49365B" : "#F3E9FC",
            }}>
              <ProfileAvatar name={member.displayName} size={37} />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out"
              onPress={() => void signOut()}
              style={{ paddingHorizontal: 3, paddingVertical: 12, minHeight: 44, justifyContent: "center" }}
            >
              <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 13, color: dark ? "#D3A7FB" : "#753298" }}>
                Sign out
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={{
          position: "relative", borderRadius: 30, overflow: "hidden",
          paddingVertical: 22, paddingHorizontal: narrow ? 10 : 24,
          minHeight: narrow ? 235 : 224,
          backgroundColor: dark ? "#211A30" : "#FEF9FF",
        }}>
          <View pointerEvents="none" style={{
            position: "absolute", top: -52, right: -38,
            width: narrow ? 185 : 295, height: 235,
            borderRadius: 180, backgroundColor: dark ? "#453256" : "#EAD8FB",
            opacity: 0.41,
          }} />
          <View pointerEvents="none" style={{
            position: "absolute", right: narrow ? -49 : 3, top: narrow ? 16 : 14,
            opacity: narrow ? 0.34 : 0.82,
          }}>
            <StaffCareArtwork dark={dark} />
          </View>
          <View style={{ maxWidth: narrow ? 340 : 660, gap: 13 }}>
            <Text style={{
              fontFamily: "DMSans_700Bold", letterSpacing: 2.8, fontSize: 10.5,
              color: dark ? "#D4B0F6" : "#8237A6",
            }}>
              ENVIZION LIFE STAFF
            </Text>
            <Text accessibilityRole="header" style={{
              fontFamily: "DMSans_700Bold",
              fontSize: narrow ? 34 : 44,
              lineHeight: narrow ? 40 : 51, letterSpacing: -1.25,
              color: ink, maxWidth: narrow ? 320 : 630,
            }}>
              Caregiver Support{"\n"}Workspace
            </Text>
            <Text style={{
              fontFamily: "DMSans_400Regular", fontSize: narrow ? 14.5 : 16.5,
              lineHeight: narrow ? 21 : 24, maxWidth: narrow ? 290 : 590, color: muted,
            }}>
              Welcome, {member.displayName}. Review caregiver requests and keep each conversation moving.
            </Text>
          </View>
          <View style={{ marginTop: 17, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 9 }}>
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 7,
              borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
              backgroundColor: dark ? "#1C4238" : "#EAF8F1",
            }}>
              <View style={{
                width: 7, height: 7, borderRadius: 4,
                backgroundColor: liveConnected ? "#199F68" : "#988D9C",
              }} />
              <Text style={{
                fontFamily: "DMSans_700Bold", fontSize: 11.3,
                color: dark ? "#A6E1BF" : "#187651",
              }}>
                {liveConnected ? "Live updates connected" : "Manual refresh available"}
              </Text>
            </View>
            <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11.5, color: muted }}>
              {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not updated yet"}
            </Text>
          </View>
        </View>

        <View style={{
          padding: 15, borderRadius: 29, borderWidth: 1,
          backgroundColor: card, borderColor: border,
          shadowColor: dark ? "#000000" : "#846199",
          shadowOpacity: dark ? 0 : 0.075,
          shadowRadius: 13, shadowOffset: { width: 0, height: 5 },
          gap: 14,
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <View style={{
                width: 4, height: 25, borderRadius: 3,
                backgroundColor: dark ? "#C69AFA" : "#B962ED",
              }} />
              <Text style={{ fontFamily: "DMSans_700Bold", fontSize: narrow ? 19 : 22, color: ink }}>
                Live operations
              </Text>
            </View>
            <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11.5, color: muted }}>
              {member.role === "admin" ? "Admin access" : member.role === "advocate" ? "Advocate access" : "Support access"}
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <StaffMetricCard
              label="Open support requests"
              count={openSupport} active={openSupport} all={support.length}
              series={supportVolumes} id="support" dark={dark}
              icon="chatbubbles-outline"
            />
            {member.role !== "support" && (
              <StaffMetricCard
                label="Active coaching requests"
                count={openCoaching} active={openCoaching} all={coaching.length}
                series={coachingVolumes} id="coaching" dark={dark}
                icon="people-outline"
              />
            )}
          </View>
        </View>

        <View style={{
          padding: 15, borderRadius: 27, borderWidth: 1,
          backgroundColor: dark ? "#241D32" : "#FCF9FE",
          borderColor: border, gap: 15,
        }}>
          <View style={{ gap: 4 }}>
            <Text style={{ fontFamily: "DMSans_700Bold", fontSize: narrow ? 20 : 22, color: ink }}>
              Quick access
            </Text>
            <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12.5, color: muted }}>
              Everything you need to manage and support.
            </Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "space-between" }}>
            {quickLinks.map((link) => (
              <StaffQuickTile
                key={link.title}
                {...link}
                width={narrow ? "48.4%" : "23.3%"}
                dark={dark}
              />
            ))}
          </View>
        </View>

        <View style={{
          flexDirection: "row", padding: 4, borderRadius: 999, gap: 4,
          backgroundColor: dark ? "#30233E" : "#F0E7F8",
        }}>
          {([
            { key: "support" as const, label: `Support inbox (${support.length})`, icon: "chatbubble-outline" as const },
            ...(member.role !== "support" ? [{ key: "coaching" as const, label: `Coaching (${coaching.length})`, icon: "people-outline" as const }] : []),
          ]).map((option) => (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === option.key }}
              onPress={() => setSection(option.key)}
              style={({ pressed }) => ({
                flex: 1, minHeight: 49, borderRadius: 999,
                alignItems: "center", justifyContent: "center",
                flexDirection: "row", gap: 8, paddingHorizontal: 5,
                backgroundColor: section === option.key ? (dark ? "#8651A4" : "#71318D") : "transparent",
                opacity: pressed ? 0.79 : 1,
              })}
            >
              <Icon name={option.icon} size={17} color={section === option.key ? "#FFFFFF" : (dark ? "#E4CEEF" : "#793A99")} />
              <Text style={{
                fontFamily: "DMSans_700Bold", fontSize: narrow ? 11.5 : 13.5,
                color: section === option.key ? "#FFFFFF" : (dark ? "#E4CEEF" : "#693082"),
              }}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 11 }}>
            <Text style={{ fontFamily: "DMSans_700Bold", fontSize: narrow ? 23 : 26, color: ink }}>
              {showSupport ? "Support requests" : "Coaching requests"}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={sortNewest ? "Sorted newest first. Switch to oldest first" : "Sorted oldest first. Switch to newest first"}
                onPress={() => setSortNewest((current) => !current)}
                style={{ minHeight: 38, flexDirection: "row", alignItems: "center", gap: 3 }}
              >
                <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 11.4, color: muted }}>
                  {sortNewest ? "Latest first" : "Oldest first"}
                </Text>
                <Icon name="chevron-down" size={14} color={dark ? "#D0B5E4" : "#753B91"} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Refresh staff requests"
                disabled={refreshing}
                onPress={() => void refresh()}
                style={({ pressed }) => ({
                  borderWidth: 1, borderColor: dark ? "#8655A5" : "#C78AE0",
                  borderRadius: 999, paddingHorizontal: 13, minHeight: 39,
                  flexDirection: "row", alignItems: "center", gap: 5,
                  justifyContent: "center", opacity: refreshing || pressed ? 0.6 : 1,
                })}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={dark ? "#DAB7F6" : "#803B9B"} />
                ) : (
                  <Icon name="refresh" size={17} color={dark ? "#DAB7F6" : "#803B9B"} />
                )}
                <Text style={{
                  fontFamily: "DMSans_600SemiBold", fontSize: 12,
                  color: dark ? "#DAB7F6" : "#803B9B",
                }}>
                  Refresh
                </Text>
              </Pressable>
            </View>
          </View>

          {Boolean(message) && (
            <View style={{
              borderWidth: 1, borderColor: dark ? "#8E5C70" : "#EDC5D0",
              backgroundColor: dark ? "#3D293C" : "#FFF2F5",
              borderRadius: 17, padding: 14, gap: 9,
            }}>
              <Text accessibilityRole="alert" style={{
                fontFamily: "DMSans_600SemiBold", fontSize: 13,
                color: dark ? "#FFC1CF" : "#993B5C",
              }}>
                {message}
              </Text>
              <Button title="Try again" secondary onPress={() => void refresh()} />
            </View>
          )}

          {showSupport ? (
            sortedSupport.length === 0 ? (
              <View style={{
                borderRadius: 21, backgroundColor: card, borderWidth: 1,
                borderColor: border, padding: 22, gap: 9, alignItems: "center",
              }}>
                <Icon name="checkmark-circle-outline" color={C.green} size={29} />
                <Text style={{ fontFamily: "DMSans_700Bold", color: ink, fontSize: 15 }}>
                  No support requests yet
                </Text>
                <Text style={{ fontFamily: "DMSans_400Regular", color: muted, fontSize: 12.5 }}>
                  New caregiver requests will appear here.
                </Text>
              </View>
            ) : sortedSupport.map((item) => (
              <StaffRequestCard
                key={item.id}
                name={item.caregiverName} recipient={item.careRecipientName}
                topic={item.topic} status={item.status} detail={item.context}
                channel={item.preferredChannel} createdAt={item.createdAt}
                dark={dark}
                onPress={() => n.navigate("StaffSupportThread", { requestId: item.id })}
              />
            ))
          ) : (
            sortedCoaching.length === 0 ? (
              <View style={{
                borderRadius: 21, backgroundColor: card, borderWidth: 1,
                borderColor: border, padding: 22, gap: 9, alignItems: "center",
              }}>
                <Icon name="checkmark-circle-outline" color={C.green} size={29} />
                <Text style={{ fontFamily: "DMSans_700Bold", color: ink, fontSize: 15 }}>
                  No coaching requests yet
                </Text>
                <Text style={{ fontFamily: "DMSans_400Regular", color: muted, fontSize: 12.5 }}>
                  New coaching requests will appear here.
                </Text>
              </View>
            ) : sortedCoaching.map((item) => (
              <StaffRequestCard
                key={item.id}
                name={item.caregiverName} recipient={item.careRecipientName}
                topic={item.topic} status={item.status} detail={item.message}
                channel="Coaching request" createdAt={item.createdAt}
                dark={dark}
              >
                {item.status === "submitted" && (
                  <Button title="Mark in review" secondary onPress={() => void statusAction(item.id, "in_review")} />
                )}
                {item.status === "in_review" && (
                  <Button title="Mark scheduled" onPress={() => void statusAction(item.id, "scheduled")} />
                )}
                {item.status === "scheduled" && (
                  <Button title="Mark completed" onPress={() => void statusAction(item.id, "completed")} />
                )}
                {!["completed", "cancelled"].includes(item.status) && (
                  <Button title="Cancel request" secondary onPress={() => void statusAction(item.id, "cancelled")} />
                )}
              </StaffRequestCard>
            ))
          )}
        </View>

        <Text style={{
          fontFamily: "DMSans_400Regular", fontSize: 11.5,
          lineHeight: 18, color: muted, paddingHorizontal: 4,
        }}>
          Staff access is enforced by Supabase Row Level Security. Caregiver medical decisions remain with the appropriate licensed healthcare team.
        </Text>
      </View>
    </ScrollView>
  );
}

export function StaffSupportThreadScreen({
  route,
}: NativeStackScreenProps<RootStack, "StaffSupportThread">) {
  const [thread, setThread] = useState<StaffThread | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      setThread(await loadStaffSupportThread(route.params.requestId));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load this request.",
      );
    } finally {
      setLoading(false);
    }
  }, [route.params.requestId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading support conversation…</Txt>
      </Page>
    );
  }

  if (!thread) {
    return (
      <Page>
        <Heading title="Support request unavailable" />
        {Boolean(message) && <Txt>{message}</Txt>}
        <Button title="Try again" onPress={() => void refresh()} />
      </Page>
    );
  }

  const request = thread.request;

  async function changeStatus(status: StaffSupportRequest["status"]) {
    setBusy(true);
    setMessage("");
    try {
      await updateSupportRequestStatus(request.id, status);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update the request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      await sendStaffReply(request.id, reply);
      setReply("");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not send the reply.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow={request.topic}
        title={request.caregiverName}
        body={`Care recipient: ${request.careRecipientName}`}
      />

      <Card style={{ backgroundColor: C.lavender }}>
        <View style={S.between}>
          <StatusPill status={request.status} />
          <Text style={S.small}>{request.preferredChannel}</Text>
        </View>
        <Text style={S.h3}>Original request</Text>
        <Txt style={{ color: C.ink }}>{request.context}</Txt>
        <Text style={S.small}>
          Submitted {new Date(request.createdAt).toLocaleString()}
        </Text>
      </Card>

      <Section title="Conversation" />
      {!thread.messages.length ? (
        <Card>
          <Txt>No follow-up messages yet.</Txt>
        </Card>
      ) : (
        thread.messages.map((item) => {
          const staff = item.senderType === "staff";
          return (
            <View
              key={item.id}
              style={[
                S.card,
                {
                  alignSelf: staff ? "flex-end" : "flex-start",
                  maxWidth: "94%",
                  backgroundColor: staff ? C.deep : C.white,
                },
              ]}
            >
              <Text
                style={[
                  S.eyebrow,
                  { color: staff ? "#E5C8ED" : C.purple },
                ]}
              >
                {staff ? "ENVIZION STAFF" : request.caregiverName}
              </Text>
              <Text style={[S.body, { color: staff ? C.white : C.ink }]}>
                {item.body}
              </Text>
              <Text
                style={[
                  S.small,
                  { color: staff ? "#DDCAE5" : C.muted },
                ]}
              >
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
          );
        })
      )}

      {request.status !== "closed" && (
        <>
          <Field
            label="Reply to caregiver"
            value={reply}
            onChange={setReply}
            multiline
          />
          <Button
            title={busy ? "Sending…" : "Send reply"}
            disabled={busy || !reply.trim()}
            icon="send-outline"
            onPress={() => void send()}
          />
        </>
      )}

      <Section title="Request status" />
      <View style={{ gap: 10 }}>
        {request.status === "submitted" && (
          <Button
            title="Mark in review"
            secondary
            disabled={busy}
            onPress={() => void changeStatus("in_review")}
          />
        )}
        {request.status !== "closed" && (
          <Button
            title="Close request"
            secondary
            disabled={busy}
            onPress={() => void changeStatus("closed")}
          />
        )}
        {request.status === "closed" && (
          <Button
            title="Reopen for review"
            secondary
            disabled={busy}
            onPress={() => void changeStatus("in_review")}
          />
        )}
      </View>

      {Boolean(message) && (
        <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
          {message}
        </Text>
      )}

      <Txt style={S.small}>
        Replies are support communications, not emergency monitoring or a
        substitute for professional medical care.
      </Txt>
    </Page>
  );
}
