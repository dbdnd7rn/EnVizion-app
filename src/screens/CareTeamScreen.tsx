import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  inviteCareTeamMember,
  loadCareSpaces,
  loadCareTeam,
  loadPendingCareInvitations,
  reinviteCareTeamMember,
  respondToCareInvitation,
  sendCareInvitationReminder,
  revokeCareTeamAccess,
  setActiveCareRecipient,
  updateCareTeamRole,
  type CareInvitation,
  type CareRole,
  type CareSpace,
  type CareTeamMember,
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
    owner: "Primary Advocate",
    caregiver: "Co-Caregiver",
    patient: "Care Recipient",
    viewer: "Family Member",
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

function invitationStatusLabel(member: CareTeamMember) {
  if (member.status === "invited" && member.isExpired) return "Expired";
  return statusLabel(member.status);
}

function invitationDateLabel(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString();
}

function invitationWindowLabel(member: CareTeamMember) {
  if (member.status !== "invited" || !member.inviteExpiresAt) return "";

  const hours = Math.ceil(
    (new Date(member.inviteExpiresAt).getTime() - Date.now()) /
      (60 * 60 * 1000),
  );

  if (member.isExpired || hours <= 0) return "Invitation expired";
  if (hours < 24) return `Expires in ${hours}h`;

  const days = Math.ceil(hours / 24);
  return `Expires in ${days} day${days === 1 ? "" : "s"}`;
}

