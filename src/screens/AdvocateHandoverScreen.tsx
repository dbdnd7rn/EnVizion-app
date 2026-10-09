import React, { useCallback, useState } from "react";
import {
  ActivityIndicator, Pressable, ScrollView, Text, View,
  useWindowDimensions, type StyleProp, type ViewStyle,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import {
  decideAdvocateHandover, loadAdvocateHandovers, loadCareTeam, previewAdvocateHandover,
  type AdvocateHandoverOverview, type AdvocateHandoverPreview, type AdvocateHandoverRequest,
  type CareTeamMember,
} from "../careTeam";
import { useCare } from "../store";
import { Icon } from "../ui";
import { useNav } from "./MainScreens";

const PURPLE = "#71369C";
const INK = "#17143C";
const MUTED = "#7B7892";
const LILAC = "#F1E6FB";
const FAMILY = "DMSans_400Regular";
const SEMI = "DMSans_600SemiBold";
const BOLD = "DMSans_700Bold";

/** Subtle translucent surfaces, with no dependency on web-only blur filters. */
function Glass({
  children, style, tint = "#E9DBFA",
}: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; tint?: string;
}) {
  return (
    <View style={[{
      borderRadius: 25,
      borderWidth: 1,
      borderColor: "#E9E2F3",
      backgroundColor: "#FFFDFFEE",
      padding: 17,
      gap: 12,
      overflow: "hidden",
      shadowColor: "#604778",
      shadowOpacity: 0.085,
      shadowRadius: 15,
      shadowOffset: { width: 0, height: 7 },
      elevation: 2,
    }, style]}>
      <View pointerEvents="none" style={{
        position: "absolute", right: -70, top: -83, width: 169, height: 169,
        borderRadius: 90, backgroundColor: tint, opacity: 0.44,
      }} />
      <View pointerEvents="none" style={{
        position: "absolute", left: -55, bottom: -72, width: 124, height: 124,
        borderRadius: 68, backgroundColor: "#E4D5F7", opacity: 0.22,
      }} />
      {children}
    </View>
  );
}

function Tile({ name, size = 48 }: { name: string; size?: number }) {
  return (
    <View style={{
      height: size, width: size, borderRadius: 16,
      backgroundColor: "#F1E7FB",
      alignItems: "center", justifyContent: "center",
    }}>
      <Icon name={name} size={Math.round(size * 0.48)} color={PURPLE} />
    </View>
  );
}

function BlockTitle({ children }: { children: React.ReactNode }) {
  return <Text accessibilityRole="header" style={{
    color: INK, fontFamily: BOLD, fontSize: 21, lineHeight: 27, letterSpacing: -0.55,
  }}>{children}</Text>;
}

function EmptyGlass({
  title, detail, icon, onPress,
}: { title: string; detail: string; icon: string; onPress?: () => void }) {
  const inner = (
    <Glass style={{ padding: 15 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 13 }}>
        <Tile name={icon} size={51} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: INK, fontFamily: SEMI, fontSize: 13.5, lineHeight: 19 }}>
            {title}
          </Text>
          <Text style={{ fontFamily: FAMILY, color: MUTED, fontSize: 12.5, lineHeight: 18 }}>
            {detail}
          </Text>
        </View>
        {onPress && <Icon name="chevron-forward" color={PURPLE} size={19} />}
      </View>
    </Glass>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={title}
      accessibilityHint="Open Care Team" onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}>
      {inner}
    </Pressable>
  ) : inner;
}

