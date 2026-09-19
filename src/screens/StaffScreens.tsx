import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStack } from "../navigation";
import { useAuth } from "../auth";
import { NotificationBell } from "../notifications";
import {
  getStaffMembership,
  loadStaffDashboard,
  loadStaffSupportThread,
  sendStaffReply,
  updateCoachingRequestStatus,
  updateSupportRequestStatus,
  type StaffCoachingRequest,
  type StaffMembership,
  type StaffSupportRequest,
  type StaffSupportThread as StaffThread,
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
import { useNav } from "./MainScreens";

function labelStatus(status: string) {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function StatusPill({ status }: { status: string }) {
  const complete =
    status === "closed" || status === "completed" || status === "cancelled";
  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: complete ? "#E8F1ED" : C.lavender,
      }}
    >
      <Text
        style={[
          S.small,
          {
            color: complete ? C.green : C.deep,
            fontFamily: "DMSans_600SemiBold",
          },
        ]}
      >
        {labelStatus(status)}
      </Text>
    </View>
  );
}

function AccessRestricted() {
  const { signOut } = useAuth();
  return (
    <Page>
      <Brand />
      <Heading
        eyebrow="ENVIZION LIFE STAFF"
        title="Staff access required."
        body="This workspace is only available to accounts activated as EnVizion Life staff."
      />
      <Card>
        <Icon name="shield-checkmark-outline" size={30} />
        <Text style={S.h3}>Your account is signed in, but it is not an active staff account.</Text>
        <Txt>
          Staff access is controlled in the secure EnVizion Life database and
          cannot be enabled from this screen.
        </Txt>
      </Card>
      <Button title="Sign out" secondary onPress={() => void signOut()} />
    </Page>
  );
}