function reminderCoolingDown(member: CareTeamMember) {
  if (!member.lastRemindedAt) return false;
  return (
    Date.now() - new Date(member.lastRemindedAt).getTime() <
    24 * 60 * 60 * 1000
  );
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
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {(["caregiver", "patient", "viewer"] as const).map((role) => (
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
        setCanManage(false);
        return;
      }

      const roster = await loadCareTeam(recipientId);

      setMembers(roster.members);
      setCanManage(roster.canManage);
      setCurrentRole(roster.currentRole);
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

  const invitationSummary = useMemo(() => {
    const managed = members.filter((member) => member.role !== "owner");
    return {
      pending: managed.filter(
        (member) => member.status === "invited" && !member.isExpired,
      ).length,
      expired: managed.filter(
        (member) => member.status === "invited" && member.isExpired,
      ).length,
      active: managed.filter((member) => member.status === "active").length,
      closed: managed.filter((member) =>
        ["declined", "revoked"].includes(member.status),
      ).length,
    };
  }, [members]);

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
          ? "Invitation email requested and a 14-day in-app invitation is ready. Access stays pending until they accept."
          : "A 14-day invitation is ready in their EnVizion account. Access stays pending until they accept.",
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
          {state.accessRole === "viewer" || state.accessRole === "patient"
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
            <Card
              key={invitation.careRecipientId}
              style={{
                backgroundColor: C.lavender,
                borderColor: "#DCCBE4",
                gap: 12,
              }}
            >
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.eyebrow}>CARE TEAM INVITATION</Text>
                  <Text style={S.h2}>{invitation.careRecipientName}</Text>
                </View>
                <View style={[S.pill, { backgroundColor: C.white }]}>
                  <Text style={[S.small, { color: C.purple }]}>
                    {roleLabel(invitation.role)}
                  </Text>
                </View>
              </View>

              <Txt>
                {invitation.inviterName} invited you to join this care space as{" "}
                {roleLabel(invitation.role)}. Access stays inactive until you
                accept.
              </Txt>

              <View
                style={{
                  borderRadius: 16,
                  backgroundColor: "#FFFFFFA8",
                  padding: 12,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "center",
                }}
              >
                <Icon name="person-add-outline" size={20} color={C.purple} />
                <Txt style={[S.small, { flex: 1 }]}>
                  Invited by {invitation.inviterName}
                </Txt>
              </View>

              <Button
                title={`Accept as ${roleLabel(invitation.role)}`}
                disabled={busyId !== null}
                icon="checkmark-circle-outline"
                onPress={() => void respond(invitation, "accept")}
              />
              <Button
                title="Decline invitation"
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

      {canManage && recipientId && (
        <>
          <Section title="Invitation management" />
          <Card
            style={{
              backgroundColor: "#FBF8FC",
              borderColor: "#E7DCEB",
              gap: 15,
            }}
          >
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                ["Pending", invitationSummary.pending, "#F6EEF9"],
                ["Active", invitationSummary.active, "#EAF3EE"],
                ["Expired", invitationSummary.expired, "#FFF3E6"],
                ["Closed", invitationSummary.closed, "#F2EFF3"],
              ].map(([label, value, background]) => (
                <View
                  key={String(label)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderRadius: 16,
                    paddingVertical: 11,
                    paddingHorizontal: 8,
                    backgroundColor: String(background),
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <Text style={[S.h3, { fontSize: 18 }]}>{String(value)}</Text>
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    style={[S.small, { textAlign: "center" }]}
                  >
                    {String(label)}
                  </Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Icon name="time-outline" size={20} color={C.purple} />
              <Txt style={[S.small, { flex: 1 }]}>
                New invitations stay open for 14 days. A Primary Advocate can
                send one in-app reminder per 24 hours or re-open an expired
                invitation.
              </Txt>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <Icon name="mail-outline" size={20} color={C.purple} />
              <Txt style={[S.small, { flex: 1 }]}>
                “Email requested” means EnVizion successfully handed the invite
                to the email provider. It does not claim that the message was
                delivered or opened.
              </Txt>
            </View>
          </Card>
        </>
      )}

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
                {invitationStatusLabel(member)}
              </Text>
            </View>
          </View>

          <Txt>
            {roleLabel(member.role)}
            {member.role === "viewer" || member.role === "patient"
              ? " · read-only"
              : ""}
          </Txt>

          {member.status === "invited" && (
            <View
              style={{
                borderRadius: 16,
                backgroundColor: member.isExpired ? "#FFF7ED" : "#F8F3FA",
                padding: 12,
                gap: 5,
              }}
            >
              <View style={S.between}>
                <Text style={[S.small, { fontFamily: "DMSans_600SemiBold" }]}>
                  {invitationWindowLabel(member)}
                </Text>
                {member.inviteExpiresAt && (
                  <Text style={S.small}>
                    {member.isExpired ? "Expired " : "Expires "}
                    {invitationDateLabel(member.inviteExpiresAt)}
                  </Text>
                )}
              </View>
              <Txt style={S.small}>
                {member.emailRequestedAt
                  ? `Email requested ${invitationDateLabel(member.emailRequestedAt)} · in-app invitation ready`
                  : "In-app invitation ready"}
              </Txt>
              {member.lastRemindedAt && (
                <Txt style={S.small}>
                  Last reminder {new Date(member.lastRemindedAt).toLocaleString()}
                </Txt>
              )}
            </View>
          )}

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

              {member.status === "invited" && !member.isExpired && (
                <Button
                  title={
                    reminderCoolingDown(member)
                      ? "Reminder sent recently"
                      : "Send invitation reminder"
                  }
                  secondary
                  disabled={busyId !== null || reminderCoolingDown(member)}
                  icon="notifications-outline"
                  onPress={async () => {
                    if (!recipientId) return;
                    setBusyId(`reminder-${member.userId}`);
                    setMessage("");
                    try {
                      await sendCareInvitationReminder(
                        recipientId,
                        member.userId,
                      );
                      setMessage(
                        `Reminder sent to ${member.displayName} in EnVizion Life.`,
                      );
                      await refresh();
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "We could not send that reminder.",
                      );
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
              )}

              {member.status === "invited" && member.isExpired ? (
                <Button
                  title="Re-open invitation"
                  secondary
                  disabled={busyId !== null}
                  icon="refresh-outline"
                  onPress={async () => {
                    if (!recipientId) return;
                    setBusyId(`reinvite-${member.userId}`);
                    try {
                      await reinviteCareTeamMember(recipientId, member.userId);
                      setMessage(
                        `A fresh 14-day invitation is ready for ${member.displayName}.`,
                      );
                      await refresh();
                    } catch (error) {
                      setMessage(
                        error instanceof Error
                          ? error.message
                          : "We could not re-open that invitation.",
                      );
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
              ) : member.status === "active" || member.status === "invited" ? (
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
                      setMessage(
                        `A fresh 14-day invitation is ready for ${member.displayName}.`,
                      );
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
              Co-Caregiver can view and update shared care records. Care
              Recipient can view their shared care record. Family Member can
              read shared updates but cannot change medical data.
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

      <Section title="Activity & accountability" />
      <Card
        onPress={() => n.navigate("CareTeamActivity")}
        label="Open care team activity and accountability"
        style={{
          backgroundColor: "#FAF7FB",
          borderColor: "#E4D9E8",
          gap: 12,
        }}
      >
        <View style={S.between}>
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 17,
              backgroundColor: "#F1E7F5",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="shield-checkmark-outline" size={23} color={C.purple} />
          </View>
          <Icon name="chevron-forward" size={20} color={C.purple} />
        </View>
        <View style={{ gap: 5 }}>
          <Text style={S.h2}>Care Team Activity Center</Text>
          <Txt>
            See who invited whom, acceptance or decline, reminders, role
            changes, revocations, re-invitations and recorded shared-care
            activity in one filtered timeline.
          </Txt>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {["Access history", "Team-member filters", "Workspace activity"].map(
            (label) => (
              <View
                key={label}
                style={[S.pill, { backgroundColor: C.white }]}
              >
                <Text style={[S.small, { color: C.purple }]}>{label}</Text>
              </View>
            ),
          )}
        </View>
      </Card>
    </Page>
  );
}