function PillButton({
  title, icon, onPress, disabled = false, secondary = false,
}: {
  title: string; icon: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 53,
        borderRadius: 28,
        alignItems: "center", justifyContent: "center",
        flexDirection: "row", gap: 10,
        overflow: "hidden",
        borderWidth: 1, borderColor: secondary ? "#FFFFFF" : "#9253CC",
        backgroundColor: secondary ? "#EBE1FA" : "#7136AE",
        opacity: disabled ? 0.45 : pressed ? 0.76 : 1,
        shadowColor: secondary ? "#BAA4D0" : "#6B33A4",
        shadowOpacity: secondary ? 0.06 : 0.16,
        shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2,
      })}>
      {!secondary && (
        <Svg pointerEvents="none" width="100%" height="100%"
          style={{ position: "absolute", left: 0, top: 0 }}
          viewBox="0 0 340 54" preserveAspectRatio="none">
          <Defs>
            <LinearGradient id="handoverButton" x1="0" x2="1" y1="0" y2="0">
              <Stop offset="0" stopColor="#9150C5"/>
              <Stop offset="0.6" stopColor="#7937B2"/>
              <Stop offset="1" stopColor="#6730A1"/>
            </LinearGradient>
          </Defs>
          <Rect width="340" height="54" fill="url(#handoverButton)" />
        </Svg>
      )}
      <Icon name={icon} size={19} color={secondary ? PURPLE : "#FFFFFF"} />
      <Text style={{ color: secondary ? PURPLE : "#FFFFFF",
        fontFamily: BOLD, fontSize: 13.5 }}>{title}</Text>
    </Pressable>
  );
}

/** Vector artwork keeps the two-person handover motif crisp on all displays. */
function HandoverArtwork({ compact = false }: { compact?: boolean }) {
  const width = compact ? 128 : 157;
  return (
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ width, height: compact ? 135 : 156 }}>
      <Svg width="100%" height="100%" viewBox="0 0 170 165">
        <Defs>
          <LinearGradient id="glassAura" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#EEE8FF" stopOpacity={0.1}/>
            <Stop offset="1" stopColor="#DCC7FF" stopOpacity={0.7}/>
          </LinearGradient>
          <LinearGradient id="leftPortrait" x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor="#EEE4FF"/>
            <Stop offset="1" stopColor="#9872EB"/>
          </LinearGradient>
          <LinearGradient id="rightPortrait" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFFFFF"/>
            <Stop offset="1" stopColor="#CEBDF1"/>
          </LinearGradient>
        </Defs>
        <Circle cx="88" cy="82" r="75" fill="url(#glassAura)"/>
        <Circle cx="42" cy="91" r="40" fill="#FFFFFF" fillOpacity={0.39}/>
        <Circle cx="131" cy="92" r="37" fill="#FFFFFF" fillOpacity={0.44}/>
        <Path d="M79 52 C100 22 127 31 139 49" stroke="#9769E6"
          strokeWidth="8" strokeLinecap="round" fill="none"/>
        <Path d="M130 34 L144 51 L125 54" stroke="#9769E6" strokeWidth="8"
          strokeLinejoin="round" strokeLinecap="round" fill="none"/>
        <Path d="M101 118 C83 142 56 134 46 120" stroke="#B9A5E9"
          strokeWidth="7" strokeLinecap="round" fill="none"/>
        <Path d="M54 135 L40 118 L59 113" stroke="#B9A5E9" strokeWidth="7"
          strokeLinejoin="round" strokeLinecap="round" fill="none"/>
        <Ellipse cx="39" cy="105" rx="31" ry="25" fill="url(#leftPortrait)"
          stroke="#FFFFFF" strokeWidth="2"/>
        <Circle cx="39" cy="64" r="19" fill="url(#leftPortrait)"
          stroke="#FFFFFF" strokeWidth="2"/>
        <Ellipse cx="133" cy="110" rx="28" ry="24" fill="url(#rightPortrait)"
          stroke="#FFFFFF" strokeWidth="2"/>
        <Circle cx="133" cy="72" r="18" fill="url(#rightPortrait)"
          stroke="#FFFFFF" strokeWidth="2"/>
      </Svg>
    </View>
  );
}

