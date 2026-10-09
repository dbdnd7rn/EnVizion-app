import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo, ActivityIndicator, Animated, Easing,
  Pressable, Switch, Text, View, useWindowDimensions,
} from "react-native";
import Svg, { Circle, Path } from "react-native-svg";
import { useAuth } from "../auth";
import { updateFaithPreference } from "../backend";
import { loadCareSpaces, loadCareTeam } from "../careTeam";
import { ProfileAvatar, useProfileAvatar } from "../profileAvatar";
import { useCare } from "../store";
import { Icon, Page } from "../ui";
import { useNav } from "./MainScreens";

const PURPLE = "#70338F";
const INK = "#15113C";
const MUTED = "#79738E";

function Glass({
  children, tint = "#F7F1FC", style,
}: {
  children: React.ReactNode;
  tint?: string;
  style?: any;
}) {
  return (
    <View style={[{
      borderRadius: 23, borderWidth: 1, borderColor: "#E8DDF0",
      backgroundColor: "#FFFFFFE9",
      overflow: "hidden",
      shadowColor: "#643D72", shadowOpacity: 0.065,
      shadowRadius: 13, shadowOffset: { width: 0, height: 6 }, elevation: 2,
    }, style]}>
      <View pointerEvents="none" style={{ position: "absolute", right: -1, bottom: -1, opacity: 0.9 }}>
        <Svg width="142" height="66" viewBox="0 0 142 66" accessibilityElementsHidden>
          <Path d="M0 66C31 44 48 9 142 0V66Z" fill={tint} />
          <Path d="M40 66C89 46 97 34 142 29V66Z" fill="#FFFFFF" opacity={0.48}/>
        </Svg>
      </View>
      {children}
    </View>
  );
}

function IconTile({ name, tint = "#F1E6FB" }: { name: string; tint?: string }) {
  return (
    <View style={{
      width: 47, height: 47, borderRadius: 17,
      backgroundColor: tint, alignItems: "center", justifyContent: "center",
    }}>
      <Icon name={name} size={23} color={PURPLE} />
    </View>
  );
}

function ProfileEntry({
  title, subtitle, icon, onPress, tint,
}: {
  title: string;
  subtitle: string;
  icon: string;
  tint?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title + ". " + subtitle}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1, transform: [{ scale: pressed ? 0.987 : 1 }] })}
    >
      <Glass tint={tint}>
        <View style={{ padding: 12, minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12 }}>
          <IconTile name={icon}/>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{
              fontFamily: "DMSans_700Bold", fontSize: 14.2, lineHeight: 19,
              color: INK,
            }}>{title}</Text>
            <Text style={{
              fontFamily: "DMSans_400Regular", fontSize: 11.5, lineHeight: 16,
              color: MUTED,
            }}>{subtitle}</Text>
          </View>
          <Icon name="chevron-forward-outline" size={20} color="#6B5082" />
        </View>
      </Glass>
    </Pressable>
  );
}

function MiniEntry({
  title, subtitle, icon, onPress,
}: {
  title: string; subtitle: string; icon: string; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({ flex: 1, minWidth: 0, opacity: pressed ? 0.7 : 1 })}>
      <Glass>
        <View style={{ minHeight: 117, padding: 12, gap: 8 }}>
          <IconTile name={icon} />
          <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 12.5, lineHeight: 16.5, color: INK }}>
            {title}
          </Text>
          <Text style={{
            fontFamily: "DMSans_400Regular", fontSize: 11, lineHeight: 15,
            color: MUTED,
          }}>{subtitle}</Text>
        </View>
      </Glass>
    </Pressable>
  );
}

function HeroReveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let active = true;
    let animation: Animated.CompositeAnimation | null = null;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => {
      if (!active || reduced) return;
      opacity.setValue(0);
      y.setValue(10);
      animation = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1, duration: 260, delay,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(y, {
          toValue: 0, duration: 260, delay,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]);
      animation.start();
    });
    return () => { active = false; animation?.stop(); };
  }, [delay, opacity, y]);
  return <Animated.View style={{ opacity, transform: [{ translateY: y }] }}>{children}</Animated.View>;
}

