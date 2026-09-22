import { supabase } from "./supabase";

export type AgendaAppointment = {
  id: string;
  title: string;
  startsAt: string | null;
  appointmentDate: string | null;
  appointmentTime: string | null;
  location: string;
  notes: string;
};

export type AgendaTask = {
  id: string;
  title: string;
  details: string;
  dueAt: string;
  priority: string;
  status: string;
  assignedTo: string | null;
};

export type AgendaShift = {
  id: string;
  caregiverId: string;
  label: string;
  startsAt: string;
  endsAt: string;
  status: string;
};

export type AgendaHandoff = {
  id: string;
  createdBy: string | null;
  handoffTo: string | null;
  shiftLabel: string;
  note: string;
  createdAt: string;
};

export type AgendaFollowUp = {
  id: string;
  summary: string;
  followUpAt: string;
  priority: string;
  organizationName: string;
  personSpokenTo: string;
};

export type CareAgendaData = {
  appointments: AgendaAppointment[];
  tasks: AgendaTask[];
  shifts: AgendaShift[];
  handoffs: AgendaHandoff[];
  followUps: AgendaFollowUp[];
};

export async function loadCareAgendaData(input: {
  careRecipientId: string;
  rangeStartIso: string;
  rangeEndIso: string;
}) {
  const historyStart = new Date(
    new Date(input.rangeStartIso).getTime() - 24 * 60 * 60_000,
  ).toISOString();

  const [appointments, tasks, shifts, handoffs, communications] =
    await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, title, starts_at, appointment_date, appointment_time, location, notes",
        )
        .eq("care_recipient_id", input.careRecipientId)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("care_tasks")
        .select(
          "id, title, details, due_at, priority, status, assigned_to",
        )
        .eq("care_recipient_id", input.careRecipientId)
        .gte("due_at", historyStart)
        .lt("due_at", input.rangeEndIso)
        .order("due_at", { ascending: true })
        .limit(500),
      supabase
        .from("care_shifts")
        .select(
          "id, caregiver_id, label, starts_at, ends_at, status",
        )
        .eq("care_recipient_id", input.careRecipientId)
        .lt("starts_at", input.rangeEndIso)
        .gt("ends_at", historyStart)
        .order("starts_at", { ascending: true })
        .limit(300),
      supabase
        .from("care_shift_handoffs")
        .select(
          "id, created_by, handoff_to, shift_label, note, created_at",
        )
        .eq("care_recipient_id", input.careRecipientId)
        .gte("created_at", historyStart)
        .lt("created_at", input.rangeEndIso)
        .order("created_at", { ascending: true })
        .limit(200),
      supabase
        .from("care_communications")
        .select(
          "id, summary, follow_up_at, priority, organization_name, person_spoken_to",
        )
        .eq("care_recipient_id", input.careRecipientId)
        .eq("follow_up_needed", true)
        .not("follow_up_at", "is", null)
        .gte("follow_up_at", historyStart)
        .lt("follow_up_at", input.rangeEndIso)
        .order("follow_up_at", { ascending: true })
        .limit(300),
    ]);

  for (const result of [
    appointments,
    tasks,
    shifts,
    handoffs,
    communications,
  ]) {
    if (result.error) throw result.error;
  }

  return {
    appointments: (appointments.data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      startsAt: row.starts_at ?? null,
      appointmentDate: row.appointment_date ?? null,
      appointmentTime: row.appointment_time ?? null,
      location: row.location ?? "",
      notes: row.notes ?? "",
    })),
    tasks: (tasks.data ?? []).map((row: any) => ({
      id: row.id,
      title: row.title,
      details: row.details ?? "",
      dueAt: row.due_at,
      priority: row.priority,
      status: row.status,
      assignedTo: row.assigned_to ?? null,
    })),
    shifts: (shifts.data ?? []).map((row: any) => ({
      id: row.id,
      caregiverId: row.caregiver_id,
      label: row.label,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
    })),
    handoffs: (handoffs.data ?? []).map((row: any) => ({
      id: row.id,
      createdBy: row.created_by ?? null,
      handoffTo: row.handoff_to ?? null,
      shiftLabel: row.shift_label,
      note: row.note ?? "",
      createdAt: row.created_at,
    })),
    followUps: (communications.data ?? []).map((row: any) => ({
      id: row.id,
      summary: row.summary,
      followUpAt: row.follow_up_at,
      priority: row.priority,
      organizationName: row.organization_name ?? "",
      personSpokenTo: row.person_spoken_to ?? "",
    })),
  } satisfies CareAgendaData;
}
