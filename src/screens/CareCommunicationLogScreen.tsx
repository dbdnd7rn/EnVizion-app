import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  careCommunicationPriorities,
  careCommunicationPriorityLabels,
  careCommunicationSearchText,
  careCommunicationTypes,
  careCommunicationTypeLabels,
  createCareCommunication,
  dateTimeInputToIso,
  deleteCareCommunication,
  isoToDateTimeInputs,
  loadCareCommunications,
  updateCareCommunication,
  type CareCommunication,
  type CareCommunicationInput,
  type CareCommunicationPriority,
  type CareCommunicationType,
} from "../careCommunications";
import {
  careContactCategoryLabels,
  loadCareContacts,
  type CareContact,
} from "../careContacts";
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

type Draft = {
  communicationType: CareCommunicationType;
  date: string;
  time: string;
  contactId: string | null;
  personSpokenTo: string;
  organizationName: string;
  summary: string;
  outcome: string;
  followUpNeeded: boolean;
  followUpDate: string;
  followUpTime: string;
  notes: string;
  priority: CareCommunicationPriority;
  tag: string;
};

function todayInputs() {
  return isoToDateTimeInputs(new Date().toISOString());
}

function blankDraft(): Draft {
  const now = todayInputs();
  return {
    communicationType: "phone_call",
    date: now.date,
    time: now.time,
    contactId: null,
    personSpokenTo: "",
    organizationName: "",
    summary: "",
    outcome: "",
    followUpNeeded: false,
    followUpDate: "",
    followUpTime: "09:00",
    notes: "",
    priority: "routine",
    tag: "",
  };
}

function Picker<T extends string>({
  values,
  value,
  labels,
  disabled,
  onChange,
}: {
  values: readonly T[];
  value: T;
  labels: Record<T, string>;
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {values.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => onChange(option)}
            style={[
              S.pill,
              {
                minHeight: 42,
                justifyContent: "center",
                paddingHorizontal: 14,
                backgroundColor: selected ? C.purple : C.lavender,
                opacity: disabled ? 0.55 : 1,
              },
            ]}
          >
            <Text
              style={[
                S.h3,
                {
                  fontSize: 12,
                  color: selected ? C.white : C.deep,
                },
              ]}
            >
              {labels[option]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SmallAction({
  title,
  icon,
  onPress,
}: {
  title: string;
  icon: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 42,
        borderRadius: 13,
        paddingHorizontal: 14,
        paddingVertical: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 7,
        backgroundColor: C.lavender,
        opacity: pressed ? 0.72 : 1,
      })}
    >
      <Icon name={icon} size={17} />
      <Text style={[S.h3, { fontSize: 12, color: C.deep }]}>{title}</Text>
    </Pressable>
  );
}

function priorityBackground(priority: CareCommunicationPriority) {
  if (priority === "important") return "#FFF1E5";
  if (priority === "follow_up") return "#F1EAF5";
  return "#EEF3F1";
}

