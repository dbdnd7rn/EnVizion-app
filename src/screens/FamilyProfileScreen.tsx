import React, { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../auth";
import { useCare } from "../store";
import {
  loadCareSpaces,
  loadPendingCareInvitations,
  respondToCareInvitation,
  setActiveCareRecipient,
  type CareInvitation,
  type CareSpace,
  type CareRole,
} from "../careTeam";
import { ProfileAvatar, useProfileAvatar } from "../profileAvatar";
import { themeBackground, themeBorder, themeForeground, themeShadow } from "../themeColors";
import { Brand, Icon, Page } from "../ui";
import { useNav } from "./MainScreens";

const PURPLE = "#70338F";
const INK = "#17143C";
const MUTED = "#77718A";
const REGULAR = "DMSans_400Regular";
const SEMI = "DMSans_600SemiBold";

function FamilyProfileCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: themeBackground("#FFFDFF"),
      borderWidth: 1,
      borderColor: themeBorder("#E8DDF0"),
      borderRadius: 25,
      padding: 18,
      gap: 13,
      shadowColor: themeShadow("#673781"),
      shadowOpacity: 0.05,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    }}>
      {children}
    </View>
  );
}

function FamilyProfileLink({
  icon, title, subtitle, onPress,
}: {
  icon: string;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 13,
        paddingVertical: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 46, height: 46, borderRadius: 15,
        backgroundColor: themeBackground("#F2E7FA"),
        alignItems: "center", justifyContent: "center",
      }}>
        <Icon name={icon} color={themeForeground(PURPLE)} size={22} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: SEMI, fontSize: 14, color: themeForeground(INK) }}>
          {title}
        </Text>
        <Text style={{
          fontFamily: REGULAR, fontSize: 12, lineHeight: 18,
          color: themeForeground(MUTED),
        }}>
          {subtitle}
        </Text>
      </View>
      <Icon name="chevron-forward-outline" color={themeForeground("#877793")} size={19} />
    </Pressable>
  );
}


function familyRoleText(role: CareRole): string {
  return ({
    owner: "Primary Advocate",
    caregiver: "Co-Caregiver",
    patient: "Care Recipient",
    viewer: "Family Member",
  })[role];
}

/**
 * Account-level invitation controls, deliberately separate from the four
 * family care tools. A viewer cannot manage other members or clinical records.
 */
