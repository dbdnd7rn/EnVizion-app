alter table public.care_access_recertifications
  add column if not exists advance_notified_at timestamptz,
  add column if not exists overdue_7d_notified_at timestamptz,
  add column if not exists overdue_14d_notified_at timestamptz;

create or replace function private.dispatch_care_access_recertification_escalations()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  upcoming_count integer := 0;
  overdue_7d_count integer := 0;
  overdue_14d_count integer := 0;
begin
  with upcoming as (
    select
      recert.id,
      recert.care_recipient_id,
      recert.subject_user_id,
      r.owner_id,
      r.care_group_id,
      r.display_name
    from public.care_access_recertifications recert
    join public.care_recipients r
      on r.id = recert.care_recipient_id
    where recert.status = 'scheduled'
      and recert.due_at > now()
      and recert.due_at <= now() + interval '7 days'
      and recert.advance_notified_at is null
  ),
  advocates as (
    select
      u.id as recertification_id,
      u.care_recipient_id,
      u.display_name,
      u.owner_id as advocate_user_id
    from upcoming u

    union

    select
      u.id as recertification_id,
      u.care_recipient_id,
      u.display_name,
      gm.user_id as advocate_user_id
    from upcoming u
    join public.care_group_members gm
      on gm.care_group_id = u.care_group_id
     and gm.status = 'active'
     and gm.role = 'primary_advocate'
  )
  insert into public.notifications (
    user_id,
    audience,
    kind,
    title,
    body,
    entity_type,
    entity_id
  )
  select distinct
    a.advocate_user_id,
    'caregiver',
    'care_access_recertification_upcoming',
    'Care access review due soon',
    'A 90-day care-team access review for ' || a.display_name
      || ' is due within 7 days.',
    'care_access_recertification',
    a.recertification_id
  from advocates a
  where a.advocate_user_id is not null;

  get diagnostics upcoming_count = row_count;

  update public.care_access_recertifications recert
  set advance_notified_at = now(),
      updated_at = now()
  where recert.status = 'scheduled'
    and recert.due_at > now()
    and recert.due_at <= now() + interval '7 days'
    and recert.advance_notified_at is null;

  with overdue as (
    select
      recert.id,
      recert.care_recipient_id,
      recert.subject_user_id,
      r.owner_id,
      r.care_group_id,
      r.display_name
    from public.care_access_recertifications recert
    join public.care_recipients r
      on r.id = recert.care_recipient_id
    where recert.status = 'due'
      and recert.due_at <= now() - interval '7 days'
      and recert.overdue_7d_notified_at is null
  ),
  advocates as (
    select
      o.id as recertification_id,
      o.care_recipient_id,
      o.display_name,
      o.owner_id as advocate_user_id
    from overdue o

    union

    select
      o.id as recertification_id,
      o.care_recipient_id,
      o.display_name,
      gm.user_id as advocate_user_id
    from overdue o
    join public.care_group_members gm
      on gm.care_group_id = o.care_group_id
     and gm.status = 'active'
     and gm.role = 'primary_advocate'
  )
  insert into public.notifications (
    user_id,
    audience,
    kind,
    title,
    body,
    entity_type,
    entity_id
  )
  select distinct
    a.advocate_user_id,
    'caregiver',
    'care_access_recertification_overdue_7d',
    'Care access review overdue',
    'A 90-day care-team access review for ' || a.display_name
      || ' is at least 7 days overdue. Review the member’s access.',
    'care_access_recertification',
    a.recertification_id
  from advocates a
  where a.advocate_user_id is not null;

  get diagnostics overdue_7d_count = row_count;

  update public.care_access_recertifications recert
  set overdue_7d_notified_at = now(),
      updated_at = now()
  where recert.status = 'due'
    and recert.due_at <= now() - interval '7 days'
    and recert.overdue_7d_notified_at is null;

  with overdue as (
    select
      recert.id,
      recert.care_recipient_id,
      recert.subject_user_id,
      r.owner_id,
      r.care_group_id,
      r.display_name
    from public.care_access_recertifications recert
    join public.care_recipients r
      on r.id = recert.care_recipient_id
    where recert.status = 'due'
      and recert.due_at <= now() - interval '14 days'
      and recert.overdue_14d_notified_at is null
  ),
  advocates as (
    select
      o.id as recertification_id,
      o.care_recipient_id,
      o.display_name,
      o.owner_id as advocate_user_id
    from overdue o

    union

    select
      o.id as recertification_id,
      o.care_recipient_id,
      o.display_name,
      gm.user_id as advocate_user_id
    from overdue o
    join public.care_group_members gm
      on gm.care_group_id = o.care_group_id
     and gm.status = 'active'
     and gm.role = 'primary_advocate'
  )
  insert into public.notifications (
    user_id,
    audience,
    kind,
    title,
    body,
    entity_type,
    entity_id
  )
  select distinct
    a.advocate_user_id,
    'caregiver',
    'care_access_recertification_overdue_14d',
    'Care access review needs action',
    'A 90-day care-team access review for ' || a.display_name
      || ' is at least 14 days overdue. Access remains unchanged until a Primary Advocate signs off.',
    'care_access_recertification',
    a.recertification_id
  from advocates a
  where a.advocate_user_id is not null;

  get diagnostics overdue_14d_count = row_count;

  update public.care_access_recertifications recert
  set overdue_14d_notified_at = now(),
      updated_at = now()
  where recert.status = 'due'
    and recert.due_at <= now() - interval '14 days'
    and recert.overdue_14d_notified_at is null;

  return jsonb_build_object(
    'upcoming_notifications', upcoming_count,
    'overdue_7d_notifications', overdue_7d_count,
    'overdue_14d_notifications', overdue_14d_count
  );
end;
$function$;

do $$
begin
  if exists (
    select 1 from cron.job
    where jobname = 'envizion-care-access-recertification-escalations'
  ) then
    perform cron.unschedule('envizion-care-access-recertification-escalations');
  end if;
end $$;

select cron.schedule(
  'envizion-care-access-recertification-escalations',
  '47 */6 * * *',
  'select private.dispatch_care_access_recertification_escalations();'
);
