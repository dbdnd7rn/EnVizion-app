import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
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
import { addReminderToDeviceCalendar } from "../deviceCalendar";
import { loadCareAgendaData, type CareAgendaData } from "../careAgenda";
import {
  agendaByDay,
  agendaCategories,
  agendaCategoryLabels,
  agendaRange,
  buildAgendaEvents,
  isAgendaEventPast,
  nextAgendaEvent,
  visibleAgendaEvents,
  type AgendaCategory,
  type AgendaEvent,
  type AgendaView,
} from "../careAgendaHelpers";
import { loadCareTeam, type CareTeamRoster } from "../careTeam";
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

const agendaIcons: Record<AgendaCategory, string> = {
  appointment: "calendar-outline",
  task: "checkbox-outline",
  shift: "people-outline",
  reminder: "notifications-outline",
  medication: "medical-outline",
  follow_up: "chatbubbles-outline",
  handoff: "swap-horizontal-outline",
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

      {!inactive && (
        <Button
          title="Add next occurrence to device calendar"
          secondary
          icon="calendar-outline"
          disabled={busy}
          onPress={() =>
            void run(
              () => addReminderToDeviceCalendar(reminder),
              "Calendar window opened.",
            )
          }
        />
      )}

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

function HeroCalendarArt() {
  return (
    <Svg width={154} height={154} viewBox="0 0 160 160" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="heroCalendarTop" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#8B4BD8" />
          <Stop offset="1" stopColor="#6D2FC3" />
        </LinearGradient>
        <LinearGradient id="heroClock" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor="#A975F2" />
          <Stop offset="1" stopColor="#6E35C8" />
        </LinearGradient>
      </Defs>
      <Circle cx="82" cy="78" r="69" fill="#F1E9FF" />
      <Circle cx="126" cy="38" r="24" fill="#E7D9FF" opacity={0.9} />
      <Path d="M22 117C32 89 48 75 72 67C96 59 117 66 137 83C145 90 148 103 144 117C138 137 116 148 86 147C54 145 18 137 22 117Z" fill="#EDE5FF" />
      <G>
        <Rect x="33" y="34" width="92" height="92" rx="18" fill="#FFFFFF" stroke="#E2D8F6" strokeWidth="2" />
        <Path d="M33 52C33 42.06 41.06 34 51 34H107C116.94 34 125 42.06 125 52V61H33V52Z" fill="url(#heroCalendarTop)" />
        <Rect x="47" y="25" width="8" height="23" rx="4" fill="#7D49CA" />
        <Rect x="101" y="25" width="8" height="23" rx="4" fill="#7D49CA" />
        <Rect x="47" y="72" width="18" height="16" rx="4" fill="#F0EAFE" />
        <Rect x="70" y="72" width="18" height="16" rx="4" fill="#F0EAFE" />
        <Rect x="93" y="72" width="18" height="16" rx="4" fill="#A46CEE" />
        <Rect x="47" y="93" width="18" height="16" rx="4" fill="#F0EAFE" />
        <Rect x="70" y="93" width="18" height="16" rx="4" fill="#F0EAFE" />
        <Rect x="93" y="93" width="18" height="16" rx="4" fill="#F0EAFE" />
      </G>
      <Circle cx="118" cy="119" r="28" fill="#F5F1FF" />
      <Circle cx="118" cy="119" r="23" fill="url(#heroClock)" />
      <Line x1="118" y1="119" x2="118" y2="107" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" />
      <Line x1="118" y1="119" x2="127" y2="125" stroke="#FFFFFF" strokeWidth="3.6" strokeLinecap="round" />
      <Circle cx="118" cy="119" r="2.6" fill="#FFFFFF" />
    </Svg>
  );
}

function EmptyCalendarArt() {
  return (
    <Svg width={150} height={94} viewBox="0 0 160 100" accessibilityElementsHidden>
      <Circle cx="52" cy="48" r="25" fill="#F3ECFF" />
      <Circle cx="111" cy="49" r="31" fill="#EEE6FD" />
      <Circle cx="79" cy="36" r="34" fill="#F6F1FF" />
      <Rect x="58" y="24" width="55" height="54" rx="12" fill="#FFFFFF" stroke="#DDD1F3" strokeWidth="2" />
      <Rect x="58" y="24" width="55" height="15" rx="12" fill="#8350CB" />
      <Rect x="66" y="47" width="11" height="9" rx="2" fill="#E8DEFA" />
      <Rect x="81" y="47" width="11" height="9" rx="2" fill="#E8DEFA" />
      <Rect x="96" y="47" width="11" height="9" rx="2" fill="#B687EE" />
      <Rect x="66" y="60" width="11" height="9" rx="2" fill="#E8DEFA" />
      <Rect x="81" y="60" width="11" height="9" rx="2" fill="#E8DEFA" />
      <Circle cx="111" cy="72" r="20" fill="#7440C4" />
      <Path d="M102 72L109 79L121 65" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function StatTile({
  value,
  label,
  icon,
  background,
  iconBackground,
  iconColor,
}: {
  value: number;
  label: string;
  icon: string;
  background: string;
  iconBackground: string;
  iconColor: string;
}) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: 128,
        borderRadius: 20,
        padding: 12,
        backgroundColor: background,
        justifyContent: "space-between",
      }}
    >
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: iconBackground,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={icon} size={20} color={iconColor} />
      </View>
      <View style={{ gap: 2 }}>
        <Text style={[S.h2, { fontSize: 24, lineHeight: 27 }]}>{value}</Text>
        <Text style={[S.small, { color: C.ink, lineHeight: 16 }]} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </View>
  );
}

