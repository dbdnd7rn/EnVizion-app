import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  inviteCareTeamMember,
  loadCareAuditTrail,
  loadCareSpaces,
  loadCareTeam,
  loadConsentHistory,
  loadPendingCareInvitations,
  reinviteCareTeamMember,
  respondToCareInvitation,
  revokeCareTeamAccess,
  setActiveCareRecipient,
  updateCareTeamRole,
  type CareAuditEvent,
  type CareInvitation,
  type CareRole,
  type CareSpace,
  type CareTeamMember,
  type ConsentEvent,
} from "../careTeam";
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

function roleLabel(role: CareRole) {
  return {
    owner: "Owner",
    caregiver: "Caregiver",
    viewer: "Viewer",
  }[role];
}

function statusLabel(status: CareTeamMember["status"]) {
  return {
    invited: "Invited",
    active: "Active",
    declined: "Declined",
    revoked: "Revoked",
  }[status];
}

function RolePicker({
  value,
  disabled,
  onChange,
}: {
  value: Exclude<CareRole, "owner">;
  disabled?: boolean;
  onChange: (role: Exclude<CareRole, "owner">) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {(["caregiver", "viewer"] as const).map((role) => (
        <Pressable
          key={role}
          disabled={disabled}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === role, disabled }}
          onPress={() => onChange(role)}
          style={[
            S.pill,
            {
              minHeight: 42,
              justifyContent: "center",
              paddingHorizontal: 14,
              backgroundColor: value === role ? C.purple : C.lavender,
              opacity: disabled ? 0.55 : 1,
            },
          ]}
        >
          <Text
            style={[
              S.h3,
              {
                fontSize: 12,
                color: value === role ? C.white : C.deep,
              },
            ]}
          >
            {roleLabel(role)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CareTeamScreen() {
  const n = useNav();
  const { state, refresh: refreshCare } = useCare();
  const [spaces, setSpaces] = useState<CareSpace[]>([]);
  const [pending, setPending] = useState<CareInvitation[]>([]);
  const [members, setMembers] = useState<CareTeamMember[]>([]);
  const [consent, setConsent] = useState<ConsentEvent[]>([]);
  const [audit, setAudit] = useState<CareAuditEvent[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [currentRole, setCurrentRole] = useState<CareRole>("viewer");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] =
    useState<Exclude<CareRole, "owner">>("caregiver");

  const recipientId = state.careRecipientId;

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [spaceRows, invitationRows] = await Promise.all([
        loadCareSpaces(),
        loadPendingCareInvitations(),
      ]);
      setSpaces(spaceRows);
      setPending(invitationRows);

      if (!recipientId) {
        setMembers([]);
        setConsent([]);
        setAudit([]);
        setCanManage(false);
        return;
      }

      const [roster, consentRows, auditRows] = await Promise.all([
        loadCareTeam(recipientId),
        loadConsentHistory(recipientId),
        loadCareAuditTrail(recipientId),
      ]);

      setMembers(roster.members);
      setCanManage(roster.canManage);
      setCurrentRole(roster.currentRole);
      setConsent(consentRows);
      setAudit(auditRows);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the care team.",
      );
    } finally {
      setLoading(false);
    }
  }, [recipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const memberNames = useMemo(
    () => new Map(members.map((member) => [member.userId, member.displayName])),
    [members],
  );

  async function switchSpace(space: CareSpace) {
    if (space.active) return;
    setBusyId(`space-${space.careRecipientId}`);
    setMessage("");
    try {
      await setActiveCareRecipient(space.careRecipientId);
      await refreshCare();
      n.reset({ index: 0, routes: [{ name: "Main" }] });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not switch care profiles.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function respond(invitation: CareInvitation, action: "accept" | "decline") {
    setBusyId(`invite-${invitation.careRecipientId}`);
    setMessage("");
    try {
      await respondToCareInvitation(invitation.careRecipientId, action);
      if (action === "accept") {
        await refreshCare();
        n.reset({ index: 0, routes: [{ name: "Main" }] });
        return;
      }
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update that invitation.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function invite() {
    if (!recipientId || !inviteName.trim() || !inviteEmail.trim()) return;
    setBusyId("invite-new");
    setMessage("");
    try {
      const result = await inviteCareTeamMember({
        careRecipientId: recipientId,
        displayName: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteName("");
      setInviteEmail("");
      setInviteRole("caregiver");
      setMessage(
        result.invitationEmailSent
          ? "Invitation email sent. Access stays pending until they accept."
          : "Invitation added to their EnVizion account. Access stays pending until they accept.",
      );
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not send the care team invitation.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !spaces.length && !pending.length) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading your care team…</Txt>
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="CARE TEAM & SHARING"
        title="Care is easier when the right people can help."
        body="Choose who can see this care profile, who can make updates, and which care space you’re working in."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E5C8ED" }]}>ACTIVE CARE PROFILE</Text>
        <Text style={[S.h2, { color: C.white }]}>
          {state.careRecipientName || "Care profile"}
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          {roleLabel(state.accessRole)} access
          {state.accessRole === "viewer"
            ? " · read-only"
            : " · can update shared care records"}
        </Txt>
      </Card>

      {Boolean(message) && (
        <Card style={{ backgroundColor: C.white }}>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {pending.length > 0 && (
        <>
          <Section title="Invitations waiting for you" />
          {pending.map((invitation) => (
            <Card key={invitation.careRecipientId} style={{ backgroundColor: C.lavender }}>
              <Text style={S.eyebrow}>CARE TEAM INVITATION</Text>
              <Text style={S.h2}>{invitation.careRecipientName}</Text>
              <Txt>
                You were invited as {roleLabel(invitation.role)}. Access begins
                only after you accept.
              </Txt>
              <Button
                title="Accept invitation"
                disabled={busyId !== null}
                icon="checkmark-circle-outline"
                onPress={() => void respond(invitation, "accept")}
              />
              <Button
                title="Decline"
                secondary
                disabled={busyId !== null}
                onPress={() => void respond(invitation, "decline")}
              />
            </Card>
          ))}
        </>
      )}

      <Section title="Your care spaces" />
      {spaces.map((space) => (
        <Card
          key={space.careRecipientId}
          onPress={() => void switchSpace(space)}
          label={space.active ? `${space.careRecipientName}, active care profile` : `Switch to ${space.careRecipientName}`}
          style={{
            borderColor: space.active ? "#CBB2D6" : C.line,
            backgroundColor: space.active ? "#F6F0F8" : C.white,
          }}
        >
          <View style={S.between}>
            <View style={{ flex: 1 }}>
              <Text style={S.h3}>{space.careRecipientName}</Text>
              <Txt>
                {space.relationship} · {roleLabel(space.role)}
              </Txt>
            </View>
            {space.active ? (
              <View style={[S.pill, { backgroundColor: "#E8F1ED" }]}>
                <Text style={[S.small, { color: C.green }]}>Active</Text>
              </View>
            ) : (
              <Icon name="swap-horizontal-outline" />
            )}
          </View>
        </Card>
      ))}

      <Section title="People with access" action="Refresh" onPress={() => void refresh()} />
      {members.map((member) => (
        <Card key={member.userId}>
          <View style={S.between}>
            <View style={{ flex: 1 }}>
              <Text style={S.h3}>{member.displayName}</Text>
              {Boolean(member.email) && <Text style={S.small}>{member.email}</Text>}
            </View>
            <View
              style={[
                S.pill,
                {
                  backgroundColor:
                    member.status === "active" ? "#E8F1ED" : C.lavender,
                },
              ]}
            >
              <Text
                style={[
                  S.small,
                  {
                    color: member.status === "active" ? C.green : C.deep,
                    fontFamily: "DMSans_600SemiBold",
                  },
                ]}
              >
                {statusLabel(member.status)}
              </Text>
            </View>
          </View>

          <Txt>
            {roleLabel(member.role)}
            {member.role === "viewer" ? " · read-only" : ""}
          </Txt>

          {canManage && member.role !== "owner" && (
            <>
              <RolePicker
                value={member.role as Exclude<CareRole, "owner">}
                disabled={busyId !== null || member.status === "revoked"}
                onChange={async (role) => {
                  if (!recipientId) return;
                  setBusyId(member.userId);
                  try {
                    await updateCareTeamRole({
                      careRecipientId: recipientId,
                      userId: member.userId,
                      role,
                    });
                    await refresh();
                  } catch (error) {
                    setMessage(
                      error instanceof Error
                        ? error.message
                        : "We could not change that role.",
                    );
                  } finally {
                    setBusyId(null);
                  }
                }}
              />

              {member.status === "active" || member.status === "invited" ? (
                <Button
                  title="Revoke access"
                  secondary
                  disabled={busyId !== null}
                  onPress={async () => {
                    if (!recipientId) return;
                    setBusyId(member.userId);
                    try {
                      await revokeCareTeamAccess(recipientId, member.userId);
                      await refresh();
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "We could not revoke access.",
                      );
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
              ) : (
                <Button
                  title="Invite again"
                  secondary
                  disabled={busyId !== null}
                  onPress={async () => {
                    if (!recipientId) return;
                    setBusyId(member.userId);
                    try {
                      await reinviteCareTeamMember(recipientId, member.userId);
                      await refresh();
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "We could not send another invitation.",
                      );
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
              )}
            </>
          )}
        </Card>
      ))}

      {canManage && recipientId && (
        <>
          <Section title="Invite someone you trust" />
          <Card>
            <Field
              label="Name"
              value={inviteName}
              onChange={setInviteName}
            />
            <Field
              label="Email address"
              value={inviteEmail}
              onChange={setInviteEmail}
            />
            <Text style={S.h3}>Access level</Text>
            <RolePicker
              value={inviteRole}
              disabled={busyId !== null}
              onChange={setInviteRole}
            />
            <Txt style={S.small}>
              Caregiver can view and update shared care records. Viewer can read
              the shared care record but cannot change it.
            </Txt>
            <Button
              title={busyId === "invite-new" ? "Sending invitation…" : "Invite to care team"}
              icon="person-add-outline"
              disabled={
                busyId !== null || !inviteName.trim() || !inviteEmail.trim()
              }
              onPress={() => void invite()}
            />
          </Card>
        </>
      )}

      <Section title="Consent history" />
      {!consent.length ? (
        <Card>
          <Txt>No sharing changes have been recorded yet.</Txt>
        </Card>
      ) : (
        consent.slice(0, 12).map((event) => (
          <Card key={event.id}>
            <View style={S.between}>
              <Text style={S.eyebrow}>{event.eventType.replaceAll("_", " ")}</Text>
              <Text style={S.small}>
                {new Date(event.createdAt).toLocaleString()}
              </Text>
            </View>
            <Txt>
              {event.role ? `${roleLabel(event.role)} access` : "Care access change"}
              {event.note ? ` · ${event.note}` : ""}
            </Txt>
          </Card>
        ))
      )}

      <Section title="Shared care activity" />
      {!audit.length ? (
        <Card>
          <Txt>No shared care activity has been recorded yet.</Txt>
        </Card>
      ) : (
        audit.slice(0, 20).map((event) => (
          <Card key={event.id}>
            <View style={S.between}>
              <Text style={S.eyebrow}>
                {event.action.replaceAll("_", " ")}
              </Text>
              <Text style={S.small}>
                {new Date(event.createdAt).toLocaleString()}
              </Text>
            </View>
            <Text style={S.h3}>
              {event.actorUserId
                ? memberNames.get(event.actorUserId) ?? "Care team member"
                : "System"}
            </Text>
            <Txt>{event.summary ?? event.entityType.replaceAll("_", " ")}</Txt>
          </Card>
        ))
      )}

      <Txt style={S.small}>
        This activity history records app workspace opens and changes made to
        shared care records. It is not a complete network or device-access log.
      </Txt>
    </Page>
  );
}