export function AdvocateHandoverScreen() {
  const { state } = useCare();
  const nav = useNav();
  if (!state.careRecipientId) {
    return (
      <View style={{ backgroundColor: "#FCF9FF", flex: 1, padding: 22, gap: 14 }}>
        <BlockTitle>Select a care profile</BlockTitle>
        <Text style={{ color: MUTED, fontFamily: FAMILY }}>
          Select a care profile to review its handover.
        </Text>
        <PillButton title="Back to Care Team" icon="people-outline"
          onPress={() => nav.navigate("CareTeam")} />
      </View>
    );
  }
  return <HandoverContent key={state.careRecipientId} recipientId={state.careRecipientId} />;
}

function HandoverContent({ recipientId }: { recipientId: string }) {
  const n = useNav();
  const { refresh: refreshCare } = useCare();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const [overview, setOverview] = useState<AdvocateHandoverOverview | null>(null);
  const [candidates, setCandidates] = useState<CareTeamMember[]>([]);
  const [preview, setPreview] = useState<AdvocateHandoverPreview | null>(null);
  const [chosenName, setChosenName] = useState("");
  const [decision, setDecision] = useState<{
    request: AdvocateHandoverRequest; action: "accept" | "decline" | "cancel"
  } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    const [next, roster] = await Promise.all([
      loadAdvocateHandovers(recipientId), loadCareTeam(recipientId),
    ]);
    setOverview(next);
    // Eligibility is still server-checked on preview and on acceptance.
    setCandidates(roster.members.filter(m =>
      m.role === "caregiver" && m.status === "active" && !m.isCurrentUser));
    setLoadError("");
  }, [recipientId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setPreview(null);
    setDecision(null);
    setConfirmed(false);
    void load().catch(error => {
      if (active) {
        const detail = error instanceof Error ? error.message : "Unable to load handovers.";
        setLoadError(detail);
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]));

  async function refresh() {
    if (busy || loading) return;
    setPreview(null);
    setDecision(null);
    setConfirmed(false);
    setMessage("");
    setLoading(true);
    try {
      await load();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not refresh handovers.");
    } finally {
      setLoading(false);
    }
  }

  async function choose(member: CareTeamMember) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setConfirmed(false);
    setDecision(null);
    setPreview(null);
    try {
      const next = await previewAdvocateHandover(recipientId, member.userId);
      setPreview(next);
      setChosenName(member.displayName);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Preview unavailable.");
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!confirmed || busy || (!preview && !decision)) return;
    setBusy(true);
    setMessage("");
    try {
      const result = await decideAdvocateHandover(decision ? {
        careRecipientId: recipientId,
        decision: decision.action,
        requestId: decision.request.id,
      } : {
        careRecipientId: recipientId,
        decision: "request",
        targetUserId: preview!.toUserId,
        fingerprint: preview!.fingerprint,
      });
      setPreview(null);
      setDecision(null);
      setConfirmed(false);
      const success = result.status === "accepted"
        ? "Handover completed. Ownership and team permissions are updated and recorded."
        : result.status === "pending"
          ? "Request sent. Access stays unchanged until the incoming advocate accepts."
          : "Handover " + result.status + ". Access remains unchanged.";
      setMessage(success);
      try {
        await Promise.all([refreshCare(), load()]);
      } catch {
        setLoadError("The decision was recorded, but the page could not refresh. Refresh to view the latest status.");
      }
    } catch (error) {
      setPreview(null);
      setDecision(null);
      setConfirmed(false);
      setMessage(error instanceof Error ? error.message :
        "Could not complete the handover. Refresh and try again.");
    } finally {
      setBusy(false);
    }
  }

  const pending = overview?.requests.filter(r => r.status === "pending") ?? [];
  const history = overview?.requests.filter(r => r.status !== "pending") ?? [];
  const actionTitle = preview ? "Send handover request"
    : decision?.action === "accept" ? "Accept responsibility"
    : decision?.action === "decline" ? "Decline handover" : "Cancel handover";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#FCF9FF" }}
      contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 17, paddingBottom: 55 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <View style={{ width: "100%", maxWidth: 480, alignSelf: "center", gap: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Go back"
            onPress={() => n.canGoBack() ? n.goBack() : n.navigate("CareTeam")}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 22, backgroundColor: "#F2E9FA",
              borderColor: "#FFFFFF", borderWidth: 1, alignItems: "center",
              justifyContent: "center", opacity: pressed ? 0.75 : 1,
            })}>
            <Icon name="arrow-back-outline" size={24} color={PURPLE} />
          </Pressable>
          <Text accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit
            style={{ flex: 1, fontFamily: BOLD, fontSize: compact ? 16 : 18,
              color: INK, letterSpacing: -0.25 }}>
            Primary Advocate handover
          </Text>
        </View>

        <View style={{ gap: 9, overflow: "hidden" }}>
          <View pointerEvents="none" style={{
            position: "absolute", right: -56, top: -10, width: 220, height: 215,
            borderRadius: 125, backgroundColor: "#F1EAFE",
          }} />
          <Text style={{
            fontFamily: BOLD, color: PURPLE, fontSize: 10.5,
            letterSpacing: 2.1, marginTop: 8,
          }}>CARE TEAM RESPONSIBILITY</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 1 }}>
            <View style={{ flex: 1, minWidth: 0, gap: 9 }}>
              <Text style={{
                fontFamily: BOLD, fontSize: compact ? 27 : 30,
                lineHeight: compact ? 33 : 36, letterSpacing: -0.9,
                color: INK,
              }}>Primary Advocate handover</Text>
              <Text style={{ color: MUTED, fontSize: 13, lineHeight: 20, fontFamily: FAMILY }}>
                Pass responsibility to someone you trust, with agreement from both people.
              </Text>
            </View>
            <HandoverArtwork compact={compact}/>
          </View>
        </View>

        <Glass tint="#E9DDFB" style={{ gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
            <Tile name="document-text-outline" size={49}/>
            <View style={{ flex: 1, gap: 7 }}>
              <Text style={{ fontFamily: BOLD, fontSize: 16.5, lineHeight: 22,
                letterSpacing: -0.25, color: INK }}>
                A deliberate change of responsibility
              </Text>
              <Text style={{ fontSize: 12.5, lineHeight: 19, color: MUTED, fontFamily: FAMILY }}>
                The incoming advocate manages this care profile and its team.
                The outgoing advocate stays as a Co-Caregiver and can still help
                with care, but no longer manages access.
              </Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: "#E8DAF2" }}/>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "stretch" }}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Tile name="people-outline" size={37}/>
              <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 16.5,
                color: MUTED, fontFamily: FAMILY }}>
                Both people must confirm the handover.
              </Text>
            </View>
            <View style={{ width: 1, backgroundColor: "#E6D9F2" }}/>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Tile name="time-outline" size={37}/>
              <Text style={{ flex: 1, fontSize: 11.5, lineHeight: 16.5,
                color: MUTED, fontFamily: FAMILY }}>
                Requests expire after seven days without changing permissions.
              </Text>
            </View>
          </View>
        </Glass>

        {Boolean(message) && (
          <Glass tint="#EEE4FC" style={{ padding: 13 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
              <Icon name="information-circle-outline" color={PURPLE} size={20}/>
              <Text accessibilityRole="alert" style={{ color: INK, flex: 1,
                fontSize: 12.5, lineHeight: 19, fontFamily: FAMILY }}>{message}</Text>
            </View>
          </Glass>
        )}

        {Boolean(loadError) && (
          <Glass tint="#FCE9E9" style={{ borderColor: "#EFD8DC" }}>
            <Text accessibilityRole="alert" style={{ color: "#A3485B",
              fontFamily: SEMI, fontSize: 13 }}>{loadError}</Text>
            <PillButton title="Try again" icon="refresh-outline" secondary
              disabled={loading || busy} onPress={() => void refresh()}/>
          </Glass>
        )}

        {loading && (
          <View accessibilityLabel="Loading handover data"
            style={{ alignItems: "center", paddingVertical: 14 }}>
            <ActivityIndicator color={PURPLE}/>
            <Text style={{ color: MUTED, fontSize: 12, paddingTop: 9 }}>
              Loading handover details…
            </Text>
          </View>
        )}

        {!loading && overview && (
          <>
            <View style={{ gap: 12 }}>
              <BlockTitle>Awaiting a decision</BlockTitle>
              {!pending.length && (
                <EmptyGlass icon="mail-outline"
                  title="No handover is waiting for your decision."
                  detail="You’re all caught up right now."/>
              )}
              {pending.map(request => (
                <Glass key={request.id} tint="#EEE1FA">
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                    <Tile name="swap-horizontal-outline"/>
                    <View style={{ flex: 1, gap: 5 }}>
                      <Text style={{ fontFamily: BOLD, color: INK, fontSize: 14.5 }}>
                        {request.fromName} → {request.toName}
                      </Text>
                      <Text style={{ color: MUTED, fontFamily: FAMILY, fontSize: 12 }}>
                        Expires {new Date(request.expiresAt).toLocaleString()}
                      </Text>
                    </View>
                    <View style={{ borderRadius: 18, paddingHorizontal: 10,
                      paddingVertical: 7, backgroundColor: "#F6EDF9" }}>
                      <Text style={{ color: PURPLE, fontFamily: SEMI, fontSize: 11 }}>
                        Pending
                      </Text>
                    </View>
                  </View>
                  {request.canRespond && (
                    <>
                      <PillButton title="Review and accept" icon="checkmark-circle-outline"
                        disabled={busy} onPress={() => {
                          setPreview(null); setDecision({ request, action: "accept" });
                          setConfirmed(false);
                        }}/>
                      <PillButton title="Decline" icon="close-circle-outline" secondary
                        disabled={busy} onPress={() => {
                          setPreview(null); setDecision({ request, action: "decline" });
                          setConfirmed(false);
                        }}/>
                    </>
                  )}
                  {request.canCancel && (
                    <PillButton title="Cancel request" icon="close-outline" secondary
                      disabled={busy} onPress={() => {
                        setPreview(null); setDecision({ request, action: "cancel" });
                        setConfirmed(false);
                      }}/>
                  )}
                  {!request.canRespond && !request.canCancel && (
                    <Text style={{ color: MUTED, fontFamily: FAMILY, fontSize: 12 }}>
                      Waiting for the designated advocate to respond.
                    </Text>
                  )}
                </Glass>
              ))}
            </View>

            {overview.canInitiate && !pending.length && (
              <View style={{ gap: 12 }}>
                <BlockTitle>Choose the incoming advocate</BlockTitle>
                <Text style={{ color: MUTED, fontFamily: FAMILY, fontSize: 12.5, lineHeight: 19 }}>
                  Choose an active Co-Caregiver. Care Recipients and Family Members
                  are excluded from this handover.
                </Text>
                {!candidates.length ? (
                  <EmptyGlass icon="person-add-outline"
                    title="No eligible Co-Caregiver yet."
                    detail="Invite a trusted caregiver from Care Team and wait for them to accept."
                    onPress={() => n.navigate("CareTeam")}/>
                ) : candidates.map(member => (
                  <Glass key={member.userId} tint="#F0E5FB">
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <Tile name="person-outline"/>
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={{ color: INK, fontFamily: BOLD, fontSize: 15 }}>
                          {member.displayName}
                        </Text>
                        <Text style={{ fontFamily: FAMILY, fontSize: 12,
                          color: MUTED }}>Co-Caregiver → Primary Advocate</Text>
                      </View>
                    </View>
                    <PillButton title="Preview handover" icon="eye-outline" secondary
                      disabled={busy} onPress={() => void choose(member)}/>
                  </Glass>
                ))}
              </View>
            )}

            {(preview || decision) && (
              <View style={{ gap: 12 }}>
                <BlockTitle>{actionTitle}</BlockTitle>
                <Glass tint="#E8DBFA" style={{ borderColor: "#C4ABE1" }}>
                  {(preview || decision?.action === "accept") ? (
                    <>
                      <Text style={{ color: PURPLE, fontFamily: BOLD, fontSize: 10.5,
                        letterSpacing: 1.6 }}>BEFORE</Text>
                      <Text style={{ fontFamily: FAMILY, color: INK, lineHeight: 22 }}>
                        {preview ? "You: Primary Advocate\n" + chosenName + ": Co-Caregiver"
                          : decision!.request.fromName + ": Primary Advocate\nYou: Co-Caregiver"}
                      </Text>
                      <Icon name="arrow-down-outline" size={20} color={PURPLE}/>
                      <Text style={{ color: PURPLE, fontFamily: BOLD, fontSize: 10.5,
                        letterSpacing: 1.6 }}>AFTER ACCEPTANCE</Text>
                      <Text style={{ fontFamily: FAMILY, color: INK, lineHeight: 22 }}>
                        {preview ? "You: Co-Caregiver\n" + chosenName + ": Primary Advocate"
                          : decision!.request.fromName + ": Co-Caregiver\nYou: Primary Advocate"}
                      </Text>
                      <Text style={{ fontFamily: FAMILY, fontSize: 12, color: MUTED,
                        lineHeight: 18 }}>
                        Care records stay in place. Other members keep their roles.
                        Changed permissions invalidate this request.
                      </Text>
                    </>
                  ) : (
                    <Text style={{ fontFamily: FAMILY, fontSize: 13, color: MUTED,
                      lineHeight: 19 }}>
                      This closes the request. Ownership and access stay unchanged.
                    </Text>
                  )}
                  <Pressable accessibilityRole="checkbox"
                    accessibilityLabel="I have reviewed and agree to this decision."
                    accessibilityState={{ checked: confirmed, disabled: busy }}
                    disabled={busy} onPress={() => setConfirmed(value => !value)}
                    style={({ pressed }) => ({
                      flexDirection: "row", alignItems: "center", gap: 10,
                      paddingVertical: 10, opacity: pressed ? 0.7 : 1,
                    })}>
                    <Icon name={confirmed ? "checkbox-outline" : "square-outline"}
                      size={25} color={PURPLE}/>
                    <Text style={{ flex: 1, fontFamily: FAMILY, fontSize: 12.5,
                      lineHeight: 19, color: INK }}>
                      I have reviewed and agree to this decision.
                    </Text>
                  </Pressable>
                  <PillButton title={busy ? "Saving…" : actionTitle}
                    icon="checkmark-circle-outline" disabled={!confirmed || busy}
                    onPress={() => void submit()}/>
                  <PillButton title="Back without changes" icon="arrow-back-outline"
                    secondary disabled={busy} onPress={() => {
                      setPreview(null); setDecision(null); setConfirmed(false);
                    }}/>
                </Glass>
              </View>
            )}

            <View style={{ gap: 12 }}>
              <BlockTitle>Handover history</BlockTitle>
              {!history.length ? (
                <EmptyGlass icon="time-outline"
                  title="No completed or closed handovers to show."
                  detail="Your handover history will appear here."/>
              ) : history.map(request => (
                <Glass key={request.id}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 11 }}>
                    <Tile name="time-outline" size={46}/>
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={{ color: INK, fontFamily: BOLD, fontSize: 14 }}>
                        {request.fromName} → {request.toName}
                      </Text>
                      <Text style={{ color: MUTED, fontFamily: FAMILY, fontSize: 12 }}>
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                        {" · "}
                        {new Date(request.resolvedAt ?? request.expiresAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                </Glass>
              ))}
            </View>
          </>
        )}

        <View style={{ gap: 12, marginTop: 3 }}>
          <PillButton title="Refresh handover" icon="refresh-outline" secondary
            disabled={busy || loading} onPress={() => void refresh()}/>
          <PillButton title="Back to Care Team" icon="people-outline"
            disabled={busy} onPress={() => n.navigate("CareTeam")}/>
        </View>
      </View>
    </ScrollView>
  );
}