export function StaffWorkspaceScreen() {
  const n = useNav();
  const { signOut } = useAuth();
  const [member, setMember] = useState<StaffMembership | null>(null);
  const [support, setSupport] = useState<StaffSupportRequest[]>([]);
  const [coaching, setCoaching] = useState<StaffCoachingRequest[]>([]);
  const [section, setSection] = useState<"support" | "coaching">("support");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const [membership, dashboard] = await Promise.all([
        getStaffMembership(),
        loadStaffDashboard(),
      ]);
      setMember(membership);
      setSupport(dashboard.support);
      setCoaching(dashboard.coaching);
    } catch (error) {
      setMember(await getStaffMembership());
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the staff workspace.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <Page>
        <Brand />
        <View style={{ minHeight: 340, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading staff workspace…</Txt>
        </View>
      </Page>
    );
  }

  if (!member) return <AccessRestricted />;

  const openSupport = support.filter(
    (item) => item.status !== "closed",
  ).length;
  const openCoaching = coaching.filter(
    (item) => !["completed", "cancelled"].includes(item.status),
  ).length;

  return (
    <Page>
      <View style={S.between}>
        <Brand />
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <NotificationBell onPress={() => n.navigate("Notifications")} />
          <Pressable
            accessibilityRole="button"
            onPress={() => void signOut()}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
              Sign out
            </Text>
          </Pressable>
        </View>
      </View>

      <Heading
        eyebrow="ENVIZION LIFE STAFF"
        title="Caregiver support workspace"
        body={`Welcome, ${member.displayName}. Review caregiver requests and keep each conversation moving.`}
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E5C8ED" }]}>
          {member.role.toUpperCase()} ACCESS
        </Text>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <View style={{ flex: 1 }}>
            <Text style={[S.title, { color: C.white, fontSize: 30 }]}>
              {openSupport}
            </Text>
            <Txt style={{ color: "#E9DDED" }}>open support requests</Txt>
          </View>
          {member.role !== "support" && (
            <View style={{ flex: 1 }}>
              <Text style={[S.title, { color: C.white, fontSize: 30 }]}>
                {openCoaching}
              </Text>
              <Txt style={{ color: "#E9DDED" }}>active coaching requests</Txt>
            </View>
          )}
        </View>
      </Card>

      {member.role === "admin" && (
        <Card
          onPress={() => n.navigate("StaffManagement")}
          label="Manage EnVizion staff"
          style={{ flexDirection: "row", alignItems: "center", gap: 14 }}
        >
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              backgroundColor: C.lavender,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="people-circle-outline" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.h3}>Manage staff access</Text>
            <Txt>Invite staff, assign roles, and review admin activity.</Txt>
          </View>
          <Icon name="chevron-forward" color="#A092A6" size={17} />
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: section === "support" }}
          onPress={() => setSection("support")}
          style={[
            S.pill,
            {
              flex: 1,
              minHeight: 46,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: section === "support" ? C.purple : C.lavender,
            },
          ]}
        >
          <Text
            style={[
              S.h3,
              {
                fontSize: 13,
                color: section === "support" ? C.white : C.deep,
              },
            ]}
          >
            Support inbox
          </Text>
        </Pressable>
        {member.role !== "support" && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: section === "coaching" }}
            onPress={() => setSection("coaching")}
            style={[
              S.pill,
              {
                flex: 1,
                minHeight: 46,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: section === "coaching" ? C.purple : C.lavender,
              },
            ]}
          >
            <Text
              style={[
                S.h3,
                {
                  fontSize: 13,
                  color: section === "coaching" ? C.white : C.deep,
                },
              ]}
            >
              Coaching
            </Text>
          </Pressable>
        )}
      </View>

      {Boolean(message) && (
        <Card style={{ backgroundColor: C.redBg }}>
          <Text accessibilityRole="alert" style={[S.h3, { color: C.rose }]}>
            {message}
          </Text>
          <Button title="Try again" secondary onPress={() => void refresh()} />
        </Card>
      )}

      {section === "support" || member.role === "support" ? (
        <>
          <Section title="Support requests" action="Refresh" onPress={() => void refresh()} />
          {!support.length ? (
            <Card>
              <Icon name="checkmark-circle-outline" color={C.green} />
              <Text style={S.h3}>No support requests yet.</Text>
              <Txt>New caregiver requests will appear here.</Txt>
            </Card>
          ) : (
            support.map((item) => (
              <Card
                key={item.id}
                onPress={() =>
                  n.navigate("StaffSupportThread", { requestId: item.id })
                }
                label={`Open support request from ${item.caregiverName}`}
              >
                <View style={S.between}>
                  <Text style={S.eyebrow}>{item.topic}</Text>
                  <StatusPill status={item.status} />
                </View>
                <Text style={S.h3}>{item.caregiverName}</Text>
                <Txt>Care recipient: {item.careRecipientName}</Txt>
                <Text numberOfLines={3} style={[S.body, { color: C.ink }]}>
                  {item.context}
                </Text>
                <View style={S.between}>
                  <Text style={S.small}>{item.preferredChannel}</Text>
                  <Text style={S.small}>
                    {new Date(item.createdAt).toLocaleString()}
                  </Text>
                </View>
              </Card>
            ))
          )}
        </>
      ) : (
        <>
          <Section title="Coaching requests" action="Refresh" onPress={() => void refresh()} />
          {!coaching.length ? (
            <Card>
              <Icon name="checkmark-circle-outline" color={C.green} />
              <Text style={S.h3}>No coaching requests yet.</Text>
              <Txt>New advocate coaching requests will appear here.</Txt>
            </Card>
          ) : (
            coaching.map((item) => (
              <Card key={item.id}>
                <View style={S.between}>
                  <Text style={S.eyebrow}>{item.topic}</Text>
                  <StatusPill status={item.status} />
                </View>
                <Text style={S.h3}>{item.caregiverName}</Text>
                <Txt>Care recipient: {item.careRecipientName}</Txt>
                {Boolean(item.message) && <Txt>{item.message}</Txt>}
                <Text style={S.small}>
                  Submitted {new Date(item.createdAt).toLocaleString()}
                </Text>

                {item.status === "submitted" && (
                  <Button
                    title="Mark in review"
                    secondary
                    onPress={async () => {
                      try {
                        await updateCoachingRequestStatus(item.id, "in_review");
                        await refresh();
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : "Could not update the coaching request.",
                        );
                      }
                    }}
                  />
                )}
                {item.status === "in_review" && (
                  <Button
                    title="Mark scheduled"
                    onPress={async () => {
                      try {
                        await updateCoachingRequestStatus(item.id, "scheduled");
                        await refresh();
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : "Could not update the coaching request.",
                        );
                      }
                    }}
                  />
                )}
                {item.status === "scheduled" && (
                  <Button
                    title="Mark completed"
                    onPress={async () => {
                      try {
                        await updateCoachingRequestStatus(item.id, "completed");
                        await refresh();
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : "Could not update the coaching request.",
                        );
                      }
                    }}
                  />
                )}
                {!["completed", "cancelled"].includes(item.status) && (
                  <Button
                    title="Cancel request"
                    secondary
                    onPress={async () => {
                      try {
                        await updateCoachingRequestStatus(item.id, "cancelled");
                        await refresh();
                      } catch (error) {
                        setMessage(
                          error instanceof Error
                            ? error.message
                            : "Could not update the coaching request.",
                        );
                      }
                    }}
                  />
                )}
              </Card>
            ))
          )}
        </>
      )}

      <Txt style={S.small}>
        Staff workspace access is enforced by Supabase Row Level Security.
        Caregiver medical decisions should remain with the appropriate licensed
        healthcare team.
      </Txt>
    </Page>
  );
}

