import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  acknowledgeFamilyUpdate,
  createFamilyUpdate,
  deleteFamilyUpdate,
  familyCommunicationCurrentUserId,
  familyUpdatePriorities,
  familyUpdatePriorityLabels,
  familyUpdateTypeLabels,
  familyUpdateTypes,
  loadFamilyCommunicationCenter,
  removeFamilyUpdateAcknowledgement,
  updateFamilyUpdate,
  type FamilyUpdate,
  type FamilyUpdatePriority,
  type FamilyUpdateType,
} from "../familyCommunication";
import {
  familyCommunicationSummary,
  familyUpdateAcknowledgedByUser,
  familyUpdateAcknowledgements,
} from "../familyCommunicationHelpers";
import { loadCareTeam, type CareTeamRoster } from "../careTeam";
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

type Draft = {
  updateType: FamilyUpdateType;
  title: string;
  body: string;
  priority: FamilyUpdatePriority;
  requiresAcknowledgement: boolean;
};

const emptyDraft: Draft = {
  updateType: "general",
  title: "",
  body: "",
  priority: "routine",
  requiresAcknowledgement: false,
};

function Choice<T extends string>({
  values,
  value,
  labels,
  onChange,
}: {
  values: readonly T[];
  value: T;
  labels: Record<T, string>;
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {values.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="radio"
          accessibilityState={{ selected: item === value }}
          onPress={() => onChange(item)}
          style={[
            S.pill,
            {
              backgroundColor:
                item === value ? C.purple : C.lavender,
              paddingVertical: 10,
            },
          ]}
        >
          <Text
            style={[
              S.small,
              { color: item === value ? C.white : C.ink },
            ]}
          >
            {labels[item]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function FamilyCommunicationScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const viewer = state.accessRole === "viewer";

  const [updates, setUpdates] = useState<FamilyUpdate[]>([]);
  const [acknowledgements, setAcknowledgements] = useState<any[]>([]);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [filter, setFilter] = useState<
    "all" | "important" | "acknowledgement"
  >("all");

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setUpdates([]);
      setAcknowledgements([]);
      setRoster(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [center, team, userId] = await Promise.all([
        loadFamilyCommunicationCenter(careRecipientId),
        loadCareTeam(careRecipientId),
        familyCommunicationCurrentUserId(),
      ]);
      setUpdates(center.updates);
      setAcknowledgements(center.acknowledgements);
      setRoster(team);
      setCurrentUserId(userId);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load family communication.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`family-updates:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_family_updates",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_family_update_acknowledgements",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const memberMap = useMemo(
    () =>
      new Map(
        (roster?.members ?? []).map((member) => [
          member.userId,
          member.displayName ||
            (member.isCurrentUser ? "Me" : "Caregiver"),
        ]),
      ),
    [roster],
  );

  const summary = useMemo(
    () =>
      familyCommunicationSummary(
        updates,
        acknowledgements,
        currentUserId,
      ),
    [acknowledgements, currentUserId, updates],
  );

  const filtered = useMemo(() => {
    if (filter === "important") {
      return updates.filter((update) => update.priority === "important");
    }
    if (filter === "acknowledgement") {
      return updates.filter(
        (update) =>
          update.requiresAcknowledgement &&
          !familyUpdateAcknowledgedByUser(
            update.id,
            currentUserId,
            acknowledgements,
          ),
      );
    }
    return updates;
  }, [acknowledgements, currentUserId, filter, updates]);

  function authorName(userId: string | null) {
    if (!userId) return "Care team";
    if (userId === currentUserId) return "You";
    return memberMap.get(userId) ?? "Caregiver";
  }

  function canManage(update: FamilyUpdate) {
    return (
      state.accessRole === "owner" ||
      update.createdBy === currentUserId
    );
  }

  function openCreate() {
    setEditingId(null);
    setDraft(emptyDraft);
    setFormOpen(true);
    setMessage("");
  }

  function openEdit(update: FamilyUpdate) {
    setEditingId(update.id);
    setDraft({
      updateType: update.updateType,
      title: update.title,
      body: update.body,
      priority: update.priority,
      requiresAcknowledgement: update.requiresAcknowledgement,
    });
    setFormOpen(true);
    setMessage("");
  }

  async function save() {
    if (!careRecipientId || viewer || busyId) return;
    setBusyId("save");
    setMessage("");

    try {
      if (editingId) {
        await updateFamilyUpdate({
          careRecipientId,
          updateId: editingId,
          ...draft,
        });
      } else {
        await createFamilyUpdate({
          careRecipientId,
          ...draft,
        });
      }

      setFormOpen(false);
      setEditingId(null);
      setDraft(emptyDraft);
      await refresh();
      setMessage(
        editingId
          ? "Family update changed."
          : "Family care update shared with the active care team.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save this family update.",
      );
    } finally {
      setBusyId(null);
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="FAMILY COMMUNICATION"
          title="Choose a care profile first."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="FAMILY COMMUNICATION CENTER"
        title="Keep the family care team aligned without mixing family updates into provider notes."
        body="Share care changes, appointment context, medication-list updates, transition information, or coverage notes. Important posts can require acknowledgement."
      />

      <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
        <Card style={{ flex: 1, minWidth: 115 }}>
          <Text style={S.eyebrow}>UPDATES</Text>
          <Text style={S.h2}>{summary.total}</Text>
          <Txt style={S.small}>recent family posts</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 115 }}>
          <Text style={S.eyebrow}>IMPORTANT</Text>
          <Text style={S.h2}>{summary.important}</Text>
          <Txt style={S.small}>flagged updates</Txt>
        </Card>
        <Card style={{ flex: 1, minWidth: 140 }}>
          <Text style={S.eyebrow}>NEEDS YOU</Text>
          <Text style={S.h2}>{summary.needsMyAcknowledgement}</Text>
          <Txt style={S.small}>awaiting your acknowledgement</Txt>
        </Card>
      </View>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {viewer && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>
            You can follow family updates, but acknowledgement and posting are
            reserved for active Owners and Caregivers.
          </Txt>
        </Card>
      )}

      {!viewer && !formOpen && (
        <Button
          title="Share family care update"
          icon="chatbubbles-outline"
          onPress={openCreate}
        />
      )}

      {formOpen && !viewer && (
        <Card>
          <Text style={S.h3}>
            {editingId ? "Edit family update" : "New family update"}
          </Text>

          <Text style={S.h3}>Update type</Text>
          <Choice
            values={familyUpdateTypes}
            value={draft.updateType}
            labels={familyUpdateTypeLabels}
            onChange={(updateType) =>
              setDraft((current) => ({ ...current, updateType }))
            }
          />

          <Field
            label="Title"
            value={draft.title}
            onChange={(title) =>
              setDraft((current) => ({ ...current, title }))
            }
          />
          <Field
            label="Update"
            value={draft.body}
            onChange={(body) =>
              setDraft((current) => ({ ...current, body }))
            }
            multiline
          />

          <Text style={S.h3}>Priority</Text>
          <Choice
            values={familyUpdatePriorities}
            value={draft.priority}
            labels={familyUpdatePriorityLabels}
            onChange={(priority) =>
              setDraft((current) => ({
                ...current,
                priority,
                requiresAcknowledgement:
                  priority === "needs_acknowledgement"
                    ? true
                    : current.requiresAcknowledgement,
              }))
            }
          />

          <Button
            title={
              draft.requiresAcknowledgement
                ? "Acknowledgement required"
                : "Require acknowledgement"
            }
            secondary
            icon={
              draft.requiresAcknowledgement
                ? "checkmark-circle"
                : "checkmark-circle-outline"
            }
            onPress={() =>
              setDraft((current) => ({
                ...current,
                requiresAcknowledgement:
                  !current.requiresAcknowledgement,
                priority: !current.requiresAcknowledgement
                  ? "needs_acknowledgement"
                  : current.priority === "needs_acknowledgement"
                    ? "routine"
                    : current.priority,
              }))
            }
          />

          <Button
            title={busyId === "save" ? "Saving…" : "Share update"}
            disabled={
              busyId !== null ||
              !draft.title.trim() ||
              !draft.body.trim()
            }
            onPress={() => void save()}
          />
          <Button
            title="Cancel"
            secondary
            disabled={busyId !== null}
            onPress={() => {
              setFormOpen(false);
              setEditingId(null);
              setDraft(emptyDraft);
            }}
          />
        </Card>
      )}

      <Section title="Family update feed" />

      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {(
          [
            ["all", "All"],
            ["important", "Important"],
            ["acknowledgement", "Needs me"],
          ] as const
        ).map(([value, label]) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            accessibilityState={{ selected: filter === value }}
            onPress={() => setFilter(value)}
            style={[
              S.pill,
              {
                backgroundColor:
                  filter === value ? C.purple : C.lavender,
                paddingVertical: 10,
                paddingHorizontal: 14,
              },
            ]}
          >
            <Text
              style={[
                S.small,
                { color: filter === value ? C.white : C.ink },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading && !updates.length ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading family updates…</Txt>
        </Card>
      ) : !filtered.length ? (
        <Card>
          <Icon name="chatbubbles-outline" size={28} />
          <Text style={S.h3}>
            {filter === "all"
              ? "No family updates yet."
              : "Nothing matches this filter."}
          </Text>
          <Txt>
            Use this space for family care coordination, not emergency
            messages.
          </Txt>
        </Card>
      ) : (
        filtered.map((update) => {
          const acks = familyUpdateAcknowledgements(
            update.id,
            acknowledgements,
          );
          const acknowledgedByMe = familyUpdateAcknowledgedByUser(
            update.id,
            currentUserId,
            acknowledgements,
          );

          return (
            <Card
              key={update.id}
              style={{
                backgroundColor:
                  update.priority === "important" ||
                  update.requiresAcknowledgement
                    ? "#FFF9F2"
                    : C.white,
              }}
            >
              <View style={S.between}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.eyebrow}>
                    {familyUpdateTypeLabels[update.updateType].toUpperCase()}
                  </Text>
                  <Text style={S.h2}>{update.title}</Text>
                  <Txt style={S.small}>
                    {authorName(update.createdBy)} ·{" "}
                    {new Date(update.createdAt).toLocaleString()}
                  </Txt>
                </View>
                {(update.priority === "important" ||
                  update.requiresAcknowledgement) && (
                  <Icon
                    name={
                      update.requiresAcknowledgement
                        ? "checkmark-done-outline"
                        : "alert-circle-outline"
                    }
                    color={C.rose}
                  />
                )}
              </View>

              <Txt>{update.body}</Txt>

              {update.requiresAcknowledgement && (
                <Card style={{ backgroundColor: C.lavender }}>
                  <Text style={S.h3}>Acknowledgements</Text>
                  <Txt style={S.small}>
                    {acks.length} care-team member
                    {acks.length === 1 ? "" : "s"} acknowledged this update.
                  </Txt>
                  {!viewer && (
                    <Button
                      title={
                        acknowledgedByMe
                          ? "Acknowledged · undo"
                          : "I’ve read this update"
                      }
                      secondary={acknowledgedByMe}
                      disabled={busyId !== null}
                      onPress={async () => {
                        setBusyId("ack-" + update.id);
                        try {
                          if (acknowledgedByMe) {
                            await removeFamilyUpdateAcknowledgement({
                              careRecipientId,
                              updateId: update.id,
                            });
                          } else {
                            await acknowledgeFamilyUpdate({
                              careRecipientId,
                              updateId: update.id,
                            });
                          }
                          await refresh();
                        } catch (error) {
                          setMessage(
                            error instanceof Error
                              ? error.message
                              : "We could not update acknowledgement.",
                          );
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    />
                  )}
                </Card>
              )}

              {canManage(update) && !viewer && (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Edit"
                      secondary
                      onPress={() => openEdit(update)}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button
                      title="Delete"
                      secondary
                      disabled={busyId !== null}
                      onPress={async () => {
                        setBusyId("delete-" + update.id);
                        try {
                          await deleteFamilyUpdate(
                            careRecipientId,
                            update.id,
                          );
                          await refresh();
                          setMessage("Family update deleted.");
                        } catch (error) {
                          setMessage(
                            error instanceof Error
                              ? error.message
                              : "We could not delete this update.",
                          );
                        } finally {
                          setBusyId(null);
                        }
                      }}
                    />
                  </View>
                </View>
              )}
            </Card>
          );
        })
      )}

      <Button
        title="Provider / insurance communication log"
        secondary
        icon="document-text-outline"
        onPress={() => n.navigate("CareCommunicationLog")}
      />

      <Txt style={S.small}>
        Family Communication is for coordination between the care team. It is
        not monitored for emergencies and does not replace contacting a
        clinician, pharmacy, insurer, or emergency service directly.
      </Txt>
    </Page>
  );
}
