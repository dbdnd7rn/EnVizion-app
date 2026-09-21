import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import {
  completeCareReminder,
  createCareReminder,
  deleteCareReminder,
  detectedTimezone,
  dismissCareReminder,
  loadCareReminders,
  localDateTimeToIso,
  reminderLocalParts,
  reminderStatus,
  snoozeCareReminder,
  updateCareReminder,
  type CareReminder,
  type ReminderNotifyScope,
  type ReminderRecurrence,
  type ReminderType,
} from "../reminders";
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

const typeLabels: Record<ReminderType, string> = {
  general: "General care",
  appointment: "Appointment",
  transition: "Transition",
  medication_record: "Medication record",
};

const typeIcons: Record<ReminderType, string> = {
  general: "notifications-outline",
  appointment: "calendar-outline",
  transition: "home-outline",
  medication_record: "medical-outline",
};

function defaultLocalParts(offsetMinutes = 60) {
  const value = new Date(Date.now() + offsetMinutes * 60_000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return {
    date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    time: `${pad(value.getHours())}:${pad(value.getMinutes())}`,
  };
}

function Choice<T extends string>({
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
  onChange: (value: T) => void;
}) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {values.map((item) => (
        <Pressable
          key={item}
          accessibilityRole="radio"
          accessibilityState={{ selected: value === item, disabled }}
          disabled={disabled}
          onPress={() => onChange(item)}
          style={[
            S.pill,
            {
              minHeight: 42,
              justifyContent: "center",
              paddingHorizontal: 13,
              backgroundColor: value === item ? C.purple : C.lavender,
              opacity: disabled ? 0.55 : 1,
            },
          ]}
        >
          <Text
            style={[
              S.h3,
              {
                fontSize: 11,
                color: value === item ? C.white : C.deep,
              },
            ]}
          >
            {labels[item]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function ReminderCard({
  reminder,
  readOnly,
  busy,
  onEdit,
  onRefresh,
}: {
  reminder: CareReminder;
  readOnly: boolean;
  busy: boolean;
  onEdit: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const status = reminderStatus(reminder);
  const inactive = status === "completed" || status === "dismissed";

  async function run(task: () => Promise<unknown>, success: string) {
    setMessage("");
    try {
      await task();
      setMessage(success);
      await onRefresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update this reminder.",
      );
    }
  }

  return (
    <Card
      style={{
        borderColor: status === "due" ? "#E8BDC3" : C.line,
        backgroundColor: status === "due" ? "#FFF7F6" : C.white,
      }}
    >
      <View style={{ flexDirection: "row", gap: 13 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            backgroundColor: status === "due" ? C.redBg : C.lavender,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            name={typeIcons[reminder.reminderType]}
            color={status === "due" ? C.rose : C.purple}
            size={22}
          />
        </View>
        <View style={{ flex: 1, gap: 5 }}>
          <View style={S.between}>
            <Text style={S.h3}>{reminder.title}</Text>
            <View
              style={[
                S.pill,
                {
                  backgroundColor:
                    status === "due"
                      ? C.redBg
                      : inactive
                        ? "#F0ECEF"
                        : C.lavender,
                },
              ]}
            >
              <Text
                style={[
                  S.small,
                  {
                    color: status === "due" ? C.rose : C.deep,
                    fontFamily: "DMSans_600SemiBold",
                  },
                ]}
              >
                {status}
              </Text>
            </View>
          </View>

          {Boolean(reminder.note) && <Txt>{reminder.note}</Txt>}

          <Txt style={S.small}>
            {new Date(reminder.snoozedUntil ?? reminder.scheduledFor).toLocaleString()} ·{" "}
            {reminder.timezone}
            {reminder.snoozedUntil ? " · snoozed" : ""}
          </Txt>
          <Txt style={S.small}>
            {typeLabels[reminder.reminderType]} ·{" "}
            {reminder.recurrence === "none"
              ? "One time"
              : reminder.recurrence === "daily"
                ? "Daily"
                : "Weekly"}{" "}
            · {reminder.notifyScope === "care_team" ? "Care team" : "Only me"}
          </Txt>
        </View>
      </View>

      {!readOnly && !inactive && (
        <>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                void run(
                  () => snoozeCareReminder(reminder.id, 15),
                  "Reminder snoozed for 15 minutes.",
                )
              }
              style={[S.pill, { paddingHorizontal: 13, minHeight: 40, justifyContent: "center" }]}
            >
              <Text style={[S.h3, { fontSize: 11 }]}>Snooze 15m</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() =>
                void run(
                  () => snoozeCareReminder(reminder.id, 60),
                  "Reminder snoozed for one hour.",
                )
              }
              style={[S.pill, { paddingHorizontal: 13, minHeight: 40, justifyContent: "center" }]}
            >
              <Text style={[S.h3, { fontSize: 11 }]}>Snooze 1h</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onEdit}
              style={[S.pill, { paddingHorizontal: 13, minHeight: 40, justifyContent: "center" }]}
            >
              <Text style={[S.h3, { fontSize: 11 }]}>Edit</Text>
            </Pressable>
          </View>

          <Button
            title={
              reminder.recurrence === "none"
                ? "Mark complete"
                : "Complete and stop recurrence"
            }
            secondary
            disabled={busy}
            onPress={() =>
              void run(
                () => completeCareReminder(reminder.id),
                "Reminder completed.",
              )
            }
          />
          <Button
            title="Dismiss reminder"
            secondary
            disabled={busy}
            onPress={() =>
              void run(
                () => dismissCareReminder(reminder.id),
                "Reminder dismissed.",
              )
            }
          />
        </>
      )}

      {!readOnly && inactive && (
        <Button
          title="Delete reminder"
          secondary
          disabled={busy}
          onPress={() =>
            void run(
              () => deleteCareReminder(reminder.id),
              "Reminder deleted.",
            )
          }
        />
      )}

      {Boolean(message) && (
        <Text accessibilityRole="alert" style={S.small}>
          {message}
        </Text>
      )}
    </Card>
  );
}

export function CareCalendarScreen() {
  const n = useNav();
  const { state } = useCare();
  const [items, setItems] = useState<CareReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const initial = defaultLocalParts();
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [type, setType] = useState<ReminderType>("general");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [recurrence, setRecurrence] = useState<ReminderRecurrence>("none");
  const [notifyScope, setNotifyScope] =
    useState<ReminderNotifyScope>("creator");

  const readOnly = state.accessRole === "viewer";
  const careRecipientId = state.careRecipientId;
  const timezone = detectedTimezone();

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      setItems(await loadCareReminders(careRecipientId));
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the care calendar.",
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
      .channel(`care-reminders:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_reminders",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [careRecipientId, refresh]);

  const active = useMemo(
    () =>
      items.filter(
        (item) =>
          reminderStatus(item) === "due" ||
          reminderStatus(item) === "upcoming",
      ),
    [items],
  );
  const history = useMemo(
    () =>
      items
        .filter((item) => {
          const status = reminderStatus(item);
          return status === "completed" || status === "dismissed";
        })
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        ),
    [items],
  );

  function resetForm() {
    const next = defaultLocalParts();
    setEditingId(null);
    setTitle("");
    setNote("");
    setType("general");
    setDate(next.date);
    setTime(next.time);
    setRecurrence("none");
    setNotifyScope("creator");
    setShowForm(false);
  }

  function openEdit(reminder: CareReminder) {
    const parts = reminderLocalParts(reminder.scheduledFor);
    setEditingId(reminder.id);
    setTitle(reminder.title);
    setNote(reminder.note);
    setType(reminder.reminderType);
    setDate(parts.date);
    setTime(parts.time);
    setRecurrence(reminder.recurrence);
    setNotifyScope(reminder.notifyScope);
    setShowForm(true);
  }

  function appointmentPreset() {
    setType("appointment");
    setTitle(
      state.appointment.title
        ? `Prepare for ${state.appointment.title}`
        : "Prepare for upcoming appointment",
    );
    setNote("Review questions, notes, location, and the care record before the visit.");

    if (state.appointment.date) {
      setDate(state.appointment.date);
      if (state.appointment.time) setTime(state.appointment.time);
    }
    setShowForm(true);
  }

  function transitionPreset() {
    setType("transition");
    setTitle("Review hospital-to-home checklist");
    setNote("Review the shared transition checklist when it is useful.");
    setShowForm(true);
  }

  function medicationPreset(name?: string) {
    setType("medication_record");
    setTitle(name ? `Medication record: ${name}` : "Medication record check-in");
    setNote("Check the care routine and record medication information if appropriate.");
    setShowForm(true);
  }

  async function save() {
    if (!careRecipientId || readOnly) return;

    const scheduledFor = localDateTimeToIso(date, time);
    if (!title.trim()) {
      setMessage("Add a reminder title.");
      return;
    }
    if (!scheduledFor) {
      setMessage("Enter a valid date and 24-hour time.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      if (editingId) {
        await updateCareReminder(editingId, {
          title,
          note,
          reminderType: type,
          scheduledFor,
          timezone,
          recurrence,
          notifyScope,
        });
        setMessage("Reminder updated.");
      } else {
        await createCareReminder({
          careRecipientId,
          title,
          note,
          reminderType: type,
          scheduledFor,
          timezone,
          recurrence,
          notifyScope,
        });
        setMessage("Reminder added to the shared care calendar.");
      }

      resetForm();
      await refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save this reminder.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page>
      <Heading
        eyebrow="REMINDERS & CARE CALENDAR"
        title="Keep the next step visible."
        body="Shared planning for appointments, care transitions, general tasks, and optional medication-record prompts."
      />

      <Card style={{ backgroundColor: C.deep, borderWidth: 0 }}>
        <Text style={[S.eyebrow, { color: "#E5C8ED" }]}>ACTIVE CARE PROFILE</Text>
        <Text style={[S.h2, { color: C.white }]}>
          {state.careRecipientName || "Care profile"}
        </Text>
        <Txt style={{ color: "#E9DDED" }}>
          {active.length} active reminder{active.length === 1 ? "" : "s"} ·{" "}
          {state.accessRole === "viewer" ? "Viewer · read-only" : "Shared care editing"}
        </Txt>
      </Card>

      {readOnly && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>
            You can see shared reminders, but only the Owner or a Caregiver can
            create, snooze, edit, complete, or dismiss them.
          </Txt>
        </Card>
      )}

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {!readOnly && (
        <>
          <Section title="Quick add" />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <View style={{ flexGrow: 1, minWidth: 150 }}>
              <Button
                title="Appointment prep"
                secondary
                icon="calendar-outline"
                onPress={appointmentPreset}
              />
            </View>
            <View style={{ flexGrow: 1, minWidth: 150 }}>
              <Button
                title="Transition task"
                secondary
                icon="home-outline"
                onPress={transitionPreset}
              />
            </View>
            <View style={{ flexGrow: 1, minWidth: 150 }}>
              <Button
                title="Medication record"
                secondary
                icon="medical-outline"
                onPress={() => medicationPreset()}
              />
            </View>
          </View>

          {state.medications.length > 0 && (
            <Card>
              <Text style={S.h3}>Medication record prompts</Text>
              <Txt style={S.small}>
                These prompts are for record-keeping only. They do not tell
                anyone when or how much medication to take.
              </Txt>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {state.medications.slice(0, 6).map((medication) => (
                  <Pressable
                    key={medication.id}
                    accessibilityRole="button"
                    onPress={() => medicationPreset(medication.name)}
                    style={[
                      S.pill,
                      { minHeight: 40, justifyContent: "center", paddingHorizontal: 12 },
                    ]}
                  >
                    <Text style={[S.h3, { fontSize: 11 }]}>
                      {medication.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Card>
          )}

          <Button
            title={showForm ? "Close reminder form" : "Create custom reminder"}
            icon={showForm ? "close-outline" : "add-outline"}
            secondary
            onPress={() => {
              if (showForm) resetForm();
              else setShowForm(true);
            }}
          />
        </>
      )}

      {showForm && !readOnly && (
        <Card>
          <Text style={S.h2}>
            {editingId ? "Edit reminder" : "New reminder"}
          </Text>

          <Field label="Title" value={title} onChange={setTitle} />
          <Field
            label="Note (optional)"
            value={note}
            onChange={setNote}
            multiline
          />

          <Text style={S.h3}>Reminder type</Text>
          <Choice
            values={["general", "appointment", "transition", "medication_record"] as const}
            value={type}
            labels={typeLabels}
            disabled={busy}
            onChange={setType}
          />

          <Field
            label="Date (YYYY-MM-DD)"
            value={date}
            onChange={setDate}
          />
          <Field
            label="Time (HH:MM, 24-hour)"
            value={time}
            onChange={setTime}
          />
          <Txt style={S.small}>Timezone: {timezone}</Txt>

          <Text style={S.h3}>Repeat</Text>
          <Choice
            values={["none", "daily", "weekly"] as const}
            value={recurrence}
            labels={{
              none: "One time",
              daily: "Daily",
              weekly: "Weekly",
            }}
            disabled={busy}
            onChange={setRecurrence}
          />

          <Text style={S.h3}>Who gets the in-app notification?</Text>
          <Choice
            values={["creator", "care_team"] as const}
            value={notifyScope}
            labels={{
              creator: "Only me",
              care_team: "Care team",
            }}
            disabled={busy}
            onChange={setNotifyScope}
          />

          <Button
            title={
              busy
                ? "Saving reminder…"
                : editingId
                  ? "Save reminder changes"
                  : "Add reminder"
            }
            disabled={busy}
            onPress={() => void save()}
          />
        </Card>
      )}

      <Section
        title="Upcoming & due"
        action="Refresh"
        onPress={() => void refresh()}
      />

      {loading && !items.length ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading care calendar…</Txt>
        </Card>
      ) : !active.length ? (
        <Card>
          <Icon name="calendar-clear-outline" size={30} />
          <Text style={S.h3}>Nothing scheduled yet.</Text>
          <Txt>
            Add a reminder when there is something worth bringing back into
            view later.
          </Txt>
        </Card>
      ) : (
        active.map((reminder) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            readOnly={readOnly}
            busy={busy}
            onEdit={() => openEdit(reminder)}
            onRefresh={refresh}
          />
        ))
      )}

      <Section title="Completed & dismissed" />
      {!history.length ? (
        <Card>
          <Txt>Completed or dismissed reminders will appear here.</Txt>
        </Card>
      ) : (
        history.slice(0, 20).map((reminder) => (
          <ReminderCard
            key={reminder.id}
            reminder={reminder}
            readOnly={readOnly}
            busy={busy}
            onEdit={() => openEdit(reminder)}
            onRefresh={refresh}
          />
        ))
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>About reminder notifications</Text>
        <Txt>
          EnVizion checks due reminders approximately every five minutes and
          places them in the in-app notification center. Reminders are not
          emergency monitoring, medication orders, or confirmation that a care
          task was completed.
        </Txt>
        <Pressable
          accessibilityRole="button"
          onPress={() => n.navigate("Notifications")}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={[S.h3, { color: C.purple, fontSize: 13 }]}>
            Open notifications →
          </Text>
        </Pressable>
      </Card>
    </Page>
  );
}
