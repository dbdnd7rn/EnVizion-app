-- Make intentionally server-only pilot operations explicit to the database linter.
revoke all on table public.pilot_acceptance_runs from anon, authenticated;
revoke all on table public.pilot_launch_signoffs from anon, authenticated;
revoke all on table public.pilot_launch_waves from anon, authenticated;
revoke all on table public.pilot_recovery_drills from anon, authenticated;

drop policy if exists pilot_acceptance_runs_deny_clients on public.pilot_acceptance_runs;
create policy pilot_acceptance_runs_deny_clients
on public.pilot_acceptance_runs
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists pilot_launch_signoffs_deny_clients on public.pilot_launch_signoffs;
create policy pilot_launch_signoffs_deny_clients
on public.pilot_launch_signoffs
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists pilot_launch_waves_deny_clients on public.pilot_launch_waves;
create policy pilot_launch_waves_deny_clients
on public.pilot_launch_waves
for all
to anon, authenticated
using (false)
with check (false);

drop policy if exists pilot_recovery_drills_deny_clients on public.pilot_recovery_drills;
create policy pilot_recovery_drills_deny_clients
on public.pilot_recovery_drills
for all
to anon, authenticated
using (false)
with check (false);

-- Extend care audit labels to new clinical/emergency modules.
create or replace function private.log_care_record_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  source jsonb;
  recipient_id uuid;
  row_id uuid;
  actor_id uuid;
  label text;
begin
  actor_id := (select auth.uid());

  if actor_id is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  source := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  recipient_id := nullif(source->>'care_recipient_id','')::uuid;

  if recipient_id is null and tg_table_name = 'care_recipients' then
    recipient_id := nullif(source->>'id','')::uuid;
  end if;

  row_id := nullif(source->>'id','')::uuid;

  if recipient_id is not null then
    label := case tg_table_name
      when 'care_observations' then 'Care observation'
      when 'medications' then 'Medication'
      when 'medication_records' then 'Medication record'
      when 'appointments' then 'Appointment'
      when 'appointment_questions' then 'Appointment question'
      when 'transition_items' then 'Transition checklist item'
      when 'care_reminders' then 'Care reminder'
      when 'care_tasks' then 'Care task'
      when 'care_task_completions' then 'Care task completion'
      when 'care_shift_handoffs' then 'Caregiver shift handoff'
      when 'caregiver_availability' then 'Caregiver availability'
      when 'care_shifts' then 'Caregiver shift'
      when 'care_shift_attendance' then 'Caregiver shift attendance'
      when 'care_shift_swap_requests' then 'Caregiver shift swap'
      when 'care_recipients' then 'Care profile'
      when 'doctor_visits' then 'Doctor visit'
      when 'doctor_visit_questions' then 'Doctor visit question'
      when 'doctor_visit_summaries' then 'Doctor visit summary'
      when 'care_emergency_profiles' then 'Emergency profile'
      when 'care_documents' then 'Care Vault document'
      else tg_table_name
    end;

    insert into public.care_audit_events (
      care_recipient_id,
      actor_user_id,
      action,
      entity_type,
      entity_id,
      summary
    )
    values (
      recipient_id,
      actor_id,
      lower(tg_op),
      tg_table_name,
      row_id,
      label || ' ' || lower(tg_op)
    );
  end if;

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$function$;

drop trigger if exists audit_change_doctor_visits on public.doctor_visits;
create trigger audit_change_doctor_visits
after insert or update or delete on public.doctor_visits
for each row execute function private.log_care_record_change();

drop trigger if exists audit_change_doctor_visit_questions on public.doctor_visit_questions;
create trigger audit_change_doctor_visit_questions
after insert or update or delete on public.doctor_visit_questions
for each row execute function private.log_care_record_change();

drop trigger if exists audit_change_doctor_visit_summaries on public.doctor_visit_summaries;
create trigger audit_change_doctor_visit_summaries
after insert or update or delete on public.doctor_visit_summaries
for each row execute function private.log_care_record_change();

drop trigger if exists audit_change_care_documents on public.care_documents;
create trigger audit_change_care_documents
after insert or update or delete on public.care_documents
for each row execute function private.log_care_record_change();

-- Cover remaining foreign keys called out by Supabase's performance advisor.
create index if not exists care_coverage_forecast_alert_events_owner_user_id_idx
  on private.care_coverage_forecast_alert_events(owner_user_id);
create index if not exists care_coverage_forecast_alert_events_requirement_id_idx
  on private.care_coverage_forecast_alert_events(requirement_id);
create index if not exists care_coverage_forecast_snoozes_owner_user_id_idx
  on private.care_coverage_forecast_snoozes(owner_user_id);
create index if not exists care_coverage_forecast_snoozes_requirement_id_idx
  on private.care_coverage_forecast_snoozes(requirement_id);
create index if not exists care_weekly_coverage_approval_nudge_events_user_id_idx
  on private.care_weekly_coverage_approval_nudge_events(user_id);
create index if not exists pilot_completion_events_actor_user_id_idx
  on private.pilot_completion_events(actor_user_id);
create index if not exists pilot_onboarding_reminder_events_notification_id_idx
  on private.pilot_onboarding_reminder_events(notification_id);

create index if not exists care_plan_completions_completed_by_idx
  on public.care_plan_completions(completed_by);
create index if not exists care_plan_items_assigned_to_idx
  on public.care_plan_items(assigned_to);
create index if not exists care_plan_items_created_by_idx
  on public.care_plan_items(created_by);
create index if not exists care_transition_followups_completed_by_idx
  on public.care_transition_followups(completed_by);
create index if not exists care_transition_followups_created_by_idx
  on public.care_transition_followups(created_by);
create index if not exists care_transition_followups_plan_recipient_idx
  on public.care_transition_followups(plan_id, care_recipient_id);
create index if not exists care_transition_plans_created_by_idx
  on public.care_transition_plans(created_by);
create index if not exists care_weekly_coverage_slots_owner_released_by_idx
  on public.care_weekly_coverage_slots(owner_released_by);
create index if not exists medication_reconciliations_created_by_idx
  on public.medication_reconciliations(created_by);
