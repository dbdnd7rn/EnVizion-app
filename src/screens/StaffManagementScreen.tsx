import { themeAction } from "../themeColors";
import { useAppearance } from "../appearance";
import { AdminGlassHero, AdminGlassCard, AdminGlassSection, AdminGlassMetric, AdminGlassTabs } from "../components/AdminGlassUi";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
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
  Button,
  C,
  Field,
  Icon,
  Page,
  S,
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
              backgroundColor: value === role ? themeAction(C.purple) : C.lavender,
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
  const { dark } = useAppearance();
  const [staff, setStaff] = useState<ManagedStaffMember[]>([]);
  const [audit, setAudit] = useState<StaffAdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("support");
  const [tab, setTab] = useState<"people" | "invite" | "activity">("people");
  const [search, setSearch] = useState("");
  const [confirmAccess, setConfirmAccess] = useState<string | null>(null);

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
      await refresh();
      setMessage(
        result.invited
          ? "Staff invitation sent and access prepared."
          : "Existing EnVizion account activated as staff.",
      );
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
      <AdminGlassHero variant="staff" eyebrow="TEAM ADMINISTRATION"
        title="Your care support team"
        description="Invite trusted staff, manage workspace roles and keep access secure."
        footer={<Text style={[S.small, { color: C.purple, fontFamily: "DMSans_600SemiBold" }]}>
          Staff access is managed securely
        </Text>}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 }}>
        <AdminGlassMetric value={staff.length} icon="people-outline" label="Staff members" />
        <AdminGlassMetric value={staff.filter((entry) => entry.active).length} icon="checkmark-circle-outline" label="Active access" />
        <AdminGlassMetric value={staff.filter((entry) => entry.role === "admin" && entry.active).length} icon="shield-checkmark-outline" label="Active admins" />
        <AdminGlassMetric value={audit.length} icon="time-outline" label="Recorded admin actions" />
      </View>
      <AdminGlassTabs
        value={tab}
        onChange={setTab}
        options={[
          { key: "people", label: "Team", icon: "people-outline" },
          { key: "invite", label: "Invite", icon: "person-add-outline" },
          { key: "activity", label: "Activity", icon: "time-outline" },
        ]}
      />
      {tab === "invite" && (<>
      <AdminGlassSection title="Invite or activate staff" />
      <AdminGlassCard>
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
      </AdminGlassCard>

      </>)}

      {Boolean(message) && (
        <AdminGlassCard style={{ backgroundColor: message.toLowerCase().includes("could not") ? C.redBg : C.white }}>
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
        </AdminGlassCard>
      )}

      {tab === "people" && (<>
      <AdminGlassSection title="Current staff" action="Refresh" onPress={() => void refresh()} />
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 9,
        paddingHorizontal: 14, minHeight: 48, borderRadius: 17,
        borderWidth: 1, borderColor: dark ? "#57466D" : "#E9DEF0",
        backgroundColor: dark ? "#31263F" : "#FFFFFF",
      }}>
        <Icon name="search-outline" size={19} color={C.purple} />
        <TextInput accessibilityLabel="Search staff" value={search} onChangeText={setSearch}
          autoCapitalize="none" placeholder="Search by name, email, or role"
          placeholderTextColor={dark ? "#A798B8" : "#95889D"}
          style={{
            flex: 1, minHeight: 45, fontSize: 13, fontFamily: "DMSans_400Regular",
            color: dark ? "#FAF2FF" : "#1B163F",
          }} />
      </View>
      {loading ? (
        <AdminGlassCard>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading staff accounts…</Txt>
        </AdminGlassCard>
      ) : !staff.length ? (
        <AdminGlassCard>
          <Icon name="people-outline" />
          <Text style={S.h3}>No active staff accounts have been created yet.</Text>
          <Txt>
            The first administrator must be activated after creating a normal
            EnVizion account.
          </Txt>
        </AdminGlassCard>
      ) : (
        staff.filter((item) => !search.trim() || [item.displayName, item.email, item.role].some((value) => value.toLowerCase().includes(search.trim().toLowerCase()))).map((item) => (
          <AdminGlassCard key={item.userId}>
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
                onPress={() => setConfirmAccess(item.userId)}
              />
            )}
              {confirmAccess === item.userId && (
                <View style={{
                  borderRadius: 18, padding: 13, gap: 12,
                  backgroundColor: dark ? "#422D41" : "#FFF2F7",
                }}>
                  <Text style={[S.small, { color: dark ? "#F6D7E5" : "#873953" }]}>
                    {item.active ? "Disable this staff member’s workspace access?" : "Reactivate workspace access for this staff member?"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 9 }}>
                    <View style={{ flex: 1 }}>
                      <Button title="Cancel" secondary onPress={() => setConfirmAccess(null)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button title="Confirm" disabled={busyId !== null}
                        onPress={() => { setConfirmAccess(null); void changeStaff(item, { active: !item.active }); }} />
                    </View>
                  </View>
                </View>
              )}
          </AdminGlassCard>
        ))
      )}

      </>)}

      {tab === "activity" && (<>
      <AdminGlassSection title="Recent admin activity" />
      {!audit.length ? (
        <AdminGlassCard>
          <Txt>No staff-management activity has been recorded yet.</Txt>
        </AdminGlassCard>
      ) : (
        audit.map((item) => (
          <AdminGlassCard key={item.id}>
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
          </AdminGlassCard>
        ))
      )}

      </>)}

      <Txt style={S.small}>
        Access changes are logged for accountability. Staff roles control access
        to EnVizion operational tools; they do not grant clinical authority.
      </Txt>
    </Page>
  );
}
