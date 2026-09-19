import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  inviteStaffMember,
  loadManagedStaff,
  loadStaffAdminAudit,
  updateManagedStaff,
  type ManagedStaffMember,
  type StaffAdminAuditEntry,
  type StaffRole,
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

const roleLabels: Record<StaffRole, string> = {
  admin: "Admin",
  advocate: "Advocate",
  support: "Support",
};

function RolePicker({
  value,
  onChange,
  disabled,
}: {
  value: StaffRole;
  onChange: (role: StaffRole) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {(["support", "advocate", "admin"] as const).map((role) => (
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
              opacity: disabled ? 0.5 : 1,
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
            {roleLabels[role]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function StaffManagementScreen() {
  const [staff, setStaff] = useState<ManagedStaffMember[]>([]);
  const [audit, setAudit] = useState<StaffAdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("support");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [roster, auditRows] = await Promise.all([
        loadManagedStaff(),
        loadStaffAdminAudit(),
      ]);
      setStaff(roster);
      setAudit(auditRows);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load staff management.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function invite() {
    if (!name.trim() || !email.trim()) {
      setMessage("Enter a staff name and email address.");
      return;
    }

    setBusyId("invite");
    setMessage("");
    try {
      const result = await inviteStaffMember({
        displayName: name.trim(),
        email: email.trim(),
        role,
      });
      setName("");
      setEmail("");
      setRole("support");
      setMessage(
        result.invited
          ? "Staff invitation sent and access prepared."
          : "Existing EnVizion account activated as staff.",
      );
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not invite this staff member.",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function changeStaff(
    item: ManagedStaffMember,
    next: { role?: StaffRole; active?: boolean },
  ) {
    const nextRole = next.role ?? item.role;
    const nextActive = next.active ?? item.active;

    setBusyId(item.userId);
    setMessage("");
    try {
      await updateManagedStaff({
        userId: item.userId,
        role: nextRole,
        active: nextActive,
      });
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update staff access.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Page>
      <Brand />
      <Heading
        eyebrow="ADMINISTRATION"
        title="Manage EnVizion staff"
        body="Invite staff, assign workspace roles, and deactivate access when responsibilities change."
      />

      <Card style={{ backgroundColor: C.lavender }}>
        <Icon name="shield-checkmark-outline" size={30} />
        <Text style={S.h3}>Admin-only controls</Text>
        <Txt>
          Invitations and role changes are processed server-side. Privileged
          Supabase credentials are never sent to this app.
        </Txt>
      </Card>

      <Section title="Invite or activate staff" />
      <Card>
        <Field label="Staff member name" value={name} onChange={setName} />
        <Field
          label="Email address"
          value={email}
          onChange={setEmail}
        />
        <Text style={S.h3}>Workspace role</Text>
        <RolePicker value={role} onChange={setRole} disabled={busyId !== null} />
        <Txt style={S.small}>
          Support can handle support requests. Advocate can also manage coaching
          workflows. Admin has staff-management access.
        </Txt>
        <Button
          title={busyId === "invite" ? "Sending invitation…" : "Invite staff member"}
          disabled={busyId !== null || !name.trim() || !email.trim()}
          icon="person-add-outline"
          onPress={() => void invite()}
        />
      </Card>

      {Boolean(message) && (
        <Card style={{ backgroundColor: message.toLowerCase().includes("could not") ? C.redBg : C.white }}>
          <Text
            accessibilityRole="alert"
            style={[
              S.body,
              {
                color: message.toLowerCase().includes("could not")
                  ? C.rose
                  : C.ink,
              },
            ]}
          >
            {message}
          </Text>
        </Card>
      )}

      <Section title="Current staff" action="Refresh" onPress={() => void refresh()} />
      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading staff accounts…</Txt>
        </Card>
      ) : !staff.length ? (
        <Card>
          <Icon name="people-outline" />
          <Text style={S.h3}>No active staff accounts have been created yet.</Text>
          <Txt>
            The first administrator must be activated after creating a normal
            EnVizion account.
          </Txt>
        </Card>
      ) : (
        staff.map((item) => (
          <Card key={item.userId}>
            <View style={S.between}>
              <View style={{ flex: 1 }}>
                <Text style={S.h3}>{item.displayName}</Text>
                <Text style={S.small}>{item.email || "Email unavailable"}</Text>
              </View>
              <View
                style={[
                  S.pill,
                  {
                    backgroundColor: item.active ? "#E8F1ED" : C.redBg,
                  },
                ]}
              >
                <Text
                  style={[
                    S.small,
                    {
                      color: item.active ? C.green : C.rose,
                      fontFamily: "DMSans_600SemiBold",
                    },
                  ]}
                >
                  {item.active ? "Active" : "Disabled"}
                </Text>
              </View>
            </View>

            <Text style={S.small}>Role</Text>
            <RolePicker
              value={item.role}
              disabled={busyId !== null || item.isCurrentUser}
              onChange={(nextRole) => void changeStaff(item, { role: nextRole })}
            />

            {item.isCurrentUser ? (
              <Txt style={S.small}>
                You cannot downgrade or disable your own administrator access.
              </Txt>
            ) : (
              <Button
                title={
                  busyId === item.userId
                    ? "Updating access…"
                    : item.active
                      ? "Disable staff access"
                      : "Reactivate staff access"
                }
                secondary
                disabled={busyId !== null}
                onPress={() =>
                  void changeStaff(item, { active: !item.active })
                }
              />
            )}
          </Card>
        ))
      )}

      <Section title="Recent admin activity" />
      {!audit.length ? (
        <Card>
          <Txt>No staff-management activity has been recorded yet.</Txt>
        </Card>
      ) : (
        audit.map((item) => (
          <Card key={item.id}>
            <View style={S.between}>
              <Text style={S.eyebrow}>
                {item.action.replaceAll("_", " ")}
              </Text>
              <Text style={S.small}>
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
            <Txt>
              {typeof item.details.email === "string"
                ? item.details.email
                : typeof item.details.display_name === "string"
                  ? item.details.display_name
                  : "Staff access change"}
            </Txt>
          </Card>
        ))
      )}

      <Txt style={S.small}>
        Access changes are logged for accountability. Staff roles control access
        to EnVizion operational tools; they do not grant clinical authority.
      </Txt>
    </Page>
  );
}
