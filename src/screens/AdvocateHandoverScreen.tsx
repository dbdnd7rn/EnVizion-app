import React, { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  decideAdvocateHandover, loadAdvocateHandovers, loadCareTeam, previewAdvocateHandover,
  type AdvocateHandoverOverview, type AdvocateHandoverPreview, type AdvocateHandoverRequest,
  type CareTeamMember,
} from "../careTeam";
import { useCare } from "../store";
import { Button, C, Card, Heading, Icon, Page, S, Section, Txt } from "../ui";
import { useNav } from "./MainScreens";

export function AdvocateHandoverScreen() {
  const { state } = useCare();
  return state.careRecipientId
    ? <HandoverContent key={state.careRecipientId} recipientId={state.careRecipientId} />
    : <Page><Txt>Select a care profile to review its handover.</Txt></Page>;
}

function HandoverContent({ recipientId }: { recipientId: string }) {
  const n = useNav();
  const { refresh: refreshCare } = useCare();
  const [overview, setOverview] = useState<AdvocateHandoverOverview | null>(null);
  const [candidates, setCandidates] = useState<CareTeamMember[]>([]);
  const [preview, setPreview] = useState<AdvocateHandoverPreview | null>(null);
  const [chosenName, setChosenName] = useState("");
  const [decision, setDecision] = useState<{ request: AdvocateHandoverRequest; action: "accept" | "decline" | "cancel" } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const [next, roster] = await Promise.all([loadAdvocateHandovers(recipientId), loadCareTeam(recipientId)]);
    setOverview(next);
    setCandidates(roster.members.filter(m => m.role === "caregiver" && m.status === "active" && !m.isCurrentUser));
  }, [recipientId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setPreview(null); setDecision(null); setConfirmed(false);
    load().catch(error => { if (active) setMessage(error.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load]));

  async function choose(member: CareTeamMember) {
    setBusy(true); setMessage(""); setConfirmed(false); setDecision(null); setPreview(null);
    try {
      setPreview(await previewAdvocateHandover(recipientId, member.userId));
      setChosenName(member.displayName);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Preview unavailable."); }
    finally { setBusy(false); }
  }

  async function submit() {
    if (!confirmed || busy || (!preview && !decision)) return;
    setBusy(true); setMessage("");
    try {
      const result = await decideAdvocateHandover(decision ? {
        careRecipientId: recipientId, decision: decision.action, requestId: decision.request.id,
      } : {
        careRecipientId: recipientId, decision: "request", targetUserId: preview!.toUserId, fingerprint: preview!.fingerprint,
      });
      setPreview(null); setDecision(null); setConfirmed(false);
      await refreshCare();
      await load();
      setMessage(result.status === "accepted"
        ? "Handover completed. Ownership and team permissions are updated and recorded."
        : result.status === "pending"
          ? "Request sent. Access stays unchanged until the incoming advocate accepts."
          : `Handover ${result.status}. Access remains unchanged.`);
    } catch (error) {
      setPreview(null); setDecision(null); setConfirmed(false);
      setMessage(error instanceof Error ? error.message : "Could not complete the handover. Refresh and try again.");
    } finally { setBusy(false); }
  }

  const pending = overview?.requests.filter(r => r.status === "pending") ?? [];
  const history = overview?.requests.filter(r => r.status !== "pending") ?? [];
  const actionTitle = preview ? "Send handover request" : decision?.action === "accept" ? "Accept responsibility" : decision?.action === "decline" ? "Decline handover" : "Cancel handover";

  return <Page>
    <Heading eyebrow="CARE TEAM RESPONSIBILITY" title="Primary Advocate handover"
      body="Pass responsibility to someone you trust, with agreement from both people." />
    <Card style={{ backgroundColor: C.deep, gap: 10 }}>
      <Icon name="swap-horizontal-outline" color={C.white} size={28} />
      <Text style={[S.h2, { color: C.white }]}>A deliberate change of responsibility</Text>
      <Txt style={{ color: "#EADFED" }}>The incoming advocate manages this care profile and its team. The outgoing advocate stays as a Co-Caregiver and can still help with care, but no longer manages access.</Txt>
      <Txt style={{ color: "#EADFED" }}>Both people must confirm. Requests expire after seven days without changing anyone’s permissions.</Txt>
    </Card>
    {!!message && <Card><Text accessibilityRole="alert" style={S.body}>{message}</Text></Card>}
    {loading && <ActivityIndicator color={C.purple} />}
    <Section title="Awaiting a decision" />
    {!loading && !pending.length && <Card><Txt>No handover is waiting for your decision.</Txt></Card>}
    {pending.map(request => <Card key={request.id} style={{ gap: 10 }}>
      <Text style={S.h3}>{request.fromName} → {request.toName}</Text>
      <Txt>Expires {new Date(request.expiresAt).toLocaleString()}</Txt>
      {request.canRespond && <>
        <Button title="Review and accept" disabled={busy} onPress={() => {
          setPreview(null); setDecision({ request, action: "accept" }); setConfirmed(false);
        }} />
        <Button title="Decline" secondary disabled={busy} onPress={() => {
          setPreview(null); setDecision({ request, action: "decline" }); setConfirmed(false);
        }} />
      </>}
      {request.canCancel && <Button title="Cancel request" secondary disabled={busy} onPress={() => {
        setPreview(null); setDecision({ request, action: "cancel" }); setConfirmed(false);
      }} />}
    </Card>)}
    {overview?.canInitiate && !pending.length && <>
      <Section title="Choose the incoming advocate" />
      <Txt>Choose an active Co-Caregiver. Care Recipients and Family Members are excluded from this handover.</Txt>
      {!candidates.length && <Card><Txt>No eligible Co-Caregiver yet. Invite a trusted caregiver from Care Team and wait for them to accept.</Txt></Card>}
      {candidates.map(member => <Card key={member.userId}>
        <Text style={S.h3}>{member.displayName}</Text>
        <Txt style={S.small}>Co-Caregiver → Primary Advocate</Txt>
        <Button title="Preview handover" secondary disabled={busy} onPress={() => void choose(member)} />
      </Card>)}
    </>}
    {(preview || decision) && <>
      <Section title={actionTitle} />
      <Card style={{ gap: 12, borderColor: C.purple }}>
        {preview || decision?.action === "accept" ? <>
          <View style={{ gap: 5 }}>
            <Text style={S.eyebrow}>BEFORE</Text>
            <Txt>{preview ? `You: Primary Advocate\n${chosenName}: Co-Caregiver` : `${decision!.request.fromName}: Primary Advocate\nYou: Co-Caregiver`}</Txt>
          </View>
          <Icon name="arrow-down-outline" size={22} color={C.purple} />
          <View style={{ gap: 5 }}>
            <Text style={S.eyebrow}>AFTER ACCEPTANCE</Text>
            <Txt>{preview ? `You: Co-Caregiver\n${chosenName}: Primary Advocate` : `${decision!.request.fromName}: Co-Caregiver\nYou: Primary Advocate`}</Txt>
          </View>
          <Txt style={S.small}>Care records stay in place. Other team members keep their roles. Changed permissions invalidate this request.</Txt>
        </> : <Txt>This closes the request. Ownership and access stay unchanged.</Txt>}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: confirmed, disabled: busy }} disabled={busy}
          onPress={() => setConfirmed(value => !value)}
          style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 12 }}>
          <Icon name={confirmed ? "checkbox-outline" : "square-outline"} size={25} color={C.purple} />
          <Text style={[S.body, { flex: 1 }]}>I have reviewed and agree to this decision.</Text>
        </Pressable>
        <Button title={busy ? "Saving…" : actionTitle} disabled={!confirmed || busy} onPress={() => void submit()} />
        <Button title="Back without changes" secondary disabled={busy} onPress={() => {
          setPreview(null); setDecision(null); setConfirmed(false);
        }} />
      </Card>
    </>}
    <Section title="Handover history" />
    {!history.length && <Txt>No completed or closed handovers to show.</Txt>}
    {history.map(request => <Card key={request.id}>
      <Text style={S.h3}>{request.fromName} → {request.toName}</Text>
      <Txt>{request.status.charAt(0).toUpperCase() + request.status.slice(1)} · {new Date(request.resolvedAt ?? request.expiresAt).toLocaleDateString()}</Txt>
    </Card>)}
    <Button title="Refresh handover" secondary disabled={busy || loading} onPress={() => {
      setPreview(null); setDecision(null); setConfirmed(false); setLoading(true);
      void load().catch(error => setMessage(error.message)).finally(() => setLoading(false));
    }} />
    <Button title="Back to Care Team" secondary disabled={busy} onPress={() => n.navigate("CareTeam")} />
  </Page>;
}