function QuickAddTile({
  title,
  icon,
  background,
  color,
  onPress,
}: {
  title: string;
  icon: string;
  background: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 0,
        minHeight: 112,
        borderRadius: 20,
        paddingHorizontal: 10,
        paddingVertical: 16,
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        backgroundColor: background,
        opacity: pressed ? 0.72 : 1,
        transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      <Icon name={icon} size={25} color={color} />
      <Text
        style={[
          S.h3,
          {
            fontSize: 12,
            lineHeight: 16,
            color,
            textAlign: "center",
          },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

function AgendaFilter({
  label,
  icon,
  selected,
  onPress,
}: {
  label: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        minWidth: 82,
        minHeight: 48,
        borderRadius: 24,
        paddingHorizontal: 10,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: selected ? C.purple : "#F6F2FB",
        borderWidth: selected ? 0 : 1,
        borderColor: "#ECE5F2",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Icon name={icon} size={17} color={selected ? C.white : C.deep} />
      <Text
        style={[
          S.h3,
          {
            fontSize: 11,
            lineHeight: 15,
            color: selected ? C.white : C.deep,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CareCalendarScreen() {
  const n = useNav();
  const { state } = useCare();
  const [items, setItems] = useState<CareReminder[]>([]);
  const [agendaData, setAgendaData] = useState<CareAgendaData>({
    appointments: [],
    tasks: [],
    shifts: [],
    handoffs: [],
    followUps: [],
  });
  const [roster, setRoster] = useState<CareTeamRoster | null>(null);
  const [agendaView, setAgendaView] = useState<AgendaView>("day");
  const [agendaOffset, setAgendaOffset] = useState(0);
  const [agendaFilters, setAgendaFilters] = useState<AgendaCategory[]>([
    ...agendaCategories,
  ]);
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
  const range = useMemo(
    () => agendaRange(agendaView, new Date(), agendaOffset),
    [agendaOffset, agendaView],
  );

  const refresh = useCallback(async () => {
    if (!careRecipientId) {
      setItems([]);
      setAgendaData({
        appointments: [],
        tasks: [],
        shifts: [],
        handoffs: [],
        followUps: [],
      });
      setRoster(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [reminders, agenda, team] = await Promise.all([
        loadCareReminders(careRecipientId),
        loadCareAgendaData({
          careRecipientId,
          rangeStartIso: range.startIso,
          rangeEndIso: range.endIso,
        }),
        loadCareTeam(careRecipientId),
      ]);
      setItems(reminders);
      setAgendaData(agenda);
      setRoster(team);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not load the care calendar.",
      );
    } finally {
      setLoading(false);
    }
  }, [careRecipientId, range.endIso, range.startIso]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!careRecipientId) return;

    const channel = supabase
      .channel(`care-agenda:${careRecipientId}`)
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
          table: "care_shifts",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_shift_handoffs",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "care_communications",
          filter: `care_recipient_id=eq.${careRecipientId}`,
        },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "appointments",
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
    () => new Map((roster?.members ?? []).map((member) => [member.userId, member])),
    [roster],
  );

  function caregiverName(userId: string | null) {
    if (!userId) return "Shared care team";
    const member = memberMap.get(userId);
    if (!member) return "Caregiver";
    return member.isCurrentUser
      ? `${member.displayName || "Me"} (me)`
      : member.displayName || "Caregiver";
  }

  const agendaEvents = useMemo(
    () =>
      buildAgendaEvents({
        data: agendaData,
        reminders: items,
        medications: state.medications,
        rangeStart: range.start,
        rangeEnd: range.end,
        caregiverName,
      }),
    [agendaData, items, memberMap, range.end, range.start, state.medications],
  );

  const visibleEvents = useMemo(
    () => visibleAgendaEvents(agendaEvents, agendaFilters),
    [agendaEvents, agendaFilters],
  );
  const groupedAgenda = useMemo(() => agendaByDay(visibleEvents), [visibleEvents]);
  const nextEvent = useMemo(
    () => nextAgendaEvent(visibleEvents),
    [visibleEvents],
  );

  function toggleAgendaFilter(category: AgendaCategory) {
    setAgendaFilters((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  function openAgendaEvent(event: AgendaEvent) {
    if (event.category === "appointment") n.navigate("Appointments");
    else if (event.category === "task") n.navigate("CareTasks");
    else if (event.category === "shift") n.navigate("CareSchedule");
    else if (event.category === "medication") n.navigate("Medications");
    else if (event.category === "follow_up") n.navigate("CareCommunicationLog");
    else if (event.category === "handoff") n.navigate("CareShiftBoard");
  }

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

const categoryCounts = useMemo(
    () => ({
      appointment: agendaEvents.filter((event) => event.category === "appointment").length,
      task: agendaEvents.filter((event) => event.category === "task").length,
      shift: agendaEvents.filter((event) => event.category === "shift").length,
      reminder: agendaEvents.filter((event) => event.category === "reminder").length,
    }),
    [agendaEvents],
  );

  const dateTitle =
    agendaView === "day"
      ? range.start.toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      : range.label;

  const primaryFilters: Array<{
    category: AgendaCategory;
    label: string;
    icon: string;
  }> = [
    { category: "appointment", label: "Appointments", icon: "calendar-outline" },
    { category: "task", label: "Tasks", icon: "checkbox-outline" },
    { category: "shift", label: "Caregiver shifts", icon: "people-outline" },
    { category: "reminder", label: "Reminders", icon: "notifications-outline" },
  ];

  return (
    <Page>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => n.goBack()}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F7F2FC",
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Icon name="chevron-back-outline" size={24} color={C.ink} />
        </Pressable>

        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={[S.h2, { flex: 1, fontSize: 20, lineHeight: 26 }]}
        >
          Family care calendar & agenda
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open help"
          onPress={() => n.navigate("Guide")}
          style={({ pressed }) => ({
            width: 48,
            height: 48,
            borderRadius: 24,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#F7F2FC",
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Icon name="help-circle-outline" size={25} color={C.ink} />
        </Pressable>
      </View>

      <View
        style={{
          minHeight: 255,
          borderRadius: 30,
          overflow: "hidden",
          padding: 22,
          paddingRight: 150,
          justifyContent: "center",
          borderWidth: 1,
          borderColor: "#EEE7FB",
          shadowColor: "#5B3470",
          shadowOpacity: 0.07,
          shadowRadius: 22,
          shadowOffset: { width: 0, height: 10 },
          elevation: 3,
        }}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 400 250"
          preserveAspectRatio="none"
          style={{ position: "absolute", inset: 0 }}
          accessibilityElementsHidden
        >
          <Defs>
            <LinearGradient id="heroBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FBF8FF" />
              <Stop offset="0.48" stopColor="#F4EEFF" />
              <Stop offset="1" stopColor="#EEE4FB" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="400" height="250" rx="30" fill="url(#heroBg)" />
          <Circle cx="346" cy="52" r="78" fill="#F8F4FF" opacity={0.8} />
          <Circle cx="360" cy="205" r="92" fill="#EADDFC" opacity={0.62} />
        </Svg>

        <View style={{ gap: 11 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="calendar-outline" size={20} color="#8A3DC8" />
            <Text style={[S.eyebrow, { color: "#8A3DC8", letterSpacing: 1.8 }]}>
              FAMILY CARE CALENDAR & AGENDA
            </Text>
          </View>

          <Text
            style={[
              S.title,
              {
                fontSize: 34,
                lineHeight: 38,
                letterSpacing: -1.1,
              },
            ]}
          >
            See the whole care day{" "}
            <Text style={{ color: "#8B35D3" }}>in one place.</Text>
          </Text>

          <Txt style={{ maxWidth: 250, color: "#66627D", lineHeight: 21 }}>
            Appointments, caregiver shifts, tasks, reminders, and medication times —
            all in one coordinated timeline.
          </Txt>

          <View
            style={{
              alignSelf: "flex-start",
              marginTop: 2,
              backgroundColor: "#FFFFFFB8",
              borderRadius: 999,
              paddingHorizontal: 11,
              paddingVertical: 6,
              borderWidth: 1,
              borderColor: "#E9E0F5",
            }}
          >
            <Text style={[S.small, { color: C.deep, fontFamily: "DMSans_600SemiBold" }]}>
              {state.careRecipientName || "Care profile"}
            </Text>
          </View>
        </View>

        <View style={{ position: "absolute", right: 6, top: 45 }}>
          <HeroCalendarArt />
        </View>
      </View>

      <View
        style={{
          flexDirection: "row",
          padding: 4,
          backgroundColor: "#F5F1F8",
          borderRadius: 29,
          gap: 4,
        }}
      >
        {(["day", "week"] as const).map((view) => {
          const selected = agendaView === view;
          return (
            <Pressable
              key={view}
              accessibilityRole="button"
              onPress={() => {
                setAgendaView(view);
                setAgendaOffset(0);
              }}
              style={({ pressed }) => ({
                flex: 1,
                minHeight: 54,
                borderRadius: 27,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                backgroundColor: selected ? C.purple : "transparent",
                opacity: pressed ? 0.72 : 1,
              })}
            >
              <Icon
                name={view === "day" ? "calendar-clear-outline" : "calendar-outline"}
                color={selected ? C.white : "#6C6679"}
                size={20}
              />
              <Text
                style={[
                  S.h3,
                  {
                    fontSize: 15,
                    color: selected ? C.white : "#6C6679",
                  },
                ]}
              >
                {view === "day" ? "Day" : "Week"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          minHeight: 94,
          borderRadius: 24,
          borderWidth: 1,
          borderColor: "#EAE4EF",
          backgroundColor: C.white,
          paddingHorizontal: 14,
          flexDirection: "row",
          alignItems: "center",
          shadowColor: "#382840",
          shadowOpacity: 0.04,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 7 },
          elevation: 2,
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => setAgendaOffset((value) => value - 1)}
          style={{ width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F4FC" }}
        >
          <Icon name="chevron-back-outline" size={23} />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={agendaOffset === 0 ? "Current date" : "Return to current date"}
          onPress={() => setAgendaOffset(0)}
          style={{ flex: 1, alignItems: "center", gap: 3, paddingHorizontal: 8 }}
        >
          <Text style={[S.h3, { fontSize: 17, textAlign: "center" }]} numberOfLines={1}>
            {dateTitle}
          </Text>
          <Txt style={[S.small, { textAlign: "center" }]}>
            {agendaView === "day" ? "Daily timeline" : "Monday–Sunday overview"}
          </Txt>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setAgendaOffset((value) => value + 1)}
          style={{ width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "#F8F4FC" }}
        >
          <Icon name="chevron-forward-outline" size={23} />
        </Pressable>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <StatTile
          value={categoryCounts.appointment}
          label="Appointments"
          icon="calendar-outline"
          background="#EEF6FF"
          iconBackground="#DCEEFF"
          iconColor="#3A7ED7"
        />
        <StatTile
          value={categoryCounts.task}
          label="Tasks"
          icon="checkbox-outline"
          background="#F5EEFF"
          iconBackground="#E9DAFF"
          iconColor="#833BC4"
        />
        <StatTile
          value={categoryCounts.shift}
          label="Caregiver shifts"
          icon="people-outline"
          background="#ECFAF4"
          iconBackground="#D8F5E8"
          iconColor="#149B74"
        />
        <StatTile
          value={categoryCounts.reminder}
          label="Reminders"
          icon="notifications-outline"
          background="#FFF4EA"
          iconBackground="#FFE5D0"
          iconColor="#D86324"
        />
      </View>

      <View style={{ gap: 12 }}>
        <View style={S.between}>
          <Text accessibilityRole="header" style={[S.h2, { fontSize: 24 }]}>
            {agendaView === "day" ? "Today's timeline" : "This week's timeline"}
          </Text>
          {!readOnly && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowForm(true)}
              style={({ pressed }) => ({
                minHeight: 42,
                paddingHorizontal: 15,
                borderRadius: 21,
                borderWidth: 1.5,
                borderColor: "#8A3CC7",
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                opacity: pressed ? 0.65 : 1,
              })}
            >
              <Icon name="add-outline" size={18} color="#7E34B8" />
              <Text style={[S.h3, { fontSize: 12, color: "#7E34B8" }]}>Add new</Text>
            </Pressable>
          )}
        </View>

        {loading && !visibleEvents.length ? (
          <View
            style={{
              minHeight: 250,
              borderRadius: 26,
              borderWidth: 1,
              borderColor: "#EAE4EF",
              backgroundColor: C.white,
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              padding: 24,
            }}
          >
            <ActivityIndicator color={C.purple} />
            <Txt>Bringing the care timeline together…</Txt>
          </View>
        ) : !visibleEvents.length ? (
          <View
            style={{
              minHeight: 300,
              borderRadius: 26,
              borderWidth: 1,
              borderColor: "#EAE4EF",
              backgroundColor: C.white,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 26,
              paddingVertical: 28,
              shadowColor: "#382840",
              shadowOpacity: 0.035,
              shadowRadius: 15,
              shadowOffset: { width: 0, height: 8 },
              elevation: 1,
            }}
          >
            <EmptyCalendarArt />
            <Text style={[S.h2, { fontSize: 20, textAlign: "center", marginTop: 8 }]}>
              Nothing scheduled for this {agendaView === "day" ? "day" : "week"}
            </Text>
            <Txt style={{ textAlign: "center", marginTop: 6, maxWidth: 315 }}>
              Your care {agendaView === "day" ? "day" : "week"} is clear. Add an appointment,
              task, shift or reminder to get started.
            </Txt>
            {!readOnly && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowForm(true)}
                style={({ pressed }) => ({
                  minHeight: 50,
                  marginTop: 18,
                  borderRadius: 25,
                  paddingHorizontal: 24,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: C.purple,
                  opacity: pressed ? 0.72 : 1,
                })}
              >
                <Icon name="add-outline" size={20} color={C.white} />
                <Text style={[S.h3, { fontSize: 14, color: C.white }]}>Add to today</Text>
              </Pressable>
            )}
          </View>
        ) : (
          Array.from(groupedAgenda.entries()).map(([dayKey, events]) => (
            <View key={dayKey} style={{ gap: 10 }}>
              {agendaView === "week" && (
                <Text style={[S.h3, { marginTop: 5, color: C.deep }]}>
                  {new Date(dayKey + "T12:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
              )}

              {events.map((event) => {
                const past = isAgendaEventPast(event);
                return (
                  <Pressable
                    key={event.id}
                    accessibilityRole={event.category === "reminder" ? undefined : "button"}
                    onPress={event.category === "reminder" ? undefined : () => openAgendaEvent(event)}
                    style={({ pressed }) => ({
                      borderRadius: 23,
                      borderWidth: 1,
                      borderColor: "#EAE4EF",
                      backgroundColor: event.completed ? "#F7F4F8" : C.white,
                      padding: 16,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 13,
                      opacity: event.completed ? 0.75 : past ? 0.82 : pressed ? 0.72 : 1,
                    })}
                  >
                    <View
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 16,
                        backgroundColor: "#F2EAF8",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon name={agendaIcons[event.category]} size={22} />
                    </View>

                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={S.h3}>{event.title}</Text>
                      <Txt style={S.small}>
                        {event.allDay
                          ? "Date recorded · time not set"
                          : new Date(event.startsAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                        {event.endsAt
                          ? " – " +
                            new Date(event.endsAt).toLocaleTimeString([], {
                              hour: "numeric",
                              minute: "2-digit",
                            })
                          : ""}{" "}
                        · {event.sourceLabel}
                      </Txt>
                      {Boolean(event.subtitle) && <Txt style={S.small}>{event.subtitle}</Txt>}
                    </View>

                    {event.category !== "reminder" && (
                      <Icon name="chevron-forward-outline" size={18} color="#A99DAF" />
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </View>

      {!readOnly && (
        <View style={{ gap: 12 }}>
          <Text accessibilityRole="header" style={[S.h2, { fontSize: 24 }]}>
            Quick add
          </Text>

          <View style={{ flexDirection: "row", gap: 8 }}>
            <QuickAddTile
              title="Appointment prep"
              icon="calendar-outline"
              background="#EEF6FF"
              color="#2D72CC"
              onPress={appointmentPreset}
            />
            <QuickAddTile
              title="Transition task"
              icon="home-outline"
              background="#F5EEFF"
              color="#7431B9"
              onPress={transitionPreset}
            />
            <QuickAddTile
              title="Medication record"
              icon="medical-outline"
              background="#ECFAF4"
              color="#128B6D"
              onPress={() => medicationPreset()}
            />
            <QuickAddTile
              title="Custom reminder"
              icon="notifications-outline"
              background="#FFF4EA"
              color="#C75D27"
              onPress={() => setShowForm(true)}
            />
          </View>
        </View>
      )}

      <View
        style={{
          flexDirection: "row",
          gap: 6,
          padding: 5,
          borderRadius: 29,
          backgroundColor: "#FAF8FC",
          borderWidth: 1,
          borderColor: "#ECE6F1",
        }}
      >
        {primaryFilters.map((filter) => (
          <AgendaFilter
            key={filter.category}
            label={filter.label}
            icon={filter.icon}
            selected={agendaFilters.includes(filter.category)}
            onPress={() => toggleAgendaFilter(filter.category)}
          />
        ))}
      </View>

      {showForm && !readOnly && (
        <Card
          style={{
            borderRadius: 28,
            padding: 22,
            backgroundColor: "#FBF8FF",
            borderColor: "#E8DDF4",
          }}
        >
          <View style={S.between}>
            <View style={{ gap: 3 }}>
              <Text style={[S.h2, { fontSize: 22 }]}>
                {editingId ? "Edit reminder" : "New reminder"}
              </Text>
              <Txt style={S.small}>Add it to the shared care calendar.</Txt>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close reminder form"
              onPress={resetForm}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: C.white }}
            >
              <Icon name="close-outline" size={22} />
            </Pressable>
          </View>

          <Field label="Title" value={title} onChange={setTitle} />
          <Field label="Note (optional)" value={note} onChange={setNote} multiline />

          <Text style={S.h3}>Reminder type</Text>
          <Choice
            values={["general", "appointment", "transition", "medication_record"] as const}
            value={type}
            labels={typeLabels}
            disabled={busy}
            onChange={setType}
          />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Time (24-hour)" value={time} onChange={setTime} />
            </View>
          </View>

          <Txt style={S.small}>Timezone: {timezone}</Txt>

          <Text style={S.h3}>Repeat</Text>
          <Choice
            values={["none", "daily", "weekly"] as const}
            value={recurrence}
            labels={{ none: "One time", daily: "Daily", weekly: "Weekly" }}
            disabled={busy}
            onChange={setRecurrence}
          />

          <Text style={S.h3}>Who gets the in-app notification?</Text>
          <Choice
            values={["creator", "care_team"] as const}
            value={notifyScope}
            labels={{ creator: "Only me", care_team: "Care team" }}
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

      <View style={{ gap: 12 }}>
        <Section title="What happens next?" />
        {nextEvent ? (
          <Card style={{ backgroundColor: "#F0F8F4", borderRadius: 26 }}>
            <View style={S.row}>
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  backgroundColor: "#DFF2E9",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name={agendaIcons[nextEvent.category]} size={23} color="#268468" />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[S.eyebrow, { color: "#268468" }]}>
                  {nextEvent.sourceLabel.toUpperCase()}
                </Text>
                <Text style={S.h3}>{nextEvent.title}</Text>
                <Txt style={S.small}>{new Date(nextEvent.startsAt).toLocaleString()}</Txt>
              </View>
            </View>
            {nextEvent.category !== "reminder" && (
              <Button title="Open details" secondary onPress={() => openAgendaEvent(nextEvent)} />
            )}
          </Card>
        ) : (
          <Card style={{ borderRadius: 26 }}>
            <Icon name="checkmark-circle-outline" size={28} />
            <Text style={S.h3}>Nothing else is scheduled in this view.</Text>
            <Txt>Move forward or change the filters to see more of the care plan.</Txt>
          </Card>
        )}
      </View>

      <Card style={{ backgroundColor: "#F5EEFB", borderWidth: 0, borderRadius: 28 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View
            style={{
              width: 42,
              height: 42,
              borderRadius: 15,
              backgroundColor: "#E9DDF5",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="medical-outline" size={21} />
          </View>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={S.h3}>Medication times are copied from the caregiver list.</Text>
            <Txt style={S.small}>
              They are shown for organization only and are not prescribing instructions,
              dose recommendations, or confirmation that medication should be taken.
              Follow the pharmacy label and the healthcare team’s plan.
            </Txt>
          </View>
        </View>
      </Card>

      {readOnly && (
        <Card style={{ backgroundColor: "#F5EEFB", borderWidth: 0, borderRadius: 28 }}>
          <Icon name="eye-outline" />
          <Text style={S.h3}>Viewer access is read-only.</Text>
          <Txt>
            You can see shared reminders, but only the Owner or a Caregiver can create,
            snooze, edit, complete, or dismiss them.
          </Txt>
        </Card>
      )}

      {Boolean(message) && (
        <Card style={{ borderRadius: 24 }}>
          <Text accessibilityRole="alert" style={S.body}>
            {message}
          </Text>
        </Card>
      )}

      {state.medications.length > 0 && !readOnly && (
        <Card style={{ borderRadius: 26 }}>
          <Text style={S.h3}>Medication record prompts</Text>
          <Txt style={S.small}>
            These prompts are for record-keeping only. They do not tell anyone when or
            how much medication to take.
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
                <Text style={[S.h3, { fontSize: 11 }]}>{medication.name}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      <Section title="Upcoming & due" action="Refresh" onPress={() => void refresh()} />

      {loading && !items.length ? (
        <Card style={{ borderRadius: 26 }}>
          <ActivityIndicator color={C.purple} />
          <Txt>Loading care calendar…</Txt>
        </Card>
      ) : !active.length ? (
        <Card style={{ borderRadius: 26 }}>
          <Icon name="calendar-clear-outline" size={30} />
          <Text style={S.h3}>Nothing scheduled yet.</Text>
          <Txt>Add a reminder when there is something worth bringing back into view later.</Txt>
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
        <Card style={{ borderRadius: 26 }}>
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

      <Pressable
        accessibilityRole="button"
        onPress={() => n.navigate("CareCoordinationInbox")}
        style={({ pressed }) => ({
          minHeight: 58,
          borderRadius: 29,
          backgroundColor: "#F2E9FA",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Icon name="warning-outline" size={20} />
        <Text style={[S.h3, { fontSize: 14, color: C.purple }]}>
          Check what needs coordination
        </Text>
      </Pressable>

      <Card style={{ backgroundColor: "#F5EEFB", borderWidth: 0, borderRadius: 28 }}>
        <Text style={S.h3}>About reminder notifications</Text>
        <Txt>
          EnVizion checks due reminders approximately every five minutes and places
          them in the in-app notification center. Reminders are not emergency
          monitoring, medication orders, or confirmation that a care task was completed.
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
