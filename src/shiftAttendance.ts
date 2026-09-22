import { supabase } from "./supabase";

export type CareShiftAttendance = {
  id: string;
  careRecipientId: string;
  shiftId: string;
  caregiverId: string;
  checkedInAt: string;
  checkedOutAt: string | null;
  checkInNote: string;
  checkOutNote: string;
  status: "active" | "completed";
  lateMinutes: number;
  automaticHandoffId: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapAttendance(row: any): CareShiftAttendance {
  return {
    id: row.id,
    careRecipientId: row.care_recipient_id,
    shiftId: row.shift_id,
    caregiverId: row.caregiver_id,
    checkedInAt: row.checked_in_at,
    checkedOutAt: row.checked_out_at ?? null,
    checkInNote: row.check_in_note ?? "",
    checkOutNote: row.check_out_note ?? "",
    status: row.attendance_status,
    lateMinutes: Number(row.late_minutes ?? 0),
    automaticHandoffId: row.automatic_handoff_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function currentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Please sign in again.");
  return user.id;
}

export async function loadShiftAttendance(careRecipientId: string) {
  const { data, error } = await supabase
    .from("care_shift_attendance")
    .select(
      "id, care_recipient_id, shift_id, caregiver_id, checked_in_at, checked_out_at, check_in_note, check_out_note, attendance_status, late_minutes, automatic_handoff_id, created_at, updated_at",
    )
    .eq("care_recipient_id", careRecipientId)
    .order("checked_in_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return (data ?? []).map(mapAttendance);
}

export async function startShiftAttendance(input: {
  careRecipientId: string;
  shiftId: string;
  note: string;
}) {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("care_shift_attendance")
    .insert({
      care_recipient_id: input.careRecipientId,
      shift_id: input.shiftId,
      caregiver_id: userId,
      check_in_note: input.note.trim() || null,
    })
    .select(
      "id, care_recipient_id, shift_id, caregiver_id, checked_in_at, checked_out_at, check_in_note, check_out_note, attendance_status, late_minutes, automatic_handoff_id, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapAttendance(data);
}

export async function endShiftAttendance(input: {
  careRecipientId: string;
  attendanceId: string;
  note: string;
}) {
  const { data, error } = await supabase
    .from("care_shift_attendance")
    .update({
      checked_out_at: new Date().toISOString(),
      attendance_status: "completed",
      check_out_note: input.note.trim() || null,
    })
    .eq("id", input.attendanceId)
    .eq("care_recipient_id", input.careRecipientId)
    .select(
      "id, care_recipient_id, shift_id, caregiver_id, checked_in_at, checked_out_at, check_in_note, check_out_note, attendance_status, late_minutes, automatic_handoff_id, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return mapAttendance(data);
}