export function StaffSupportThreadScreen({
  route,
}: NativeStackScreenProps<RootStack, "StaffSupportThread">) {
  const [thread, setThread] = useState<StaffThread | null>(null);
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      setThread(await loadStaffSupportThread(route.params.requestId));
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not load this request.",
      );
    } finally {
      setLoading(false);
    }
  }, [route.params.requestId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (loading) {
    return (
      <Page>
        <ActivityIndicator color={C.purple} />
        <Txt>Loading support conversation…</Txt>
      </Page>
    );
  }

  if (!thread) {
    return (
      <Page>
        <Heading title="Support request unavailable" />
        {Boolean(message) && <Txt>{message}</Txt>}
        <Button title="Try again" onPress={() => void refresh()} />
      </Page>
    );
  }

  const request = thread.request;

  async function changeStatus(status: StaffSupportRequest["status"]) {
    setBusy(true);
    setMessage("");
    try {
      await updateSupportRequestStatus(request.id, status);
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update the request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    setMessage("");
    try {
      await sendStaffReply(request.id, reply);
      setReply("");
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not send the reply.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow={request.topic}
        title={request.caregiverName}
        body={`Care recipient: ${request.careRecipientName}`}
      />

      <Card style={{ backgroundColor: C.lavender }}>
        <View style={S.between}>
          <StatusPill status={request.status} />
          <Text style={S.small}>{request.preferredChannel}</Text>
        </View>
        <Text style={S.h3}>Original request</Text>
        <Txt style={{ color: C.ink }}>{request.context}</Txt>
        <Text style={S.small}>
          Submitted {new Date(request.createdAt).toLocaleString()}
        </Text>
      </Card>

      <Section title="Conversation" />
      {!thread.messages.length ? (
        <Card>
          <Txt>No follow-up messages yet.</Txt>
        </Card>
      ) : (
        thread.messages.map((item) => {
          const staff = item.senderType === "staff";
          return (
            <View
              key={item.id}
              style={[
                S.card,
                {
                  alignSelf: staff ? "flex-end" : "flex-start",
                  maxWidth: "94%",
                  backgroundColor: staff ? C.deep : C.white,
                },
              ]}
            >
              <Text
                style={[
                  S.eyebrow,
                  { color: staff ? "#E5C8ED" : C.purple },
                ]}
              >
                {staff ? "ENVIZION STAFF" : request.caregiverName}
              </Text>
              <Text style={[S.body, { color: staff ? C.white : C.ink }]}>
                {item.body}
              </Text>
              <Text
                style={[
                  S.small,
                  { color: staff ? "#DDCAE5" : C.muted },
                ]}
              >
                {new Date(item.createdAt).toLocaleString()}
              </Text>
            </View>
          );
        })
      )}

      {request.status !== "closed" && (
        <>
          <Field
            label="Reply to caregiver"
            value={reply}
            onChange={setReply}
            multiline
          />
          <Button
            title={busy ? "Sending…" : "Send reply"}
            disabled={busy || !reply.trim()}
            icon="send-outline"
            onPress={() => void send()}
          />
        </>
      )}

      <Section title="Request status" />
      <View style={{ gap: 10 }}>
        {request.status === "submitted" && (
          <Button
            title="Mark in review"
            secondary
            disabled={busy}
            onPress={() => void changeStatus("in_review")}
          />
        )}
        {request.status !== "closed" && (
          <Button
            title="Close request"
            secondary
            disabled={busy}
            onPress={() => void changeStatus("closed")}
          />
        )}
        {request.status === "closed" && (
          <Button
            title="Reopen for review"
            secondary
            disabled={busy}
            onPress={() => void changeStatus("in_review")}
          />
        )}
      </View>

      {Boolean(message) && (
        <Text accessibilityRole="alert" style={[S.body, { color: C.rose }]}>
          {message}
        </Text>
      )}

      <Txt style={S.small}>
        Replies are support communications, not emergency monitoring or a
        substitute for professional medical care.
      </Txt>
    </Page>
  );
}