export function CareCommunicationLogScreen() {
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const viewer = state.accessRole === "viewer";
  const [communications, setCommunications] = useState<CareCommunication[]>([]);
  const [contacts, setContacts] = useState<CareContact[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | CareCommunicationType>("all");
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft());

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setCommunications([]);
      setContacts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const [communicationRows, contactRows] = await Promise.all([
        loadCareCommunications(careRecipientId),
        loadCareContacts(careRecipientId),
      ]);
      setCommunications(communicationRows);
      setContacts(contactRows);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the communication log.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const contactsById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return communications.filter((communication) => {
      const contact = communication.contactId
        ? contactsById.get(communication.contactId)
        : null;
      const linkedText = contact
        ? [
            contact.providerName,
            contact.organizationName,
            contact.specialty,
            careContactCategoryLabels[contact.category],
          ].join(" ")
        : "";

      return (
        (filter === "all" || communication.communicationType === filter) &&
        (!followUpOnly || communication.followUpNeeded) &&
        (!needle ||
          careCommunicationSearchText(communication, linkedText).includes(needle))
      );
    });
  }, [communications, contactsById, filter, followUpOnly, query]);

  function openAdd() {
    setEditingId(null);
    setPendingDeleteId(null);
    setDraft(blankDraft());
    setFormOpen(true);
    setMessage("");
  }

  function openEdit(item: CareCommunication) {
    const occurred = isoToDateTimeInputs(item.occurredAt);
    const followUp = item.followUpAt
      ? isoToDateTimeInputs(item.followUpAt)
      : { date: "", time: "09:00" };

    setEditingId(item.id);
    setPendingDeleteId(null);
    setDraft({
      communicationType: item.communicationType,
      date: occurred.date,
      time: occurred.time,
      contactId: item.contactId,
      personSpokenTo: item.personSpokenTo,
      organizationName: item.organizationName,
      summary: item.summary,
      outcome: item.outcome,
      followUpNeeded: item.followUpNeeded,
      followUpDate: followUp.date,
      followUpTime: followUp.time || "09:00",
      notes: item.notes,
      priority: item.priority,
      tag: item.tag,
    });
    setFormOpen(true);
    setMessage("");
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setPendingDeleteId(null);
    setDraft(blankDraft());
  }

  async function save() {
    if (!careRecipientId || viewer || busy) return;
    if (!draft.summary.trim()) {
      setMessage("Add a short summary of the communication first.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const occurredAt = dateTimeInputToIso(draft.date, draft.time);
      const followUpAt = draft.followUpNeeded
        ? dateTimeInputToIso(draft.followUpDate, draft.followUpTime)
        : null;

      const input: CareCommunicationInput = {
        contactId: draft.contactId,
        communicationType: draft.communicationType,
        occurredAt,
        personSpokenTo: draft.personSpokenTo,
        organizationName: draft.organizationName,
        summary: draft.summary,
        outcome: draft.outcome,
        followUpNeeded: draft.followUpNeeded,
        followUpAt,
        notes: draft.notes,
        priority: draft.priority,
        tag: draft.tag,
      };

      if (editingId) {
        await updateCareCommunication(careRecipientId, editingId, input);
      } else {
        await createCareCommunication(careRecipientId, input);
      }

      closeForm();
      await refresh();
      setMessage(editingId ? "Communication updated." : "Communication saved.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save this communication.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(communicationId: string) {
    if (!careRecipientId || viewer || busy) return;

    setBusy(true);
    setMessage("");
    try {
      await deleteCareCommunication(careRecipientId, communicationId);
      closeForm();
      await refresh();
      setMessage("Communication removed.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not remove this communication.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function call(phone: string) {
    try {
      const number = phone.replace(/[^+\d*#,;]/g, "");
      await Linking.openURL(`tel:${number}`);
    } catch {
      setMessage("This device could not open the phone app.");
    }
  }

  async function email(address: string) {
    try {
      await Linking.openURL(`mailto:${address.trim()}`);
    } catch {
      setMessage("This device could not open an email app.");
    }
  }

  if (!careRecipientId) {
    return (
      <Page>
        <Heading
          eyebrow="CARE NOTES"
          title="Choose a care profile first."
          body="Communication history belongs to a specific care profile."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="CARE NOTES + COMMUNICATION LOG"
        title="Remember what was said, what changed, and what comes next."
        body="Keep calls, messages, hospital updates, pharmacy conversations, insurance discussions, and provider follow-ups together."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E7CFEF" }]}>ACTIVE CARE PROFILE</Text>
        <Text style={[S.h2, { color: C.white }]}>
          {state.careRecipientName || "Care profile"}
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          {state.accessRole === "owner"
            ? "Owner"
            : state.accessRole === "caregiver"
              ? "Caregiver"
              : "Viewer"}{" "}
          access · {communications.length} communication
          {communications.length === 1 ? "" : "s"}
        </Txt>
      </Card>

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
            You can review the shared communication history, but only the Owner
            or a Caregiver can add, edit, or delete entries.
          </Txt>
        </Card>
      )}

      {!viewer && !formOpen && (
        <Button
          title="Log a communication"
          icon="chatbubbles-outline"
          onPress={openAdd}
        />
      )}

      {formOpen && !viewer && (
        <>
          <Section title={editingId ? "Edit communication" : "Log communication"} />
          <Card>
            <Text style={S.h3}>Communication type</Text>
            <Picker
              values={careCommunicationTypes}
              value={draft.communicationType}
              labels={careCommunicationTypeLabels}
              disabled={busy}
              onChange={(communicationType) =>
                setDraft((current) => ({ ...current, communicationType }))
              }
            />

            <Field
              label="Date (YYYY-MM-DD)"
              value={draft.date}
              onChange={(date) => setDraft((current) => ({ ...current, date }))}
            />
            <Field
              label="Time (HH:MM, 24-hour)"
              value={draft.time}
              onChange={(time) => setDraft((current) => ({ ...current, time }))}
            />

            <Text style={S.h3}>Linked provider or care contact (optional)</Text>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.contactId === null }}
              disabled={busy}
              onPress={() =>
                setDraft((current) => ({ ...current, contactId: null }))
              }
              style={[
                S.card,
                {
                  padding: 14,
                  borderColor: draft.contactId === null ? C.purple : C.line,
                  backgroundColor:
                    draft.contactId === null ? "#F6F0F8" : C.white,
                },
              ]}
            >
              <View style={S.row}>
                <Icon
                  name={
                    draft.contactId === null
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                />
                <Text style={S.h3}>No linked provider</Text>
              </View>
            </Pressable>

            {contacts.map((contact) => {
              const selected = draft.contactId === contact.id;
              return (
                <Pressable
                  key={contact.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  disabled={busy}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      contactId: contact.id,
                      organizationName:
                        current.organizationName || contact.organizationName,
                      personSpokenTo:
                        current.personSpokenTo || contact.providerName,
                    }))
                  }
                  style={[
                    S.card,
                    {
                      padding: 14,
                      borderColor: selected ? C.purple : C.line,
                      backgroundColor: selected ? "#F6F0F8" : C.white,
                    },
                  ]}
                >
                  <View style={S.row}>
                    <Icon
                      name={selected ? "checkmark-circle" : "ellipse-outline"}
                    />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={S.h3}>{contact.providerName}</Text>
                      <Text style={S.small}>
                        {careContactCategoryLabels[contact.category]}
                        {contact.specialty ? ` · ${contact.specialty}` : ""}
                        {contact.organizationName
                          ? ` · ${contact.organizationName}`
                          : ""}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}

            <Field
              label="Person spoken to"
              value={draft.personSpokenTo}
              onChange={(personSpokenTo) =>
                setDraft((current) => ({ ...current, personSpokenTo }))
              }
            />
            <Field
              label="Organization or department"
              value={draft.organizationName}
              onChange={(organizationName) =>
                setDraft((current) => ({ ...current, organizationName }))
              }
            />
            <Field
              label="What was discussed?"
              value={draft.summary}
              onChange={(summary) =>
                setDraft((current) => ({ ...current, summary }))
              }
              multiline
            />
            <Field
              label="Outcome or decision"
              value={draft.outcome}
              onChange={(outcome) =>
                setDraft((current) => ({ ...current, outcome }))
              }
              multiline
            />

            <Text style={S.h3}>Priority / status</Text>
            <Picker
              values={careCommunicationPriorities}
              value={draft.priority}
              labels={careCommunicationPriorityLabels}
              disabled={busy}
              onChange={(priority) =>
                setDraft((current) => ({ ...current, priority }))
              }
            />

            <Field
              label="Tag (optional)"
              value={draft.tag}
              onChange={(tag) => setDraft((current) => ({ ...current, tag }))}
            />

            <View style={S.between}>
              <View style={{ flex: 1, gap: 3, paddingRight: 12 }}>
                <Text style={S.h3}>Follow-up needed</Text>
                <Txt style={S.small}>
                  Add a date when someone needs to call, message, or check back.
                </Txt>
              </View>
              <Switch
                accessibilityLabel="Follow-up needed"
                value={draft.followUpNeeded}
                disabled={busy}
                onValueChange={(followUpNeeded) =>
                  setDraft((current) => ({
                    ...current,
                    followUpNeeded,
                    priority: followUpNeeded ? "follow_up" : current.priority,
                  }))
                }
                trackColor={{ true: C.purple }}
              />
            </View>

            {draft.followUpNeeded && (
              <>
                <Field
                  label="Follow-up date (YYYY-MM-DD)"
                  value={draft.followUpDate}
                  onChange={(followUpDate) =>
                    setDraft((current) => ({ ...current, followUpDate }))
                  }
                />
                <Field
                  label="Follow-up time (HH:MM, 24-hour)"
                  value={draft.followUpTime}
                  onChange={(followUpTime) =>
                    setDraft((current) => ({ ...current, followUpTime }))
                  }
                />
              </>
            )}

            <Field
              label="Additional caregiver notes"
              value={draft.notes}
              onChange={(notes) =>
                setDraft((current) => ({ ...current, notes }))
              }
              multiline
            />

            <Button
              title={editingId ? "Save communication" : "Add to communication log"}
              icon="checkmark-circle-outline"
              disabled={busy}
              onPress={() => void save()}
            />
            <Button
              title="Cancel"
              secondary
              disabled={busy}
              onPress={closeForm}
            />

            {editingId && (
              <>
                <Button
                  title={
                    pendingDeleteId === editingId
                      ? "Cancel delete"
                      : "Delete this communication"
                  }
                  secondary
                  disabled={busy}
                  onPress={() =>
                    setPendingDeleteId((current) =>
                      current === editingId ? null : editingId,
                    )
                  }
                />
                {pendingDeleteId === editingId && (
                  <Card style={{ backgroundColor: C.redBg }}>
                    <Text style={[S.h3, { color: C.rose }]}>
                      Delete this communication entry?
                    </Text>
                    <Txt>
                      This removes the caregiver log entry from the shared care
                      profile. It does not contact or notify the provider.
                    </Txt>
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => void remove(editingId)}
                      style={({ pressed }) => ({
                        minHeight: 48,
                        borderRadius: 14,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: C.rose,
                        opacity: busy ? 0.5 : pressed ? 0.75 : 1,
                      })}
                    >
                      <Text style={[S.h3, { fontSize: 13, color: C.white }]}>
                        Delete permanently
                      </Text>
                    </Pressable>
                  </Card>
                )}
              </>
            )}
          </Card>
        </>
      )}

      <Section
        title="Communication timeline"
        action="Refresh"
        onPress={() => void refresh()}
      />

      <View style={[S.input, S.row]}>
        <Icon name="search-outline" size={20} />
        <TextInput
          accessibilityLabel="Search communication log"
          placeholder="Search provider, outcome, insurance, notes…"
          placeholderTextColor="#AAA0AF"
          value={query}
          onChangeText={setQuery}
          style={{
            flex: 1,
            fontFamily: "DMSans_400Regular",
            fontSize: 14,
            color: C.ink,
          }}
        />
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Pressable
          accessibilityRole="radio"
          accessibilityState={{ selected: filter === "all" }}
          onPress={() => setFilter("all")}
          style={[
            S.pill,
            {
              minHeight: 40,
              justifyContent: "center",
              backgroundColor: filter === "all" ? C.purple : C.lavender,
            },
          ]}
        >
          <Text
            style={[
              S.h3,
              { fontSize: 11, color: filter === "all" ? C.white : C.deep },
            ]}
          >
            All
          </Text>
        </Pressable>

        {careCommunicationTypes.map((type) => (
          <Pressable
            key={type}
            accessibilityRole="radio"
            accessibilityState={{ selected: filter === type }}
            onPress={() => setFilter(type)}
            style={[
              S.pill,
              {
                minHeight: 40,
                justifyContent: "center",
                backgroundColor: filter === type ? C.purple : C.lavender,
              },
            ]}
          >
            <Text
              style={[
                S.h3,
                { fontSize: 11, color: filter === type ? C.white : C.deep },
              ]}
            >
              {careCommunicationTypeLabels[type]}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: followUpOnly }}
        onPress={() => setFollowUpOnly((current) => !current)}
        style={[
          S.card,
          S.row,
          {
            padding: 15,
            borderColor: followUpOnly ? C.purple : C.line,
            backgroundColor: followUpOnly ? "#F6F0F8" : C.white,
          },
        ]}
      >
        <Icon
          name={followUpOnly ? "checkmark-circle" : "ellipse-outline"}
          color={followUpOnly ? C.purple : C.muted}
        />
        <Text style={S.h3}>Show follow-ups only</Text>
      </Pressable>

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading communication history…</Txt>
        </Card>
      ) : filtered.length ? (
        filtered.map((item) => {
          const linked = item.contactId ? contactsById.get(item.contactId) : null;
          const followUpLabel =
            item.followUpNeeded && item.followUpAt
              ? new Date(item.followUpAt).toLocaleString()
              : "";

          return (
            <Card key={item.id}>
              <View style={S.between}>
                <View style={{ flex: 1, gap: 5 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      flexWrap: "wrap",
                      gap: 7,
                    }}
                  >
                    <View
                      style={[
                        S.pill,
                        {
                          alignSelf: "flex-start",
                          backgroundColor: C.lavender,
                        },
                      ]}
                    >
                      <Text style={[S.small, { color: C.deep }]}>
                        {careCommunicationTypeLabels[item.communicationType]}
                      </Text>
                    </View>
                    <View
                      style={[
                        S.pill,
                        {
                          alignSelf: "flex-start",
                          backgroundColor: priorityBackground(item.priority),
                        },
                      ]}
                    >
                      <Text style={[S.small, { color: C.deep }]}>
                        {careCommunicationPriorityLabels[item.priority]}
                      </Text>
                    </View>
                    {Boolean(item.tag) && (
                      <View style={S.pill}>
                        <Text style={S.small}>{item.tag}</Text>
                      </View>
                    )}
                  </View>

                  <Text style={S.h2}>{item.summary}</Text>
                  <Text style={S.small}>
                    {new Date(item.occurredAt).toLocaleString()}
                  </Text>
                </View>

                {!viewer && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit communication"
                    onPress={() => openEdit(item)}
                    style={{
                      minWidth: 44,
                      minHeight: 44,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon name="create-outline" />
                  </Pressable>
                )}
              </View>

              {linked && (
                <Card style={{ backgroundColor: "#F8F4F9", padding: 14 }}>
                  <Text style={S.eyebrow}>LINKED CARE CONTACT</Text>
                  <Text style={S.h3}>{linked.providerName}</Text>
                  <Txt style={S.small}>
                    {careContactCategoryLabels[linked.category]}
                    {linked.specialty ? ` · ${linked.specialty}` : ""}
                    {linked.organizationName
                      ? ` · ${linked.organizationName}`
                      : ""}
                  </Txt>
                </Card>
              )}

              {Boolean(item.personSpokenTo || item.organizationName) && (
                <Txt>
                  {[item.personSpokenTo, item.organizationName]
                    .filter(Boolean)
                    .join(" · ")}
                </Txt>
              )}

              {Boolean(item.outcome) && (
                <View style={{ gap: 4 }}>
                  <Text style={S.eyebrow}>OUTCOME</Text>
                  <Txt>{item.outcome}</Txt>
                </View>
              )}

              {item.followUpNeeded && (
                <Card style={{ backgroundColor: "#FFF7EC", padding: 14 }}>
                  <View style={S.row}>
                    <Icon name="alarm-outline" />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={S.h3}>Follow-up needed</Text>
                      <Txt style={S.small}>
                        {followUpLabel || "No follow-up time recorded"}
                      </Txt>
                    </View>
                  </View>
                </Card>
              )}

              {Boolean(item.notes) && (
                <View style={{ gap: 4 }}>
                  <Text style={S.eyebrow}>CAREGIVER NOTES</Text>
                  <Txt>{item.notes}</Txt>
                </View>
              )}

              {linked && (linked.phone || linked.email) && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {Boolean(linked.phone) && (
                    <SmallAction
                      title="Call provider"
                      icon="call-outline"
                      onPress={() => void call(linked.phone)}
                    />
                  )}
                  {Boolean(linked.email) && (
                    <SmallAction
                      title="Email provider"
                      icon="mail-outline"
                      onPress={() => void email(linked.email)}
                    />
                  )}
                </View>
              )}
            </Card>
          );
        })
      ) : (
        <Card>
          <Icon name="chatbubbles-outline" size={30} />
          <Text style={S.h3}>
            {communications.length
              ? "No communications match these filters."
              : "No communication history yet."}
          </Text>
          <Txt>
            {communications.length
              ? "Try another search, type, or follow-up filter."
              : viewer
                ? "The Owner or a Caregiver can add provider and care-service conversations here."
                : "Log important calls, messages, visits, hospital updates, pharmacy conversations, and insurance discussions as they happen."}
          </Txt>
          {!viewer && !communications.length && (
            <Button title="Log first communication" onPress={openAdd} />
          )}
        </Card>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>A caregiver communication record, not a clinical record.</Text>
        <Txt>
          Use this log to remember conversations and follow-ups. Verify medical
          instructions with the healthcare team and use emergency services for
          urgent or life-threatening concerns.
        </Txt>
      </Card>
    </Page>
  );
}
