import React, { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useAuth } from "../auth";
import { useCare } from "../store";
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
