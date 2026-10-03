import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import {
  loadEmergencyCenterData,
  saveEmergencyProfile,
  type EmergencyCenterData,
} from "../emergencyCenter";
import {
  emergencyProfileCompleteness,
  emergencyReviewLabel,
} from "../emergencyCenterHelpers";
import {
  buildEmergencyOfflineSummary,
  buildEmergencyOnePageHtml,
  cacheEmergencyOfflineSummary,
  emergencyCodeStatusLabel,
  emergencyPoaStatusLabel,
  loadEmergencyOfflineSummary,
  type EmergencyOfflineSummary,
} from "../emergencyOffline";
import {
  createEmergencyShareLink,
  loadEmergencyShareLinks,
  revokeEmergencyShareLink,
  type CreatedEmergencyShareLink,
  type EmergencyShareLink,
} from "../emergencyShare";
import { medicationReconciliationLabel } from "../medicationManagementHelpers";
import { printHtmlResource } from "../printing";
import { supabase } from "../supabase";
import { useCare } from "../store";
import {
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

const codeStatusChoices = [
  ["unknown", "Not recorded"],
  ["full_code", "Full code"],
  ["dnr", "DNR"],
  ["dni", "DNI"],
  ["dnr_dni", "DNR / DNI"],
  ["other", "Other"],
] as const;

const poaStatusChoices = [
  ["unknown", "Not recorded"],
  ["none", "No POA"],
  ["on_file", "POA on file"],
  ["not_on_file", "POA identified"],
] as const;

const emptyData = (): EmergencyCenterData => ({
  profile: null,
  recipient: {
    displayName: "Care profile",
    emergencyContactName: "",
    emergencyContactPhone: "",
  },
  contacts: [],
  keyDocuments: [],
  medications: [],
  latestReconciliation: null,
  transitionPlan: null,
  transitionFollowUps: [],
});

async function callNumber(value: string) {
  const normalized = value.replace(/[^+0-9*#]/g, "");
  if (!normalized) throw new Error("No phone number is recorded.");
  await Linking.openURL("tel:" + normalized);
}

function EmergencyHeroArt() {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 230 190" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="kitBody" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="1" stopColor="#DDD0F8" />
        </LinearGradient>
        <LinearGradient id="kitEdge" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A66BF0" />
          <Stop offset="1" stopColor="#6235B6" />
        </LinearGradient>
        <LinearGradient id="cross" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#FF7892" />
          <Stop offset="1" stopColor="#F04462" />
        </LinearGradient>
      </Defs>

      <Circle cx="126" cy="91" r="84" fill="#F2EAFF" />
      <Circle cx="186" cy="45" r="40" fill="#E3D4FF" opacity={0.88} />
      <Ellipse cx="45" cy="96" rx="35" ry="56" fill="#EFE7FF" transform="rotate(-28 45 96)" />
      <Ellipse cx="194" cy="137" rx="31" ry="56" fill="#D9C8FA" transform="rotate(28 194 137)" />

      <G transform="translate(71 42) rotate(7 59 62)">
        <Rect x="5" y="8" width="116" height="108" rx="25" fill="#6540B0" opacity={0.14} />
        <Rect x="0" y="0" width="116" height="108" rx="25" fill="url(#kitBody)" stroke="#C8B5EB" strokeWidth="2" />
        <Rect x="32" y="-14" width="52" height="29" rx="12" fill="url(#kitEdge)" />
        <Rect x="43" y="-7" width="30" height="14" rx="7" fill="#7F52C8" />
        <Path d="M49 28H67V45H84V63H67V80H49V63H32V45H49Z" fill="url(#cross)" />
        <Path d="M84 72C84 59 94 50 106 50C118 50 127 59 127 72V98H84V72Z" fill="#6D40BE" />
        <Path d="M101 60H110V70H120V79H110V89H101V79H92V70H101Z" fill="#F6F0FF" />
      </G>

      <Path d="M32 154C46 137 55 123 64 107" stroke="#D1BCEE" strokeWidth="5" strokeLinecap="round" />
      <Path d="M207 158C199 137 193 121 180 108" stroke="#CAB4EC" strokeWidth="5" strokeLinecap="round" />
    </Svg>
  );
}

function SmallStatusCard({
  icon,
  eyebrow,
  value,
  accent,
  background,
}: {
  icon: string;
  eyebrow: string;
  value: string;
  accent: string;
  background: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minHeight: 124,
        borderRadius: 24,
        padding: 15,
        backgroundColor: background,
        borderWidth: 1,
        borderColor: "#EAE4F2",
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
      }}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          backgroundColor: "#FFFFFFB8",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={24} color={accent} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[S.eyebrow, { color: accent, letterSpacing: 1.8 }]}>{eyebrow}</Text>
        <Text
          numberOfLines={2}
          style={{
            fontFamily: "DMSans_700Bold",
            fontSize: 18,
            lineHeight: 22,
            color: C.ink,
          }}
        >
          {value}
        </Text>
        <View style={{ height: 7, borderRadius: 4, backgroundColor: "#FFFFFF9C", overflow: "hidden", marginTop: 4 }}>
          <View style={{ width: "18%", height: 7, borderRadius: 4, backgroundColor: accent + "30" }} />
        </View>
      </View>
      <Icon name="chevron-forward-outline" size={18} color={accent} />
    </View>
  );
}

