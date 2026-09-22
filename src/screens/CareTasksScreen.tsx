import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  careTaskCategories,
  careTaskCategoryLabels,
  careTaskDisplayStatus,
  careTaskDisplayStatusLabel,
  careTaskPriorities,
  careTaskPriorityLabels,
  careTaskRecurrences,
  careTaskRecurrenceLabels,
  careTaskSearchText,
  type CareTaskCategory,
  type CareTaskPriority,
  type CareTaskRecurrence,
} from "../careTaskHelpers";
import {
  cancelCareTask,
  completeCareTask,
  createCareTask,
  currentCareTaskUserId,
  deleteCareTask,
  loadCareTaskCompletions,
  loadCareTasks,
  reopenCareTask,
  updateCareTask,
  type CareTask,
  type CareTaskCompletion,
  type CareTaskInput,
} from "../careTasks";
import {
  claimCareTask,
  loadCareTaskAssignments,
  respondCareTaskAssignment,
} from "../careTaskAssignments";
import {
  latestTaskAssignments,
  pendingAssignmentForUser,
  taskAssignmentLabel,
  type CareTaskAssignment,
} from "../careTaskAssignmentHelpers";
import {
  loadCareTeam,
  type CareTeamMember,
  type CareTeamRoster,
} from "../careTeam";
import {
  careContactCategoryLabels,
  loadCareContacts,
  type CareContact,
} from "../careContacts";
import {
  careCommunicationTypeLabels,
  loadCareCommunications,
  type CareCommunication,
} from "../careCommunications";
import {
  detectedTimezone,
  localDateTimeToIso,
  reminderLocalParts,
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

type TaskFilter =
  | "all"
  | "mine"
  | "overdue"
  | "due_today"
  | "upcoming"
  | "history";

type Draft = {
  assignedTo: string | null;
  category: CareTaskCategory;
  title: string;
  details: string;
  dueDate: string;
  dueTime: string;
  recurrence: CareTaskRecurrence;
  priority: CareTaskPriority;
  medicationId: string | null;
  appointmentId: string | null;
  contactId: string | null;
  communicationId: string | null;
};

const filterLabels: Record<TaskFilter, string> = {
  all: "Open",
  mine: "My tasks",
  overdue: "Overdue",
  due_today: "Due today",
  upcoming: "Upcoming",
  history: "History",
};

function defaultDueParts() {
  const value = new Date(Date.now() + 60 * 60_000);
  return reminderLocalParts(value.toISOString());
}

function blankDraft(currentUserId: string | null): Draft {
  const due = defaultDueParts();
  return {
    assignedTo: currentUserId,
    category: "general",
    title: "",
    details: "",
    dueDate: due.date,
    dueTime: due.time,
    recurrence: "none",
    priority: "routine",
    medicationId: null,
    appointmentId: null,
    contactId: null,
    communicationId: null,
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
                  fontSize: 11,
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

function SelectCard({
  title,
  subtitle,
  selected,
  disabled,
  onPress,
}: {
  title: string;
  subtitle?: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        S.card,
        {
          padding: 14,
          borderColor: selected ? C.purple : C.line,
          backgroundColor: selected ? "#F6F0F8" : C.white,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <View style={S.row}>
        <Icon
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          color={selected ? C.purple : C.muted}
        />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={S.h3}>{title}</Text>
          {Boolean(subtitle) && <Txt style={S.small}>{subtitle}</Txt>}
        </View>
      </View>
    </Pressable>
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

function priorityBackground(priority: CareTaskPriority) {
  if (priority === "high") return "#FDE9EC";
  if (priority === "important") return "#FFF1E5";
  return "#EEF3F1";
}

function statusBackground(status: ReturnType<typeof careTaskDisplayStatus>) {
  if (status === "overdue") return C.redBg;
  if (status === "due_today") return "#FFF1E5";
  if (status === "completed") return "#EAF4EF";
  if (status === "cancelled") return "#F0ECEF";
  return C.lavender;
}

export function CareTasksScreen() {
  const n = useNav();
  const { state } = useCare();
  const careRecipientId = state.careRecipientId;
  const readOnly = state.accessRole === "viewer";

  const [tasks, setTasks] = useState<CareTask[]>([]);
  const [completions, setCompletions] = useState<CareTaskCompletion[]>([]);
  const [assignments, setAssignments] = useState<CareTaskAssignment[]>([]);
  const [contacts, setContacts] = useState<CareContact[]>([]);
  const [communications, setCommunications] = useState<CareCommunication[]>([]);
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [filter, setFilter] = useState<TaskFilter>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft(null));

  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completionNote, setCompletionNote] = useState("");

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setTasks([]);
      setCompletions([]);
      setAssignments([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    try {
      const userId = await currentCareTaskUserId();
      const [
        taskRows,
        completionRows,
        assignmentRows,
        contactRows,
        communicationRows,
        team,
      ] = await Promise.all([
          loadCareTasks(careRecipientId),
          loadCareTaskCompletions(careRecipientId),
          loadCareTaskAssignments(careRecipientId),
          loadCareContacts(careRecipientId),
          loadCareCommunications(careRecipientId),
          loadCareTeam(careRecipientId),
        ]);

      setCurrentUserId(userId);
      setTasks(taskRows);
      setCompletions(completionRows);
      setAssignments(assignmentRows);
      setContacts(contactRows);
      setCommunications(communicationRows);
      setRoster(team);
      setDraft((current) =>
        current.assignedTo === null && !formOpen
          ? { ...current, assignedTo: userId }
          : current,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the shared care plan.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, formOpen]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const taskChannel = supabase
      .channel(`care-tasks:${careRecipientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_tasks",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_task_completions",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_task_assignments",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(taskChannel);
    };
  }, [careRecipientId, refresh]);

  const assignableMembers = useMemo(() => {
    const members =
      roster?.members.filter(
        (member) =>
          member.status === "active" &&
          (member.role === "owner" || member.role === "caregiver"),
      ) ?? [];

    if (
      currentUserId &&
      state.accessRole !== "viewer" &&
      !members.some((member) => member.userId === currentUserId)
    ) {
      return [
        {
          userId: currentUserId,
          displayName: state.name || "Me",
          email: "",
          role: state.accessRole,
          status: "active",
          invitedAt: null,
          acceptedAt: null,
          revokedAt: null,
          isCurrentUser: true,
        } as CareTeamMember,
        ...members,
      ];
    }

    return members;
  }, [currentUserId, roster, state.accessRole, state.name]);

  const memberById = useMemo(() => {
    const members = roster?.members ?? [];
    const map = new Map(members.map((member) => [member.userId, member]));

    if (
      currentUserId &&
      state.accessRole !== "viewer" &&
      !map.has(currentUserId)
    ) {
      map.set(currentUserId, {
        userId: currentUserId,
        displayName: state.name || "Me",
        email: "",
        role: state.accessRole,
        status: "active",
        invitedAt: null,
        acceptedAt: null,
        revokedAt: null,
        isCurrentUser: true,
      } as CareTeamMember);
    }

    return map;
  }, [currentUserId, roster, state.accessRole, state.name]);

  const contactsById = useMemo(
    () => new Map(contacts.map((contact) => [contact.id, contact])),
    [contacts],
  );

  const communicationsById = useMemo(
    () =>
      new Map(
        communications.map((communication) => [
          communication.id,
          communication,
        ]),
      ),
    [communications],
  );

  const tasksById = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );

  const latestAssignmentByTask = useMemo(
    () => latestTaskAssignments(assignments),
    [assignments],
  );

  const visibleTasks = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return tasks
      .filter((task) => {
        const status = careTaskDisplayStatus(task);
        const member = task.assignedTo ? memberById.get(task.assignedTo) : null;
        const contact = task.contactId ? contactsById.get(task.contactId) : null;
        const communication = task.communicationId
          ? communicationsById.get(task.communicationId)
          : null;
        const medication = task.medicationId
          ? state.medications.find((item) => item.id === task.medicationId)
          : null;

        const linkedText = [
          member?.displayName,
          contact?.providerName,
          contact?.organizationName,
          communication?.summary,
          medication?.name,
          task.appointmentId ? state.appointment.title : "",
        ]
          .filter(Boolean)
          .join(" ");

        const filterMatch =
          filter === "all"
            ? task.status === "open"
            : filter === "mine"
              ? task.status === "open" && task.assignedTo === currentUserId
              : filter === "history"
                ? task.status === "completed" || task.status === "cancelled"
                : task.status === "open" && status === filter;

        return (
          filterMatch &&
          (!needle || careTaskSearchText(task, linkedText).includes(needle))
        );
      })
      .sort((a, b) => {
        if (filter === "history") {
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        }
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
  }, [
    contactsById,
    communicationsById,
    currentUserId,
    filter,
    memberById,
    query,
    state.appointment.title,
    state.medications,
    tasks,
  ]);

  const counts = useMemo(() => {
    const open = tasks.filter((task) => task.status === "open");
    return {
      open: open.length,
      overdue: open.filter(
        (task) => careTaskDisplayStatus(task) === "overdue",
      ).length,
      dueToday: open.filter(
        (task) => careTaskDisplayStatus(task) === "due_today",
      ).length,
      mine: open.filter((task) => task.assignedTo === currentUserId).length,
    };
  }, [currentUserId, tasks]);

  function changeCategory(category: CareTaskCategory) {
    setDraft((current) => ({
      ...current,
      category,
      medicationId: category === "medication" ? current.medicationId : null,
      appointmentId:
        category === "appointment" ? current.appointmentId : null,
      contactId:
        category === "provider" || category === "insurance"
          ? current.contactId
          : null,
      communicationId:
        category === "communication_follow_up"
          ? current.communicationId
          : null,
    }));
  }

  function openAdd() {
    setEditingId(null);
    setPendingDeleteId(null);
    setDraft(blankDraft(currentUserId));
    setFormOpen(true);
    setCompletingId(null);
    setCompletionNote("");
    setMessage("");
  }

  function openEdit(task: CareTask) {
    const due = reminderLocalParts(task.dueAt);
    setEditingId(task.id);
    setPendingDeleteId(null);
    setDraft({
      assignedTo: task.assignedTo,
      category: task.category,
      title: task.title,
      details: task.details,
      dueDate: due.date,
      dueTime: due.time,
      recurrence: task.recurrence,
      priority: task.priority,
      medicationId: task.medicationId,
      appointmentId: task.appointmentId,
      contactId: task.contactId,
      communicationId: task.communicationId,
    });
    setFormOpen(true);
    setCompletingId(null);
    setCompletionNote("");
    setMessage("");
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setPendingDeleteId(null);
    setDraft(blankDraft(currentUserId));
  }

  async function saveTask() {
    if (!careRecipientId || readOnly || busy) return;
    if (!draft.title.trim()) {
      setMessage("Add a task title first.");
      return;
    }

    const dueAt = localDateTimeToIso(draft.dueDate, draft.dueTime);
    if (!dueAt) {
      setMessage("Check the due date and time.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const input: CareTaskInput = {
        assignedTo: draft.assignedTo,
        category: draft.category,
        title: draft.title,
        details: draft.details,
        dueAt,
        timezone: detectedTimezone(),
        recurrence: draft.recurrence,
        priority: draft.priority,
        medicationId: draft.medicationId,
        appointmentId: draft.appointmentId,
        contactId: draft.contactId,
        communicationId: draft.communicationId,
      };

      if (editingId) {
        await updateCareTask(careRecipientId, editingId, input);
      } else {
        await createCareTask(careRecipientId, input);
      }

      const wasEditing = Boolean(editingId);
      closeForm();
      await refresh();
      setMessage(wasEditing ? "Care task updated." : "Care task added.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not save this task.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function finishTask(task: CareTask) {
    if (!careRecipientId || readOnly || busy) return;

    setBusy(true);
    setMessage("");
    try {
      await completeCareTask(careRecipientId, task.id, completionNote);
      setCompletingId(null);
      setCompletionNote("");
      await refresh();
      setMessage(
        task.recurrence === "none"
          ? "Task completed."
          : "Task completed. The next occurrence has been scheduled.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not complete this task.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function cancel(taskId: string) {
    if (!careRecipientId || readOnly || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await cancelCareTask(careRecipientId, taskId);
      await refresh();
      setMessage("Task moved to history.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not cancel this task.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function reopen(taskId: string) {
    if (!careRecipientId || readOnly || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await reopenCareTask(careRecipientId, taskId);
      await refresh();
      setMessage("Task reopened.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not reopen this task.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(taskId: string) {
    if (!careRecipientId || readOnly || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await deleteCareTask(careRecipientId, taskId);
      closeForm();
      await refresh();
      setMessage("Task deleted.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "We could not delete this task.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function respondToAssignment(
    assignment: CareTaskAssignment,
    response: "accepted" | "declined",
  ) {
    if (readOnly || busy) return;

    setBusy(true);
    setMessage("");
    try {
      await respondCareTaskAssignment({
        assignmentId: assignment.id,
        response,
      });
      await refresh();
      setMessage(
        response === "accepted"
          ? "Task assignment accepted."
          : "Task declined and returned to shared work.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not update this task assignment.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function claim(task: CareTask) {
    if (!careRecipientId || readOnly || busy || task.assignedTo) return;

    setBusy(true);
    setMessage("");
    try {
      await claimCareTask(careRecipientId, task.id);
      await refresh();
      setMessage("Task claimed. Your assignment is recorded as accepted.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not claim this shared task.",
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
          eyebrow="SHARED CARE PLAN"
          title="Choose a care profile first."
          body="Tasks and responsibilities live inside a specific care profile."
        />
      </Page>
    );
  }

  return (
    <Page>
      <Heading
        eyebrow="CARE TASKS + SHARED CARE PLAN"
        title="Make the next responsibility clear."
        body="Assign care tasks, keep follow-ups visible, and maintain a shared completion history without relying on memory or scattered messages."
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
          access · {counts.open} open task{counts.open === 1 ? "" : "s"}
        </Txt>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
        {[
          ["Overdue", counts.overdue, "alarm-outline"],
          ["Due today", counts.dueToday, "today-outline"],
          ["My open tasks", counts.mine, "person-outline"],
        ].map(([label, value, icon]) => (
          <Card
            key={String(label)}
            style={{ flex: 1, minWidth: 108, padding: 15 }}
          >
            <Icon name={String(icon)} size={20} />
            <Text style={[S.h2, { fontSize: 22 }]}>{String(value)}</Text>
            <Txt style={S.small}>{String(label)}</Txt>
          </Card>
        ))}
      </View>

      {Boolean(message) && (
        <Card>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {readOnly && (
        <Card style={{ backgroundColor: C.lavender }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>
            You can see the shared care plan and completion history. Only the
            Owner or a Caregiver can assign, edit, complete, or cancel tasks.
          </Txt>
        </Card>
      )}

      {!readOnly && !formOpen && (
        <Button title="Add care task" icon="add-circle-outline" onPress={openAdd} />
      )}

      {formOpen && !readOnly && (
        <>
          <Section title={editingId ? "Edit care task" : "Add care task"} />
          <Card>
            <Text style={S.h3}>Task category</Text>
            <Picker
              values={careTaskCategories}
              value={draft.category}
              labels={careTaskCategoryLabels}
              disabled={busy}
              onChange={changeCategory}
            />

            <Field
              label="Task title"
              value={draft.title}
              onChange={(title) =>
                setDraft((current) => ({ ...current, title }))
              }
            />
            <Field
              label="Instructions or context"
              value={draft.details}
              onChange={(details) =>
                setDraft((current) => ({ ...current, details }))
              }
              multiline
            />

            <Text style={S.h3}>Assign to</Text>
            <SelectCard
              title="Unassigned / shared responsibility"
              subtitle="Any Owner or Caregiver can pick this up."
              selected={draft.assignedTo === null}
              disabled={busy}
              onPress={() =>
                setDraft((current) => ({ ...current, assignedTo: null }))
              }
            />
            {assignableMembers.map((member) => (
              <SelectCard
                key={member.userId}
                title={
                  member.isCurrentUser
                    ? `${member.displayName || "Me"} · Me`
                    : member.displayName || "Caregiver"
                }
                subtitle={
                  member.role === "owner" ? "Care owner" : "Caregiver"
                }
                selected={draft.assignedTo === member.userId}
                disabled={busy}
                onPress={() =>
                  setDraft((current) => ({
                    ...current,
                    assignedTo: member.userId,
                  }))
                }
              />
            ))}

            <Field
              label="Due date (YYYY-MM-DD)"
              value={draft.dueDate}
              onChange={(dueDate) =>
                setDraft((current) => ({ ...current, dueDate }))
              }
            />
            <Field
              label="Due time (HH:MM, 24-hour)"
              value={draft.dueTime}
              onChange={(dueTime) =>
                setDraft((current) => ({ ...current, dueTime }))
              }
            />

            <Text style={S.h3}>Repeat</Text>
            <Picker
              values={careTaskRecurrences}
              value={draft.recurrence}
              labels={careTaskRecurrenceLabels}
              disabled={busy}
              onChange={(recurrence) =>
                setDraft((current) => ({ ...current, recurrence }))
              }
            />

            <Text style={S.h3}>Priority</Text>
            <Picker
              values={careTaskPriorities}
              value={draft.priority}
              labels={careTaskPriorityLabels}
              disabled={busy}
              onChange={(priority) =>
                setDraft((current) => ({ ...current, priority }))
              }
            />

            {draft.category === "medication" && (
              <>
                <Text style={S.h3}>Linked medication (optional)</Text>
                <SelectCard
                  title="No linked medication"
                  selected={draft.medicationId === null}
                  disabled={busy}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      medicationId: null,
                    }))
                  }
                />
                {state.medications.map((medication) => (
                  <SelectCard
                    key={medication.id}
                    title={medication.name}
                    subtitle={medication.instructions}
                    selected={draft.medicationId === medication.id}
                    disabled={busy}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        medicationId: medication.id,
                      }))
                    }
                  />
                ))}
              </>
            )}

            {draft.category === "appointment" && (
              <>
                <Text style={S.h3}>Linked appointment (optional)</Text>
                <SelectCard
                  title="No linked appointment"
                  selected={draft.appointmentId === null}
                  disabled={busy}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      appointmentId: null,
                    }))
                  }
                />
                {state.appointmentId ? (
                  <SelectCard
                    title={state.appointment.title || "Next appointment"}
                    subtitle={[
                      state.appointment.date,
                      state.appointment.time,
                      state.appointment.location,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                    selected={draft.appointmentId === state.appointmentId}
                    disabled={busy}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        appointmentId: state.appointmentId,
                      }))
                    }
                  />
                ) : (
                  <Txt style={S.small}>
                    Save appointment details first if you want this task linked
                    to the visit record.
                  </Txt>
                )}
              </>
            )}

            {(draft.category === "provider" ||
              draft.category === "insurance") && (
              <>
                <Text style={S.h3}>Linked care contact (optional)</Text>
                <SelectCard
                  title="No linked provider"
                  selected={draft.contactId === null}
                  disabled={busy}
                  onPress={() =>
                    setDraft((current) => ({ ...current, contactId: null }))
                  }
                />
                {contacts
                  .filter(
                    (contact) =>
                      draft.category !== "insurance" ||
                      contact.category === "insurance",
                  )
                  .map((contact) => (
                    <SelectCard
                      key={contact.id}
                      title={contact.providerName}
                      subtitle={[
                        careContactCategoryLabels[contact.category],
                        contact.specialty,
                        contact.organizationName,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      selected={draft.contactId === contact.id}
                      disabled={busy}
                      onPress={() =>
                        setDraft((current) => ({
                          ...current,
                          contactId: contact.id,
                        }))
                      }
                    />
                  ))}
              </>
            )}

            {draft.category === "communication_follow_up" && (
              <>
                <Text style={S.h3}>Linked communication (optional)</Text>
                <SelectCard
                  title="No linked communication"
                  selected={draft.communicationId === null}
                  disabled={busy}
                  onPress={() =>
                    setDraft((current) => ({
                      ...current,
                      communicationId: null,
                    }))
                  }
                />
                {communications.slice(0, 25).map((communication) => (
                  <SelectCard
                    key={communication.id}
                    title={communication.summary}
                    subtitle={`${careCommunicationTypeLabels[
                      communication.communicationType
                    ]} · ${new Date(communication.occurredAt).toLocaleString()}`}
                    selected={draft.communicationId === communication.id}
                    disabled={busy}
                    onPress={() =>
                      setDraft((current) => ({
                        ...current,
                        communicationId: communication.id,
                      }))
                    }
                  />
                ))}
              </>
            )}

            <Button
              title={editingId ? "Save task changes" : "Add to shared care plan"}
              icon="checkmark-circle-outline"
              disabled={busy}
              onPress={() => void saveTask()}
            />
            <Button title="Cancel" secondary disabled={busy} onPress={closeForm} />

            {editingId && (
              <>
                <Button
                  title={
                    pendingDeleteId === editingId
                      ? "Cancel delete"
                      : "Delete this task"
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
                      Permanently delete this task and its completion history?
                    </Text>
                    <Txt>
                      Use Cancel task instead if you want to keep it in care-plan
                      history.
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

      <Button
        title="Open today’s caregiver shift board"
        secondary
        icon="people-outline"
        onPress={() => n.navigate("CareShiftBoard")}
      />

      <Section title="Shared care plan" action="Refresh" onPress={() => void refresh()} />

      <View style={[S.input, S.row]}>
        <Icon name="search-outline" size={20} />
        <TextInput
          accessibilityLabel="Search care tasks"
          placeholder="Search tasks, providers, medications…"
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
        {(Object.keys(filterLabels) as TaskFilter[]).map((item) => (
          <Pressable
            key={item}
            accessibilityRole="radio"
            accessibilityState={{ selected: filter === item }}
            onPress={() => setFilter(item)}
            style={[
              S.pill,
              {
                minHeight: 40,
                justifyContent: "center",
                paddingHorizontal: 13,
                backgroundColor: filter === item ? C.purple : C.lavender,
              },
            ]}
          >
            <Text
              style={[
                S.h3,
                {
                  fontSize: 11,
                  color: filter === item ? C.white : C.deep,
                },
              ]}
            >
              {filterLabels[item]}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <Card>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading shared care tasks…</Txt>
        </Card>
      ) : visibleTasks.length ? (
        visibleTasks.map((task) => {
          const status = careTaskDisplayStatus(task);
          const assignee = task.assignedTo
            ? memberById.get(task.assignedTo)
            : null;
          const assignment = latestAssignmentByTask.get(task.id);
          const pendingMine = pendingAssignmentForUser(
            assignment,
            currentUserId,
          );
          const contact = task.contactId
            ? contactsById.get(task.contactId)
            : null;
          const communication = task.communicationId
            ? communicationsById.get(task.communicationId)
            : null;
          const medication = task.medicationId
            ? state.medications.find((item) => item.id === task.medicationId)
            : null;

          return (
            <Card
              key={task.id}
              style={{
                borderColor: status === "overdue" ? "#E8BDC3" : C.line,
                backgroundColor: status === "overdue" ? "#FFF9F8" : C.white,
              }}
            >
              <View style={S.between}>
                <View style={{ flex: 1, gap: 7 }}>
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
                        { backgroundColor: statusBackground(status) },
                      ]}
                    >
                      <Text
                        style={[
                          S.small,
                          {
                            color: status === "overdue" ? C.rose : C.deep,
                            fontFamily: "DMSans_600SemiBold",
                          },
                        ]}
                      >
                        {careTaskDisplayStatusLabel(status)}
                      </Text>
                    </View>
                    <View
                      style={[
                        S.pill,
                        { backgroundColor: priorityBackground(task.priority) },
                      ]}
                    >
                      <Text style={[S.small, { color: C.deep }]}>
                        {careTaskPriorityLabels[task.priority]}
                      </Text>
                    </View>
                  </View>
                  <Text style={S.h2}>{task.title}</Text>
                </View>

                {!readOnly && task.status === "open" && !pendingMine && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Edit care task"
                    onPress={() => openEdit(task)}
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

              {Boolean(task.details) && <Txt>{task.details}</Txt>}

              <Txt style={S.small}>
                Due {new Date(task.dueAt).toLocaleString()} ·{" "}
                {careTaskRecurrenceLabels[task.recurrence]}
              </Txt>
              <Txt style={S.small}>
                {careTaskCategoryLabels[task.category]} · Assigned to{" "}
                {assignee
                  ? assignee.isCurrentUser
                    ? `${assignee.displayName || "Me"} (me)`
                    : assignee.displayName || "Caregiver"
                  : "shared care team"}
              </Txt>
              <View
                style={[
                  S.pill,
                  {
                    alignSelf: "flex-start",
                    backgroundColor:
                      assignment?.status === "pending"
                        ? "#FFF1E5"
                        : assignment?.status === "accepted"
                          ? "#EAF4EF"
                          : C.lavender,
                  },
                ]}
              >
                <Text style={[S.small, { color: C.deep }]}>
                  {taskAssignmentLabel(assignment, task.assignedTo)}
                </Text>
              </View>

              {!readOnly &&
                task.status === "open" &&
                pendingMine &&
                assignment && (
                  <Card style={{ backgroundColor: "#FFF9F2" }}>
                    <Text style={S.h3}>This task was assigned to you.</Text>
                    <Txt style={S.small}>
                      Accept it to confirm ownership, or decline it to return the
                      task to shared care work for reassignment.
                    </Txt>
                    <Button
                      title="Accept assignment"
                      icon="checkmark-circle-outline"
                      disabled={busy}
                      onPress={() =>
                        void respondToAssignment(assignment, "accepted")
                      }
                    />
                    <Button
                      title="Decline & return to shared work"
                      secondary
                      disabled={busy}
                      onPress={() =>
                        void respondToAssignment(assignment, "declined")
                      }
                    />
                  </Card>
                )}

              {!readOnly &&
                task.status === "open" &&
                !task.assignedTo && (
                  <Button
                    title="Claim this shared task"
                    secondary
                    icon="hand-left-outline"
                    disabled={busy}
                    onPress={() => void claim(task)}
                  />
                )}

              {medication && (
                <Card style={{ backgroundColor: "#F8F4F9", padding: 14 }}>
                  <Text style={S.eyebrow}>LINKED MEDICATION</Text>
                  <Text style={S.h3}>{medication.name}</Text>
                  <Txt style={S.small}>{medication.instructions}</Txt>
                </Card>
              )}

              {task.appointmentId && (
                <Card style={{ backgroundColor: "#F8F4F9", padding: 14 }}>
                  <Text style={S.eyebrow}>LINKED APPOINTMENT</Text>
                  <Text style={S.h3}>{state.appointment.title}</Text>
                  <Txt style={S.small}>
                    {[state.appointment.date, state.appointment.time]
                      .filter(Boolean)
                      .join(" · ") || "Visit details saved"}
                  </Txt>
                </Card>
              )}

              {contact && (
                <Card style={{ backgroundColor: "#F8F4F9", padding: 14 }}>
                  <Text style={S.eyebrow}>LINKED CARE CONTACT</Text>
                  <Text style={S.h3}>{contact.providerName}</Text>
                  <Txt style={S.small}>
                    {[
                      careContactCategoryLabels[contact.category],
                      contact.specialty,
                      contact.organizationName,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Txt>
                </Card>
              )}

              {communication && (
                <Card style={{ backgroundColor: "#F8F4F9", padding: 14 }}>
                  <Text style={S.eyebrow}>LINKED COMMUNICATION</Text>
                  <Text style={S.h3}>{communication.summary}</Text>
                  <Txt style={S.small}>
                    {careCommunicationTypeLabels[
                      communication.communicationType
                    ]}{" · "}
                    {new Date(communication.occurredAt).toLocaleString()}
                  </Txt>
                </Card>
              )}

              {contact && (contact.phone || contact.email) && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {Boolean(contact.phone) && (
                    <SmallAction
                      title="Call provider"
                      icon="call-outline"
                      onPress={() => void call(contact.phone)}
                    />
                  )}
                  {Boolean(contact.email) && (
                    <SmallAction
                      title="Email provider"
                      icon="mail-outline"
                      onPress={() => void email(contact.email)}
                    />
                  )}
                </View>
              )}

              {!readOnly && task.status === "open" && !pendingMine && (
                <>
                  {completingId === task.id ? (
                    <Card style={{ backgroundColor: C.lavender }}>
                      <Text style={S.h3}>Complete this occurrence</Text>
                      <Field
                        label="Completion note (optional)"
                        value={completionNote}
                        onChange={(value) =>
                          setCompletionNote(value.slice(0, 1000))
                        }
                        multiline
                      />
                      <Txt style={S.small}>
                        {task.recurrence === "none"
                          ? "This closes the task."
                          : "This records the completion and automatically schedules the next occurrence."}
                      </Txt>
                      <Button
                        title="Confirm completion"
                        disabled={busy}
                        onPress={() => void finishTask(task)}
                      />
                      <Button
                        title="Cancel"
                        secondary
                        disabled={busy}
                        onPress={() => {
                          setCompletingId(null);
                          setCompletionNote("");
                        }}
                      />
                    </Card>
                  ) : (
                    <Button
                      title={
                        task.recurrence === "none"
                          ? "Mark complete"
                          : "Complete this occurrence"
                      }
                      icon="checkmark-circle-outline"
                      disabled={busy}
                      onPress={() => {
                        setCompletingId(task.id);
                        setCompletionNote("");
                      }}
                    />
                  )}
                  <Button
                    title="Cancel task"
                    secondary
                    disabled={busy}
                    onPress={() => void cancel(task.id)}
                  />
                </>
              )}

              {!readOnly &&
                (task.status === "completed" || task.status === "cancelled") && (
                  <Button
                    title="Reopen task"
                    secondary
                    disabled={busy}
                    onPress={() => void reopen(task.id)}
                  />
                )}

              {task.lastCompletedAt && (
                <Txt style={S.small}>
                  Last completed {new Date(task.lastCompletedAt).toLocaleString()}
                </Txt>
              )}
            </Card>
          );
        })
      ) : (
        <Card>
          <Icon name="checkbox-outline" size={30} />
          <Text style={S.h3}>
            {tasks.length
              ? "No care tasks match these filters."
              : "No shared care tasks yet."}
          </Text>
          <Txt>
            {tasks.length
              ? "Try another filter or search."
              : readOnly
                ? "The Owner or a Caregiver can add shared responsibilities here."
                : "Add the next responsibility, assign it, and keep the whole care team clear on what comes next."}
          </Txt>
          {!readOnly && !tasks.length && (
            <Button title="Add first care task" onPress={openAdd} />
          )}
        </Card>
      )}

      <Section title="Recent completion history" />
      {completions.length ? (
        completions.slice(0, 30).map((completion) => {
          const task = tasksById.get(completion.taskId);
          const member = completion.completedBy
            ? memberById.get(completion.completedBy)
            : null;

          return (
            <Card key={completion.id}>
              <View style={S.row}>
                <Icon name="checkmark-circle-outline" />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={S.h3}>{task?.title || "Care task"}</Text>
                  <Txt style={S.small}>
                    Completed {new Date(completion.completedAt).toLocaleString()}
                    {" · "}
                    {member?.isCurrentUser
                      ? `${member.displayName || "Me"} (me)`
                      : member?.displayName || "Caregiver"}
                  </Txt>
                  {Boolean(completion.note) && <Txt>{completion.note}</Txt>}
                </View>
              </View>
            </Card>
          );
        })
      ) : (
        <Card>
          <Txt>No task completions recorded yet.</Txt>
        </Card>
      )}

      <Card style={{ backgroundColor: C.lavender }}>
        <Text style={S.h3}>Shared responsibility, not medical instruction.</Text>
        <Txt>
          Care tasks help the family coordinate responsibilities. Medication
          and clinical tasks should follow instructions from the healthcare
          team; this plan does not change prescriptions or clinical guidance.
        </Txt>
      </Card>
    </Page>
  );
}