export function AccountCareAccessPanel() {
  const n = useNav();
  const { refresh } = useCare();
  const [invitations, setInvitations] = useState<CareInvitation[]>([]);
  const [spaces, setSpaces] = useState<CareSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    return Promise.all([loadPendingCareInvitations(), loadCareSpaces()]);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError("");
    void load()
      .then(([pending, accessible]) => {
        if (!active) return;
        setInvitations(pending);
        setSpaces(accessible);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load your care invitations.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]));

  async function respond(invitation: CareInvitation, action: "accept" | "decline") {
    if (busy) return;
    setBusy(invitation.careRecipientId);
    setError("");
    try {
      await respondToCareInvitation(invitation.careRecipientId, action);
      if (action === "accept") {
        await refresh();
        n.reset({ index: 0, routes: [{ name: "Main" }] });
      } else {
        const [pending, accessible] = await load();
        setInvitations(pending);
        setSpaces(accessible);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not respond to this invitation.");
    } finally {
      setBusy(null);
    }
  }

  async function switchSpace(space: CareSpace) {
    if (space.active || busy) return;
    setBusy(space.careRecipientId);
    setError("");
    try {
      await setActiveCareRecipient(space.careRecipientId);
      await refresh();
      n.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not switch care profiles.");
    } finally {
      setBusy(null);
    }
  }

  return <FamilyProfileCard>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <View style={{ width: 44, height: 44, borderRadius: 16,
        backgroundColor: themeBackground("#F2E7FA"),
        alignItems: "center", justifyContent: "center" }}>
        <Icon name="people-outline" color={themeForeground(PURPLE)} size={23} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontFamily: SEMI, fontSize: 17,
          color: themeForeground(INK) }}>Invitations & care spaces</Text>
        <Text style={{ fontFamily: REGULAR, fontSize: 12, lineHeight: 18,
          color: themeForeground(MUTED) }}>
          Accept invitations and switch between care profiles you are authorized to view.
        </Text>
      </View>
    </View>
    {loading && <ActivityIndicator color={themeForeground(PURPLE)} />}
    {Boolean(error) && <Text accessibilityRole="alert"
      style={{ fontFamily: REGULAR, fontSize: 12, color: themeForeground("#A23F66") }}>
      {error}
    </Text>}
    {!loading && invitations.length > 0 && <View style={{ gap: 11 }}>
      <Text style={{ fontFamily: SEMI, fontSize: 13.5,
        color: themeForeground(INK) }}>Pending invitations ({invitations.length})</Text>
      {invitations.map(invitation => <View key={invitation.careRecipientId}
        style={{ backgroundColor: themeBackground("#F6EFFA"),
          borderRadius: 19, borderWidth: 1, borderColor: themeBorder("#E7D9F0"),
          padding: 14, gap: 10 }}>
        <Text style={{ fontFamily: SEMI, fontSize: 14,
          color: themeForeground(INK) }}>{invitation.careRecipientName}</Text>
        <Text style={{ fontFamily: REGULAR, fontSize: 12, lineHeight: 19,
          color: themeForeground(MUTED) }}>
          {invitation.inviterName} invited you as a {familyRoleText(invitation.role)}.
          Access remains inactive until you accept.
        </Text>
        {Boolean(invitation.inviteExpiresAt) && <Text style={{
          fontFamily: REGULAR, fontSize: 11, color: themeForeground(MUTED),
        }}>Invitation expires {new Date(invitation.inviteExpiresAt!).toLocaleDateString()}</Text>}
        <View style={{ flexDirection: "row", gap: 9 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Accept care invitation"
            disabled={busy !== null} onPress={() => void respond(invitation, "accept")}
            style={{ flex: 1, padding: 12, borderRadius: 17,
              backgroundColor: themeBackground("#70338F"), alignItems: "center",
              opacity: busy !== null ? 0.55 : 1 }}>
            <Text style={{ color: themeForeground("#FFFFFF"), fontFamily: SEMI, fontSize: 12 }}>
              {busy === invitation.careRecipientId ? "Updating…" : "Accept"}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Decline care invitation"
            disabled={busy !== null} onPress={() => void respond(invitation, "decline")}
            style={{ flex: 1, padding: 12, borderRadius: 17,
              backgroundColor: themeBackground("#FFFFFF"), alignItems: "center",
              borderColor: themeBorder("#E4D6EE"), borderWidth: 1,
              opacity: busy !== null ? 0.55 : 1 }}>
            <Text style={{ color: themeForeground(PURPLE), fontFamily: SEMI, fontSize: 12 }}>
              Decline
            </Text>
          </Pressable>
        </View>
      </View>)}
    </View>}
    {!loading && !invitations.length &&
      <Text style={{ fontFamily: REGULAR, fontSize: 12,
        color: themeForeground(MUTED) }}>No invitations waiting for your response.</Text>}
    {!loading && spaces.length > 0 && <View style={{ gap: 10 }}>
      <Text style={{ fontFamily: SEMI, fontSize: 13.5,
        color: themeForeground(INK) }}>Your care profiles</Text>
      {spaces.map(space => <Pressable key={space.careRecipientId}
        accessibilityRole="button"
        accessibilityLabel={space.active
          ? space.careRecipientName + ", current care profile"
          : "Switch to " + space.careRecipientName}
        accessibilityState={{ selected: space.active, disabled: space.active || busy !== null }}
        onPress={() => void switchSpace(space)}
        disabled={space.active || busy !== null}
        style={{ flexDirection: "row", gap: 10, alignItems: "center",
          borderRadius: 18, padding: 12, borderWidth: 1,
          borderColor: themeBorder(space.active ? "#D7BDE8" : "#ECE3F1"),
          backgroundColor: themeBackground(space.active ? "#F4EBFA" : "#FFFEFF"),
          opacity: busy !== null && !space.active ? 0.7 : 1 }}>
        <Icon name={space.active ? "checkmark-circle-outline" : "heart-outline"}
          size={22} color={themeForeground(PURPLE)} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={{ fontFamily: SEMI, fontSize: 13,
            color: themeForeground(INK) }}>{space.careRecipientName}</Text>
          <Text style={{ fontFamily: REGULAR, fontSize: 11,
            color: themeForeground(MUTED) }}>{familyRoleText(space.role)}
            {space.active ? " · Current profile" : ""}</Text>
        </View>
        {!space.active && <Icon name="chevron-forward-outline" size={20}
          color={themeForeground(PURPLE)} />}
      </Pressable>)}
    </View>}
  </FamilyProfileCard>;
}

export function FamilyProfileScreen() {
  const n = useNav();
  const { state } = useCare();
  const { user, signOut } = useAuth();
  const { url, busy: photoBusy, error: photoError, pickAndUpload, remove } = useProfileAvatar();
  const [photoOpen, setPhotoOpen] = useState(false);
  const [message, setMessage] = useState("");
  const fullName = (state.name || user?.user_metadata?.full_name || "Family Member").trim();
  const role = "Family Member";
  const email = user?.email || "No email available";

  const settings = [
    {
      title: "Account, privacy & data",
      subtitle: "Account security, consent and your data.",
      icon: "shield-checkmark-outline",
      route: "PrivacyData",
    },
    {
      title: "Accessibility & display",
      subtitle: "Dark theme, text and accessibility settings.",
      icon: "accessibility-outline",
      route: "Accessibility",
    },
    {
      title: "Notification preferences",
      subtitle: "Manage notifications and quiet hours.",
      icon: "notifications-outline",
      route: "NotificationSettings",
    },
    {
      title: "Send feedback",
      subtitle: "Report a problem or suggest an improvement.",
      icon: "chatbubble-ellipses-outline",
      route: "PilotFeedback",
    },
  ] as const;

  return (
    <Page>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Brand />
        <View style={{
          borderRadius: 18,
          backgroundColor: themeBackground("#F2E8FA"),
          paddingHorizontal: 13,
          paddingVertical: 8,
        }}>
          <Text style={{ fontFamily: SEMI, fontSize: 11, color: themeForeground(PURPLE) }}>
            FAMILY ACCOUNT
          </Text>
        </View>
      </View>

      <View style={{ gap: 5 }}>
        <Text style={{
          fontFamily: SEMI, letterSpacing: 2.1, fontSize: 10,
          color: themeForeground(PURPLE),
        }}>
          YOUR PROFILE
        </Text>
        <Text
          accessibilityRole="header"
          style={{
            fontFamily: "Lora_500Medium",
            fontSize: 30, lineHeight: 40,
            color: themeForeground(INK),
          }}
        >
          Your space in the care team.
        </Text>
        <Text style={{
          fontFamily: REGULAR, fontSize: 13,
          lineHeight: 20, color: themeForeground(MUTED),
        }}>
          Your personal information, role and account preferences.
        </Text>
      </View>

      <FamilyProfileCard>
        <View style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          borderRadius: 20,
          backgroundColor: themeBackground("#F9F2FC"),
          padding: 14,
        }}>
          <ProfileAvatar name={fullName} size={84} />
          <View style={{ flex: 1, gap: 5 }}>
            <Text
              numberOfLines={2}
              style={{
                fontFamily: SEMI, fontSize: 20,
                lineHeight: 26, color: themeForeground(INK),
              }}
            >
              {fullName}
            </Text>
            <View style={{
              alignSelf: "flex-start",
              backgroundColor: themeBackground("#EBDDF7"),
              paddingHorizontal: 11, paddingVertical: 6,
              borderRadius: 16,
            }}>
              <Text style={{
                fontFamily: SEMI, fontSize: 12,
                color: themeForeground(PURPLE),
              }}>
                {role}
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Edit profile photo"
          accessibilityState={{ expanded: photoOpen }}
          onPress={() => setPhotoOpen(open => !open)}
          style={({ pressed }) => ({
            minHeight: 44, borderRadius: 20,
            borderWidth: 1, borderColor: themeBorder("#E6D6F1"),
            backgroundColor: themeBackground("#F6ECFB"),
            flexDirection: "row", gap: 9,
            alignItems: "center", justifyContent: "center",
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Icon name="camera-outline" size={18} color={themeForeground(PURPLE)} />
          <Text style={{
            fontFamily: SEMI, fontSize: 13, color: themeForeground(PURPLE),
          }}>
            {photoOpen ? "Close photo options" : "Edit profile photo"}
          </Text>
        </Pressable>

        {photoOpen && (
          <View style={{
            padding: 13, gap: 12, borderRadius: 18,
            backgroundColor: themeBackground("#FCF8FF"),
            borderWidth: 1, borderColor: themeBorder("#EBDEF3"),
          }}>
            <Text style={{
              fontFamily: REGULAR, fontSize: 12,
              lineHeight: 19, color: themeForeground(MUTED),
            }}>
              Choose a JPEG, PNG or WebP image, up to 5 MB.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Choose and upload profile photo"
                disabled={photoBusy}
                onPress={() => {
                  setMessage("");
                  void pickAndUpload().then(success => {
                    if (success) {
                      setMessage("Your photo has been updated.");
                      setPhotoOpen(false);
                    }
                  });
                }}
                style={({ pressed }) => ({
                  minHeight: 44, borderRadius: 20,
                  paddingHorizontal: 17, alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: themeBackground(PURPLE),
                  opacity: photoBusy ? 0.5 : pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontFamily: SEMI, fontSize: 13, color: themeForeground("#FFFFFF") }}>
                  {photoBusy ? "Uploading…" : "Choose photo"}
                </Text>
              </Pressable>
              {Boolean(url) && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Remove profile photo"
                  disabled={photoBusy}
                  onPress={() => {
                    setMessage("");
                    void remove().then(success => {
                      if (success) {
                        setMessage("Your photo has been removed.");
                        setPhotoOpen(false);
                      }
                    });
                  }}
                  style={{ minHeight: 44, paddingHorizontal: 8, justifyContent: "center" }}
                >
                  <Text style={{ fontFamily: SEMI, fontSize: 13, color: themeForeground("#A23869") }}>
                    Remove photo
                  </Text>
                </Pressable>
              )}
            </View>
            {photoBusy && <ActivityIndicator color={themeForeground(PURPLE)} />}
            {Boolean(photoError) && (
              <Text accessibilityRole="alert" style={{
                fontFamily: REGULAR, fontSize: 12, color: themeForeground("#AB365B"),
              }}>
                {photoError}
              </Text>
            )}
          </View>
        )}
        {Boolean(message) && (
          <Text accessibilityRole="alert" style={{
            fontFamily: SEMI, fontSize: 12, color: themeForeground(PURPLE),
          }}>
            {message}
          </Text>
        )}
      </FamilyProfileCard>

      <FamilyProfileCard>
        <Text style={{
          fontFamily: SEMI, fontSize: 17, color: themeForeground(INK),
        }}>
          Account details
        </Text>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 11 }}>
          <Icon name="mail-outline" size={20} color={themeForeground(PURPLE)} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: SEMI, fontSize: 12, color: themeForeground(INK) }}>
              Signed-in email
            </Text>
            <Text selectable style={{
              fontFamily: REGULAR, fontSize: 13, color: themeForeground(MUTED),
            }}>
              {email}
            </Text>
          </View>
        </View>
        <View style={{
          height: 1, backgroundColor: themeBorder("#EEE4F3"),
        }} />
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 11 }}>
          <Icon name="people-outline" size={20} color={themeForeground(PURPLE)} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: SEMI, fontSize: 12, color: themeForeground(INK) }}>
              Your care-team role
            </Text>
            <Text style={{ fontFamily: REGULAR, fontSize: 13, color: themeForeground(MUTED) }}>
              Family Member · Approved shared information only
            </Text>
          </View>
        </View>
        <View style={{
          height: 1, backgroundColor: themeBorder("#EEE4F3"),
        }} />
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 11 }}>
          <Icon name="heart-outline" size={20} color={themeForeground(PURPLE)} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ fontFamily: SEMI, fontSize: 12, color: themeForeground(INK) }}>
              Connected care profile
            </Text>
            <Text style={{ fontFamily: REGULAR, fontSize: 13, color: themeForeground(MUTED) }}>
              {state.careRecipientName || "No care profile selected"}
            </Text>
          </View>
        </View>
        <Text style={{
          fontFamily: REGULAR, fontSize: 11, lineHeight: 18,
          color: themeForeground(MUTED),
        }}>
          Your role is managed by the Primary Advocate. You can view only information shared with your role.
        </Text>
      </FamilyProfileCard>

      <AccountCareAccessPanel />

      <FamilyProfileCard>
        <Text style={{
          fontFamily: SEMI, fontSize: 17, color: themeForeground(INK),
        }}>
          Account & preferences
        </Text>
        {settings.map((item, index) => (
          <React.Fragment key={item.title}>
            {index > 0 && (
              <View style={{ height: 1, backgroundColor: themeBorder("#F0E8F3") }} />
            )}
            <FamilyProfileLink
              title={item.title}
              subtitle={item.subtitle}
              icon={item.icon}
              onPress={() => n.navigate(item.route)}
            />
          </React.Fragment>
        ))}
      </FamilyProfileCard>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        onPress={() => void signOut()}
        style={({ pressed }) => ({
          minHeight: 55, borderRadius: 26,
          backgroundColor: themeBackground("#F3E9FA"),
          borderWidth: 1, borderColor: themeBorder("#E5D6EF"),
          flexDirection: "row", alignItems: "center",
          justifyContent: "center", gap: 9,
          opacity: pressed ? 0.75 : 1,
        })}
      >
        <Icon name="log-out-outline" size={20} color={themeForeground(PURPLE)} />
        <Text style={{ fontFamily: SEMI, fontSize: 14, color: themeForeground(PURPLE) }}>
          Sign out
        </Text>
      </Pressable>
      <Text style={{
        textAlign: "center", fontFamily: REGULAR, fontSize: 11,
        lineHeight: 17, color: themeForeground(MUTED),
      }}>
        Your family access does not allow changes to clinical care records.
      </Text>
    </Page>
  );
}