function ContactTile({
  title,
  icon,
  accent,
  background,
  dashed,
  onPress,
}: {
  title: string;
  icon: string;
  accent: string;
  background: string;
  dashed?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minHeight: 128,
        borderRadius: 22,
        backgroundColor: background,
        borderWidth: dashed ? 1.5 : 0,
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: dashed ? "#B98AE3" : "transparent",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          width: 50,
          height: 50,
          borderRadius: 25,
          backgroundColor: "#FFFFFFA8",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={24} color={accent} />
      </View>
      <Text
        style={[
          S.h3,
          { fontSize: 13, lineHeight: 17, textAlign: "center", color: accent },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function ProfileTile({
  title,
  value,
  icon,
  accent,
  background,
  onPress,
}: {
  title: string;
  value: string;
  icon: string;
  accent: string;
  background: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "48.5%",
        minHeight: 104,
        borderRadius: 22,
        backgroundColor: background,
        padding: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: "#FFFFFFA8",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={23} color={accent} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[S.h3, { fontSize: 13, lineHeight: 17 }]}>{title}</Text>
        <Text style={[S.small, { color: C.muted }]} numberOfLines={1}>
          {value || "Not set"}
        </Text>
      </View>
      <Icon name="chevron-forward-outline" size={17} color={accent} />
    </Pressable>
  );
}

export function EmergencyCenterScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly =
    state.accessRole === "viewer" || state.accessRole === "patient";

  const [data, setData] = useState<EmergencyCenterData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [offlineSummary, setOfflineSummary] =
    useState<EmergencyOfflineSummary | null>(null);
  const [shareLinks, setShareLinks] = useState<EmergencyShareLink[]>([]);
  const [createdShare, setCreatedShare] =
    useState<CreatedEmergencyShareLink | null>(null);
  const [shareMinutes, setShareMinutes] = useState(60);

  const [localEmergencyNumber, setLocalEmergencyNumber] = useState("");
  const [preferredHospital, setPreferredHospital] = useState("");
  const [allergies, setAllergies] = useState("");
  const [importantConditions, setImportantConditions] = useState("");
  const [medicalDevices, setMedicalDevices] = useState("");
  const [advanceDirectiveLocation, setAdvanceDirectiveLocation] = useState("");
  const [emergencyNotes, setEmergencyNotes] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [primaryLanguage, setPrimaryLanguage] = useState("");
  const [codeStatus, setCodeStatus] =
    useState<NonNullable<EmergencyCenterData["profile"]>["codeStatus"]>("unknown");
  const [dnrLocation, setDnrLocation] = useState("");
  const [poaStatus, setPoaStatus] =
    useState<NonNullable<EmergencyCenterData["profile"]>["poaStatus"]>("unknown");
  const [poaName, setPoaName] = useState("");
  const [poaPhone, setPoaPhone] = useState("");

  const applyProfile = useCallback((next: EmergencyCenterData) => {
    setData(next);
    const profile = next.profile;
    setLocalEmergencyNumber(profile?.localEmergencyNumber ?? "");
    setPreferredHospital(profile?.preferredHospital ?? "");
    setAllergies(profile?.allergies ?? "");
    setImportantConditions(profile?.importantConditions ?? "");
    setMedicalDevices(profile?.medicalDevices ?? "");
    setAdvanceDirectiveLocation(profile?.advanceDirectiveLocation ?? "");
    setEmergencyNotes(profile?.emergencyNotes ?? "");
    setBloodType(profile?.bloodType ?? "");
    setPrimaryLanguage(profile?.primaryLanguage ?? "");
    setCodeStatus(profile?.codeStatus ?? "unknown");
    setDnrLocation(profile?.dnrLocation ?? "");
    setPoaStatus(profile?.poaStatus ?? "unknown");
    setPoaName(profile?.poaName ?? "");
    setPoaPhone(profile?.poaPhone ?? "");
  }, []);

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      applyProfile(emptyData());
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const next = await loadEmergencyCenterData(careRecipientId);
      applyProfile(next);
      const cached = await cacheEmergencyOfflineSummary(careRecipientId, next);
      setOfflineSummary(cached);

      if (!readOnly) {
        try {
          setShareLinks(await loadEmergencyShareLinks(careRecipientId));
        } catch {
          setShareLinks([]);
        }
      } else {
        setShareLinks([]);
      }

      setMessage("");
    } catch (error) {
      const cached = await loadEmergencyOfflineSummary(careRecipientId);
      setOfflineSummary(cached);
      setShareLinks([]);
      setMessage(
        cached
          ? "You appear to be offline. Showing the last securely cached emergency snapshot."
          : error instanceof Error
            ? error.message
            : "We could not load emergency information.",
      );
    } finally {
      setLoading(false);
    }
  }, [applyProfile, careRecipientId, readOnly]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`emergency-center:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_emergency_profiles",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const completeness = useMemo(
    () => emergencyProfileCompleteness(data),
    [data],
  );

  const criticalSummary = useMemo(() => {
    if (data.profile) {
      return buildEmergencyOfflineSummary(careRecipientId, data);
    }
    return offlineSummary;
  }, [careRecipientId, data, offlineSummary]);

  async function createShare() {
    if (!careRecipientId || readOnly || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const created = await createEmergencyShareLink({
        careRecipientId,
        expiresInMinutes: shareMinutes,
      });
      setCreatedShare(created);
      setShareLinks(await loadEmergencyShareLinks(careRecipientId));
      setMessage(
        `Temporary emergency link created. It expires ${new Date(
          created.expiresAt,
        ).toLocaleString()}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not create the temporary emergency link.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function revokeShare(shareId: string) {
    if (readOnly || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await revokeEmergencyShareLink(shareId);
      if (createdShare?.id === shareId) setCreatedShare(null);
      if (careRecipientId) {
        setShareLinks(await loadEmergencyShareLinks(careRecipientId));
      }
      setMessage("Temporary emergency link revoked.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not revoke the temporary emergency link.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function exportOnePageSummary() {
    if (!criticalSummary || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await printHtmlResource(
        "Emergency Care Summary",
        buildEmergencyOnePageHtml(criticalSummary),
      );
      setMessage("Emergency one-page summary prepared for printing or PDF sharing.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not create the emergency summary.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function save(markReviewed = false) {
    if (!careRecipientId || readOnly || busy) return;

    setBusy(true);
    setMessage("");
    try {
      await saveEmergencyProfile({
        careRecipientId,
        id: data.profile?.id,
        localEmergencyNumber,
        preferredHospital,
        allergies,
        importantConditions,
        medicalDevices,
        advanceDirectiveLocation,
        emergencyNotes,
        bloodType,
        primaryLanguage,
        codeStatus,
        dnrLocation,
        poaStatus,
        poaName,
        poaPhone,
        markReviewed,
      });
      setEditing(false);
      await refresh();
      setMessage(
        markReviewed
          ? "Emergency information reviewed and timestamped."
          : "Emergency information saved.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save emergency information.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="EMERGENCY INFORMATION"
          title="Choose a care profile first."
        />
      </Page>
    );
  }

  return (
    <Page>
      <View
        style={{
          minHeight: 58,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => n.goBack()}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F6F0FD",
            opacity: pressed ? 0.68 : 1,
          })}
        >
          <Icon name="chevron-back-outline" size={25} color="#241B53" />
        </Pressable>

        <Text
          accessibilityRole="header"
          style={{
            fontFamily: "DMSans_700Bold",
            fontSize: 19,
            lineHeight: 24,
            color: C.ink,
          }}
        >
          Emergency information
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Emergency information help"
          onPress={() => n.navigate("Resources")}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F6F0FD",
            opacity: pressed ? 0.68 : 1,
          })}
        >
          <Icon name="help-circle-outline" size={25} color="#5144B8" />
        </Pressable>
      </View>

      <View
        style={{
          minHeight: 300,
          borderRadius: 30,
          overflow: "hidden",
          padding: 22,
          paddingRight: 155,
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "#ECE4F8",
          shadowColor: "#5B3470",
          shadowOpacity: 0.06,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 3,
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 420 300"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
        >
          <Defs>
            <LinearGradient id="emergencyHeroBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FBF8FF" />
              <Stop offset="0.55" stopColor="#F3ECFF" />
              <Stop offset="1" stopColor="#EADFFF" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="420" height="300" rx="30" fill="url(#emergencyHeroBg)" />
          <Circle cx="374" cy="54" r="85" fill="#FFFFFF" opacity={0.42} />
          <Circle cx="390" cy="238" r="96" fill="#DCCAF9" opacity={0.42} />
        </Svg>

        <View style={{ gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 13,
                backgroundColor: "#E7D6FF",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="shield-checkmark-outline" size={22} color="#7B3ACA" />
            </View>
            <Text
              style={[
                S.eyebrow,
                { color: "#7432AF", letterSpacing: 1.8, fontSize: 10.5 },
              ]}
            >
              EMERGENCY INFORMATION
            </Text>
          </View>

          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 39,
              lineHeight: 43,
              letterSpacing: -1.15,
              color: "#17143D",
              maxWidth: 265,
            }}
          >
            Be prepared{"\n"}when{" "}
            <Text style={{ color: "#8C3ED1" }}>it matters.</Text>
          </Text>

          <View style={{ flexDirection: "row", gap: 9, marginTop: 4 }}>
            {[
              ["pulse-outline", "#E83C64", "#FFE5EC"],
              ["business-outline", "#2784D8", "#E6F5FF"],
              ["call-outline", "#7438C4", "#EFE6FF"],
            ].map(([icon, color, bg]) => (
              <View
                key={icon}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: bg,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={icon} size={22} color={color} />
              </View>
            ))}
          </View>
        </View>

        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: 0,
            top: 40,
            width: 210,
            height: 192,
          }}
        >
          <EmergencyHeroArt />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Emergency alert"
        onPress={async () => {
          const emergencyNumber =
            data.profile?.localEmergencyNumber ||
            criticalSummary?.localEmergencyNumber ||
            "";
          if (emergencyNumber) {
            try {
              await callNumber(emergencyNumber);
            } catch (error) {
              setMessage(error instanceof Error ? error.message : "Could not start the call.");
            }
          } else if (!readOnly) {
            setEditing(true);
          }
        }}
        style={({ pressed }) => ({
          minHeight: 110,
          borderRadius: 26,
          borderWidth: 1,
          borderColor: "#F3CBD3",
          backgroundColor: "#FFF0F3",
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 18,
          gap: 15,
          opacity: pressed ? 0.74 : 1,
        })}
      >
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: "#E93D62",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 27,
              lineHeight: 30,
              color: C.white,
            }}
          >
            !
          </Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{
              fontFamily: "DMSans_700Bold",
              fontSize: 17,
              lineHeight: 22,
              color: "#C8284C",
            }}
          >
            Emergency alert
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 14,
              lineHeight: 19,
              color: "#B64E64",
            }}
          >
            Know what to do
          </Text>
        </View>
        <Icon name="chevron-forward-outline" size={23} color="#D63A56" />
      </Pressable>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <SmallStatusCard
          icon="document-text-outline"
          eyebrow="PREPAREDNESS"
          value={completeness.completed + "/" + completeness.total}
          accent="#7B3ACA"
          background="#F7F1FF"
        />
        <SmallStatusCard
          icon="time-outline"
          eyebrow="LAST REVIEW"
          value={emergencyReviewLabel(data.profile?.lastReviewedAt)}
          accent="#3265E8"
          background="#F2F6FF"
        />
      </View>

      {criticalSummary && (
        <Card
          style={{
            borderRadius: 28,
            backgroundColor: "#21162D",
            borderWidth: 0,
            gap: 14,
          }}
        >
          <View style={S.between}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[S.eyebrow, { color: "#D8BFE3" }]}>
                ONE-TAP EMERGENCY SUMMARY
              </Text>
              <Text style={[S.h2, { color: C.white, fontSize: 22 }]}>
                {criticalSummary.recipientName}
              </Text>
              <Txt style={{ color: "#E6DCE9" }}>
                {data.profile
                  ? "Live care information"
                  : "Offline cached emergency snapshot"}
              </Txt>
            </View>
            <View
              style={{
                width: 54,
                height: 54,
                borderRadius: 18,
                backgroundColor: "#FFFFFF14",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="medical-outline" size={28} color="#F4D9FF" />
            </View>
          </View>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {[
              ["Blood type", criticalSummary.bloodType || "Not set"],
              ["Allergies", criticalSummary.allergies || "Not set"],
              [
                "Code status",
                emergencyCodeStatusLabel(criticalSummary.codeStatus),
              ],
              [
                "Healthcare POA",
                emergencyPoaStatusLabel(criticalSummary.poaStatus),
              ],
            ].map(([label, value]) => (
              <View
                key={label}
                style={{
                  width: "48%",
                  minHeight: 76,
                  borderRadius: 17,
                  backgroundColor: "#FFFFFF0F",
                  padding: 12,
                  gap: 4,
                }}
              >
                <Text style={[S.eyebrow, { color: "#CBBAD1", fontSize: 9 }]}>
                  {label}
                </Text>
                <Text
                  style={[
                    S.h3,
                    { color: C.white, fontSize: 13, lineHeight: 18 },
                  ]}
                  numberOfLines={3}
                >
                  {value}
                </Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 5 }}>
            <Text style={[S.h3, { color: C.white }]}>
              Active medications · {criticalSummary.medications.length}
            </Text>
            {criticalSummary.medications.slice(0, 4).map((medication, index) => (
              <Txt
                key={`${medication.name}-${index}`}
                style={{ color: "#E5D9E8" }}
              >
                •{" "}
                {[
                  medication.name,
                  medication.dose,
                  medication.route,
                  medication.isPrn ? "PRN" : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Txt>
            ))}
            {criticalSummary.medications.length > 4 && (
              <Txt style={{ color: "#CBBAD1" }}>
                + {criticalSummary.medications.length - 4} more medication
                {criticalSummary.medications.length - 4 === 1 ? "" : "s"}
              </Txt>
            )}
          </View>

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button
                title="One-page PDF"
                icon="document-text-outline"
                secondary
                disabled={busy}
                onPress={() => void exportOnePageSummary()}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                title="Care Vault"
                icon="lock-closed-outline"
                secondary
                disabled={busy}
                onPress={() => n.navigate("CareDocuments")}
              />
            </View>
          </View>

          <Txt style={{ color: "#BFAFC4", fontSize: 10.5 }}>
            Offline copy updated{" "}
            {new Date(criticalSummary.cachedAt).toLocaleString()}.
          </Txt>
        </Card>
      )}

      {Boolean(message) && (
        <Card style={{ borderRadius: 22 }}>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {loading ? (
        <Card style={{ borderRadius: 24 }}>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading emergency information…</Txt>
        </Card>
      ) : (
        <>
          <View style={S.between}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 25,
                lineHeight: 31,
                color: C.ink,
              }}
            >
              Emergency contacts
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => n.navigate("CareContacts")}
              style={({ pressed }) => ({
                minHeight: 46,
                borderRadius: 23,
                borderWidth: 1.5,
                borderColor: "#B36CE2",
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 7,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Icon name="add-outline" size={18} color="#823CB9" />
              <Text style={[S.h3, { fontSize: 12.5, color: "#823CB9" }]}>Add contact</Text>
            </Pressable>
          </View>

          <View style={{ flexDirection: "row", gap: 9 }}>
            <ContactTile
              title={data.recipient.emergencyContactName || "Add primary contact"}
              icon="add-outline"
              accent="#7D35B5"
              background="#FCFAFF"
              dashed
              onPress={() => n.navigate("CareContacts")}
            />
            <ContactTile
              title="Care team"
              icon="people-outline"
              accent="#7D35B5"
              background="#F4ECFF"
              onPress={() => n.navigate("CareContacts")}
            />
            <ContactTile
              title="Family"
              icon="people-circle-outline"
              accent="#238ED0"
              background="#EEF7FF"
              onPress={() => n.navigate("CareContacts")}
            />
          </View>

          <View style={{ gap: 7 }}>
            <Text
              accessibilityRole="header"
              style={{
                fontFamily: "DMSans_700Bold",
                fontSize: 25,
                lineHeight: 31,
                color: C.ink,
              }}
            >
              Medication & transition
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => n.navigate("Medications")}
              style={({ pressed }) => ({
                minHeight: 110,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: "#E9E3EF",
                backgroundColor: C.white,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                gap: 14,
                opacity: pressed ? 0.74 : 1,
              })}
            >
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  backgroundColor: "#FFE7EE",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="medical-outline" size={25} color="#E34168" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.h3}>Medication list</Text>
                <Txt style={S.small}>
                  {data.medications.length} active
                </Txt>
              </View>
              <Icon name="chevron-forward-outline" size={19} color="#7D35B5" />
            </Pressable>
          </View>

          <View style={{ gap: 12 }}>
            <View style={S.between}>
              <Text
                accessibilityRole="header"
                style={{
                  fontFamily: "DMSans_700Bold",
                  fontSize: 25,
                  lineHeight: 31,
                  color: C.ink,
                }}
              >
                Emergency profile
              </Text>

              {!readOnly && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEditing(true)}
                  style={({ pressed }) => ({
                    minHeight: 44,
                    borderRadius: 22,
                    borderWidth: 1.5,
                    borderColor: "#AE69DE",
                    paddingHorizontal: 15,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 7,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <Icon name="create-outline" size={17} color="#7D35B5" />
                  <Text style={[S.h3, { fontSize: 12.5, color: "#7D35B5" }]}>Edit</Text>
                </Pressable>
              )}
            </View>

            {!editing ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                <ProfileTile
                  title="Hospital"
                  value={data.profile?.preferredHospital || ""}
                  icon="business-outline"
                  accent="#2C8FD6"
                  background="#EEF7FF"
                  onPress={() => !readOnly && setEditing(true)}
                />
                <ProfileTile
                  title="Allergies"
                  value={data.profile?.allergies || ""}
                  icon="medical-outline"
                  accent="#E34168"
                  background="#FFF0F4"
                  onPress={() => !readOnly && setEditing(true)}
                />
                <ProfileTile
                  title="Conditions"
                  value={data.profile?.importantConditions || ""}
                  icon="heart-outline"
                  accent="#1E9D79"
                  background="#EEF9F5"
                  onPress={() => !readOnly && setEditing(true)}
                />
                <ProfileTile
                  title="Advance directive"
                  value={data.profile?.advanceDirectiveLocation || ""}
                  icon="document-text-outline"
                  accent="#A05A4E"
                  background="#FFF5F0"
                  onPress={() => !readOnly && setEditing(true)}
                />
                <ProfileTile
                  title="Blood type"
                  value={data.profile?.bloodType || ""}
                  icon="water-outline"
                  accent="#C43C57"
                  background="#FFF0F3"
                  onPress={() => !readOnly && setEditing(true)}
                />
                <ProfileTile
                  title="Code status"
                  value={emergencyCodeStatusLabel(
                    data.profile?.codeStatus || "unknown",
                  )}
                  icon="shield-checkmark-outline"
                  accent="#6B4BBE"
                  background="#F3EFFF"
                  onPress={() => !readOnly && setEditing(true)}
                />
                <ProfileTile
                  title="Healthcare POA"
                  value={emergencyPoaStatusLabel(
                    data.profile?.poaStatus || "unknown",
                  )}
                  icon="person-circle-outline"
                  accent="#21806B"
                  background="#EDF8F4"
                  onPress={() => !readOnly && setEditing(true)}
                />
                <ProfileTile
                  title="Primary language"
                  value={data.profile?.primaryLanguage || ""}
                  icon="language-outline"
                  accent="#2C79B8"
                  background="#EEF7FF"
                  onPress={() => !readOnly && setEditing(true)}
                />
              </View>
            ) : (
              <Card style={{ borderRadius: 26, gap: 14 }}>
                <Field
                  label="Local emergency number"
                  value={localEmergencyNumber}
                  onChange={setLocalEmergencyNumber}
                />
                <Field
                  label="Preferred hospital / facility"
                  value={preferredHospital}
                  onChange={setPreferredHospital}
                />
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Blood type"
                      value={bloodType}
                      onChange={setBloodType}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="Primary language"
                      value={primaryLanguage}
                      onChange={setPrimaryLanguage}
                    />
                  </View>
                </View>
                <Field label="Known allergies" value={allergies} onChange={setAllergies} multiline />
                <Field
                  label="Important conditions"
                  value={importantConditions}
                  onChange={setImportantConditions}
                  multiline
                />
                <Field
                  label="Medical devices / equipment"
                  value={medicalDevices}
                  onChange={setMedicalDevices}
                  multiline
                />
                <Text style={S.h3}>Code status / resuscitation directive</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {codeStatusChoices.map(([value, label]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: codeStatus === value }}
                      onPress={() => setCodeStatus(value)}
                      style={[
                        S.pill,
                        {
                          minHeight: 42,
                          paddingHorizontal: 13,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor:
                            codeStatus === value ? C.purple : C.lavender,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          S.small,
                          {
                            color: codeStatus === value ? C.white : C.deep,
                            fontFamily: "DMSans_600SemiBold",
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Field
                  label="DNR / directive document location"
                  value={dnrLocation}
                  onChange={setDnrLocation}
                  multiline
                />
                <Text style={S.h3}>Healthcare power of attorney</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {poaStatusChoices.map(([value, label]) => (
                    <Pressable
                      key={value}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: poaStatus === value }}
                      onPress={() => setPoaStatus(value)}
                      style={[
                        S.pill,
                        {
                          minHeight: 42,
                          paddingHorizontal: 13,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor:
                            poaStatus === value ? C.purple : C.lavender,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          S.small,
                          {
                            color: poaStatus === value ? C.white : C.deep,
                            fontFamily: "DMSans_600SemiBold",
                          },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="POA name"
                      value={poaName}
                      onChange={setPoaName}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Field
                      label="POA phone"
                      value={poaPhone}
                      onChange={setPoaPhone}
                    />
                  </View>
                </View>
                <Field
                  label="Advance directive / document location"
                  value={advanceDirectiveLocation}
                  onChange={setAdvanceDirectiveLocation}
                  multiline
                />
                <Field
                  label="Emergency notes"
                  value={emergencyNotes}
                  onChange={setEmergencyNotes}
                  multiline
                />
                <Button
                  title={busy ? "Saving…" : "Save emergency information"}
                  disabled={busy}
                  onPress={() => void save(false)}
                />
                <Button
                  title="Cancel"
                  secondary
                  disabled={busy}
                  onPress={() => {
                    setEditing(false);
                    applyProfile(data);
                  }}
                />
              </Card>
            )}
          </View>

          {!readOnly && !editing && (
            <Button
              title={busy ? "Saving review…" : "Confirm information reviewed"}
              icon="checkmark-done-outline"
              disabled={busy}
              secondary
              onPress={() => void save(true)}
            />
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => n.navigate("CarePacket")}
            style={({ pressed }) => ({
              minHeight: 62,
              borderRadius: 31,
              overflow: "hidden",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              opacity: pressed ? 0.8 : 1,
              shadowColor: "#6B2A93",
              shadowOpacity: 0.15,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 7 },
              elevation: 3,
            })}
          >
            <Svg
              width="100%"
              height="100%"
              viewBox="0 0 420 62"
              preserveAspectRatio="none"
              style={{ position: "absolute", inset: 0 }}
              accessibilityElementsHidden
            >
              <Defs>
                <LinearGradient id="packetGradient" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#7B2FA6" />
                  <Stop offset="0.55" stopColor="#9A3EC9" />
                  <Stop offset="1" stopColor="#7127A4" />
                </LinearGradient>
              </Defs>
              <Rect x="0" y="0" width="420" height="62" rx="31" fill="url(#packetGradient)" />
            </Svg>

            <Icon name="document-text-outline" size={22} color={C.white} />
            <Text
              style={{
                fontFamily: "DMSans_600SemiBold",
                fontSize: 15,
                color: C.white,
              }}
            >
              Create printable emergency packet
            </Text>
            <Icon name="arrow-forward-outline" size={20} color={C.white} />
          </Pressable>
        </>
      )}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 10,
          paddingHorizontal: 3,
        }}
      >
        <Icon name="information-circle-outline" size={20} color="#68647A" />
        <Text
          style={{
            flex: 1,
            fontFamily: "DMSans_400Regular",
            fontSize: 11.5,
            lineHeight: 17,
            color: "#77758B",
          }}
        >
          Emergency information is a caregiver-entered preparedness aid, not emergency monitoring.
        </Text>
      </View>
    </Page>
  );
}