export function ProfileDashboardScreen() {
  const n = useNav();
  const { state, dispatch } = useCare();
  const { user, signOut } = useAuth();
  const { url, busy: photoBusy, error: photoError, pickAndUpload, remove } = useProfileAvatar();
  const { width } = useWindowDimensions();
  const compact = width < 385;
  const [editOpen, setEditOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [teamCount, setTeamCount] = useState<number | null>(null);
  const [profileCount, setProfileCount] = useState<number | null>(null);
  const [faithBusy, setFaithBusy] = useState(false);
  const name = (state.name || user?.user_metadata?.full_name || "Caregiver").trim();
  const firstName = name.split(/\s+/)[0];
  const role = state.accessRole === "owner" ? "Primary advocate"
    : state.accessRole === "caregiver" ? "Co-caregiver"
    : state.accessRole === "patient" ? "Care recipient" : "Family member";

  useEffect(() => {
    let active = true;
    setTeamCount(null);
    setProfileCount(null);
    void loadCareSpaces().then((spaces) => {
      if (active) setProfileCount(spaces.length);
    }).catch(() => { if (active) setProfileCount(null); });
    if (state.careRecipientId) {
      void loadCareTeam(state.careRecipientId).then((team) => {
        if (active) setTeamCount(team.members.length);
      }).catch(() => { if (active) setTeamCount(null); });
    }
    return () => { active = false; };
  }, [state.careRecipientId]);

  const changeFaith = useCallback(async (faith: boolean) => {
    if (faithBusy) return;
    setFaithBusy(true);
    setMessage("");
    const original = state.faith;
    dispatch({ type: "profile", name: state.name, relationship: state.relationship, faith });
    try {
      await updateFaithPreference(faith);
      setMessage("Preference saved.");
    } catch {
      dispatch({ type: "profile", name: state.name, relationship: state.relationship, faith: original });
      setMessage("Could not save your preference. Please retry.");
    } finally {
      setFaithBusy(false);
    }
  }, [dispatch, faithBusy, state.faith, state.name, state.relationship]);

  const settings = [
    { title: "Account, privacy & data", subtitle: "Password, exports, consent and deletion.", icon: "shield-checkmark-outline", route: "PrivacyData" },
    { title: "Accessibility & display", subtitle: "Dark theme, text scaling and accessibility.", icon: "accessibility-outline", route: "Accessibility" },
    { title: "Pilot launch validation", subtitle: "Role, device and recovery checks.", icon: "flag-outline", route: "LaunchValidation" },
    { title: "Pilot feedback", subtitle: "Report issues and suggest improvements.", icon: "chatbubble-ellipses-outline", route: "PilotFeedback" },
  ] as const;

  return (
    <Page>
      <HeroReveal>
        <Glass tint="#F0DFFB">
          <View style={{ padding: 18, gap: 12, backgroundColor: "#F9F3FCCD" }}>
            <View pointerEvents="none" style={{ position: "absolute", right: -20, top: -20 }}>
              <Svg width="170" height="140" viewBox="0 0 170 140">
                <Circle cx="118" cy="35" r="76" fill="#F0DDFB" opacity={0.54}/>
                <Circle cx="150" cy="112" r="60" fill="#E7DAFD" opacity={0.45}/>
              </Svg>
            </View>
            <Text style={{
              color: PURPLE, letterSpacing: 2.4, fontFamily: "DMSans_700Bold", fontSize: 10.5,
            }}>YOUR CARE DASHBOARD</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center", minHeight: 130 }}>
              <View style={{ flex: 1, gap: 8 }}>
                <Text accessibilityRole="header" numberOfLines={2}
                  adjustsFontSizeToFit style={{
                    fontFamily: "Lora_500Medium", fontSize: compact ? 31 : 36,
                    lineHeight: compact ? 38 : 43, letterSpacing: -1.1, color: INK,
                  }}>Hello, {firstName}.</Text>
                <Text style={{ color: "#686380", fontFamily: "DMSans_400Regular", fontSize: 12.5, lineHeight: 19 }}>
                  {state.careMode === "self"
                    ? "Your care information, preferences and support settings live here."
                    : "Your care information and support settings, together."}
                </Text>
              </View>
              <View style={{ alignItems: "center", gap: 6 }}>
                <ProfileAvatar name={name} size={compact ? 88 : 102}/>
                <Pressable accessibilityRole="button" accessibilityLabel="Edit profile photo"
                  onPress={() => setEditOpen((open) => !open)}
                  style={({ pressed }) => ({
                    minHeight: 42, paddingHorizontal: 10, flexDirection: "row",
                    gap: 5, alignItems: "center", borderRadius: 18,
                    backgroundColor: "#F8F1FC", borderWidth: 1, borderColor: "#E8D6F3",
                    opacity: pressed ? 0.7 : 1,
                  })}>
                  <Icon name="camera-outline" size={17} color={PURPLE}/>
                  <Text style={{ fontFamily: "DMSans_600SemiBold", color: PURPLE, fontSize: 11 }}>Edit profile</Text>
                </Pressable>
              </View>
            </View>

            {editOpen && (
              <View style={{ gap: 8, padding: 12, backgroundColor: "#FFFFFFDA",
                borderWidth: 1, borderColor: "#E5D6EF", borderRadius: 18 }}>
                <Text style={{ fontFamily: "DMSans_700Bold", fontSize: 13, color: INK }}>Your profile picture</Text>
                <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 11.5, color: MUTED, lineHeight: 17 }}>
                  Choose a JPEG, PNG or WebP image (up to 5 MB). Only you can access the stored photo.
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  <Pressable accessibilityRole="button" accessibilityLabel="Choose and upload profile picture"
                    disabled={photoBusy} onPress={() => void pickAndUpload().then((success) => {
                      if (success) { setMessage("Profile photo updated."); setEditOpen(false); }
                    })}
                    style={({ pressed }) => ({
                      backgroundColor: PURPLE, minHeight: 45, paddingHorizontal: 16, borderRadius: 19,
                      alignItems: "center", justifyContent: "center", opacity: photoBusy ? 0.5 : pressed ? 0.75 : 1,
                    })}>
                    <Text style={{ color: "#FFFFFF", fontFamily: "DMSans_700Bold", fontSize: 12.5 }}>
                      {photoBusy ? "Saving photo…" : "Choose photo"}
                    </Text>
                  </Pressable>
                  {url && (
                    <Pressable accessibilityRole="button" accessibilityLabel="Remove profile picture"
                      disabled={photoBusy} onPress={() => void remove().then((success) => {
                        if (success) { setMessage("Profile photo removed."); setEditOpen(false); }
                      })}
                      style={{ minHeight: 45, paddingHorizontal: 12, justifyContent: "center" }}>
                      <Text style={{ color: "#9B3B6C", fontFamily: "DMSans_600SemiBold", fontSize: 12.5 }}>Remove photo</Text>
                    </Pressable>
                  )}
                </View>
                {photoBusy && <ActivityIndicator color={PURPLE}/>}
                {Boolean(photoError) && (
                  <Text accessibilityRole="alert" style={{ color: "#B82C56", fontSize: 12.5 }}>{photoError}</Text>
                )}
              </View>
            )}
          </View>
        </Glass>
      </HeroReveal>

      <HeroReveal delay={45}>
        <Glass>
          <View
            accessibilityLabel={`Care overview. ${role}. ${teamCount === null ? "Care team count unavailable" : teamCount + " care team members"}. ${profileCount === null ? "Care profile count unavailable" : profileCount + " care profiles"}.`}
            style={{ flexDirection: "row", paddingVertical: 13, paddingHorizontal: 7 }}
          >
            {[
              { title: role, value: "You", icon: "person-outline" },
              { title: "Care team", value: teamCount === null ? "—" : `${teamCount} members`, icon: "people-outline" },
              { title: "Care profiles", value: profileCount === null ? "—" : `${profileCount} profiles`, icon: "document-text-outline" },
            ].map((item, index) => (
              <React.Fragment key={item.title}>
                {index > 0 && (
                  <View style={{ width: 1, marginVertical: 6, backgroundColor: "#E4D7ED" }} />
                )}
                <View style={{
                  flex: 1, minWidth: 0, paddingHorizontal: 6,
                  alignItems: "center", gap: 5, justifyContent: "center",
                }}>
                  <Icon name={item.icon} size={22} color={PURPLE} />
                  <Text numberOfLines={2} style={{
                    fontFamily: "DMSans_700Bold", color: INK,
                    fontSize: compact ? 10 : 11, textAlign: "center", lineHeight: 14,
                  }}>{item.title}</Text>
                  <Text numberOfLines={1} style={{
                    fontFamily: "DMSans_400Regular", color: MUTED,
                    fontSize: 10, textAlign: "center",
                  }}>{item.value}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </Glass>
      </HeroReveal>

      <View style={{ gap: 10 }}>
        <Text accessibilityRole="header" style={{
          fontFamily: "Lora_500Medium", color: INK, fontSize: 23, lineHeight: 31,
        }}>Account overview</Text>
        <Glass>
          <View style={{ flexDirection: "row", alignItems: "stretch", paddingVertical: 14, paddingHorizontal: 10 }}>
            <View style={{ flex: 1.55, gap: 8, alignItems: "center", justifyContent: "center" }}>
              <Icon name="mail-outline" size={22} color={PURPLE}/>
              <Text style={{ fontFamily: "DMSans_700Bold", color: INK, fontSize: 12 }}>Your account</Text>
              <Text numberOfLines={2} style={{
                fontFamily: "DMSans_400Regular", color: MUTED,
                textAlign: "center", fontSize: 10.5, lineHeight: 14,
              }}>{user?.email || "Signed in"}</Text>
            </View>
            <View style={{ width: 1, backgroundColor: "#E9DFEF", marginHorizontal: 6 }}/>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
              <Icon name="analytics-outline" size={23} color={PURPLE}/>
              <Text style={{ fontFamily: "Lora_500Medium", color: INK, fontSize: 23 }}>{state.entries.length}</Text>
              <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 10.5, color: MUTED, textAlign: "center" }}>Care observations</Text>
            </View>
            <View style={{ width: 1, backgroundColor: "#E9DFEF", marginHorizontal: 6 }}/>
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 4 }}>
              <Icon name="bookmark-outline" size={23} color={PURPLE}/>
              <Text style={{ fontFamily: "Lora_500Medium", color: INK, fontSize: 23 }}>{state.saved.length}</Text>
              <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 10.5, color: MUTED, textAlign: "center" }}>Saved resources</Text>
            </View>
          </View>
        </Glass>
      </View>

      <View style={{ gap: 9 }}>
        <Text accessibilityRole="header" style={{ fontFamily: "DMSans_700Bold", fontSize: 19, color: INK, marginBottom: 2 }}>
          Account & preferences
        </Text>
        <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12.5, lineHeight: 18, color: MUTED, marginBottom: 4 }}>
          Your personal settings stay here. Care tasks and team coordination live in the Care tab.
        </Text>
        <View style={{ flexDirection: "row", gap: 9 }}>
          {settings.slice(0, 2).map((item) => (
            <MiniEntry key={item.title} title={item.title} subtitle={item.subtitle}
              icon={item.icon} onPress={() => n.navigate(item.route)} />
          ))}
        </View>
        <View style={{ flexDirection: "row", gap: 9 }}>
          {settings.slice(2).map((item) => (
            <MiniEntry key={item.title} title={item.title} subtitle={item.subtitle}
              icon={item.icon} onPress={() => n.navigate(item.route)} />
          ))}
        </View>
        <ProfileEntry title="Notification preferences"
          subtitle="Push updates, quiet hours and alert categories."
          icon="notifications-outline"
          onPress={() => n.navigate("NotificationSettings")}
        />
        <Glass>
          <View style={{
            minHeight: 68, paddingHorizontal: 14, paddingVertical: 9,
            flexDirection: "row", gap: 12, alignItems: "center",
          }}>
            <IconTile name="heart-outline"/>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: INK, fontFamily: "DMSans_700Bold", fontSize: 13, lineHeight: 18 }}>
                Spiritual encouragement on home
              </Text>
              <Text style={{ color: MUTED, fontFamily: "DMSans_400Regular", fontSize: 11.5 }}>
                Receive uplifting messages and prayers.
              </Text>
            </View>
            <Switch accessibilityLabel="Spiritual encouragement on home" value={state.faith}
              disabled={faithBusy} onValueChange={(value) => void changeFaith(value)}
              trackColor={{ false: "#DCD6E4", true: "#B789DA" }} thumbColor={PURPLE}/>
          </View>
        </Glass>
      </View>

      {Boolean(message) && (
        <Text accessibilityRole="alert" style={{
          color: "#75338F", fontFamily: "DMSans_600SemiBold", fontSize: 12.5,
        }}>{message}</Text>
      )}
      <Pressable accessibilityRole="button" accessibilityLabel="Sign out"
        onPress={() => void signOut()}
        style={({ pressed }) => ({
          minHeight: 55, borderRadius: 27, backgroundColor: "#F4E9FC",
          alignItems: "center", justifyContent: "center",
          flexDirection: "row", gap: 7, opacity: pressed ? 0.7 : 1,
          borderColor: "#E6D4F0", borderWidth: 1,
        })}>
        <Icon name="log-out-outline" size={21} color={PURPLE}/>
        <Text style={{ color: PURPLE, fontFamily: "DMSans_700Bold", fontSize: 15 }}>Sign out</Text>
      </Pressable>
      <Text style={{
        color: "#82798F", fontFamily: "DMSans_400Regular",
        fontSize: 10.5, lineHeight: 16, textAlign: "center",
      }}>
        EnVizion Life Caregiver Toolkit & Patient Advocate Support Program.
        {"\n"}Founded by Dr. Delphine Tolbert, DNP, RN, CLC.
      </Text>
    </Page>
  );
}
