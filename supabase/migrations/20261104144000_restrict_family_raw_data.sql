-- Narrow the legacy direct API boundary after the client is using safe RPCs.
-- No patient rows are changed. Caregiver and patient clinical access is preserved.
-- Family viewers retain ONLY: caregiver-shared feed, approved reports, authorized chat,
-- their own practical help offers and explicitly shared visit cards.

create or replace function private.can_view_raw_care_recipient(p_recipient uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    private.can_edit_care_recipient(p_recipient)
    or exists (
      select 1 from public.care_recipient_members m
      where m.care_recipient_id=p_recipient
        and m.user_id=(select auth.uid())
        and m.status='active' and m.role='patient'
    )
  );
$$;
revoke all on function private.can_view_raw_care_recipient(uuid) from public,anon;
grant execute on function private.can_view_raw_care_recipient(uuid) to authenticated;

-- A CareGroup read-only entry is not sufficient after a direct family invite
-- is revoked; only accepted direct memberships and editing group roles count.
create or replace function private.can_view_care_recipient(target_recipient_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.care_recipients r
      where r.id=target_recipient_id and r.owner_id=(select auth.uid())
    )
    or exists (
      select 1 from public.care_recipient_members m
      where m.care_recipient_id=target_recipient_id
        and m.user_id=(select auth.uid()) and m.status='active'
    )
    or exists (
      select 1 from public.care_recipients r
      join public.care_group_members gm on gm.care_group_id=r.care_group_id
      where r.id=target_recipient_id and gm.user_id=(select auth.uid())
        and gm.status='active' and gm.role in ('primary_advocate','co_caregiver')
    )
  );
$$;

-- Replace old broad read predicates with editor/patient-only raw-data access.
-- Preserve all other predicates (ready status, draft controls, staff exceptions).
do $$
declare p record; restricted text; changed integer := 0;
begin
  for p in
    select tablename,policyname,qual from pg_policies
    where schemaname='public' and cmd='SELECT'
      and tablename = any (array[
        'appointment_questions',
        'appointments',
        'care_audit_events',
        'care_communications',
        'care_contacts',
        'care_coordination_comments',
        'care_coordination_history',
        'care_coordination_resolutions',
        'care_coverage_events',
        'care_coverage_request_responses',
        'care_coverage_requests',
        'care_coverage_requirements',
        'care_documents',
        'care_emergency_profiles',
        'care_family_update_acknowledgements',
        'care_observations',
        'care_packet_exports',
        'care_plan_completions',
        'care_plan_items',
        'care_reminders',
        'care_shift_attendance',
        'care_shift_handoff_acknowledgements',
        'care_shift_handoffs',
        'care_shift_swap_requests',
        'care_shifts',
        'care_task_assignments',
        'care_task_completions',
        'care_tasks',
        'care_transition_followups',
        'care_transition_plans',
        'care_weekly_coverage_plans',
        'care_weekly_coverage_slots',
        'care_workspace_presence',
        'caregiver_availability',
        'caregiver_availability_rules',
        'caregiver_shift_session_notes',
        'caregiver_shift_sessions',
        'doctor_visit_questions',
        'doctor_visit_summaries',
        'doctor_visits',
        'medication_reconciliations',
        'medication_records',
        'medications',
        'transition_items',
        'care_recipients'
      ]::text[])
      and qual like '%private.can_view_care_recipient(%'
  loop
    restricted := replace(p.qual,
      'private.can_view_care_recipient(',
      'private.can_view_raw_care_recipient(');
    execute format('alter policy %I on public.%I using (%s)',
      p.policyname,p.tablename,restricted);
    changed := changed + 1;
  end loop;
  if changed < 40 then
    raise exception 'Expected at least 40 shared-read policies to be narrowed, got %', changed;
  end if;
end;
$$;

-- Family members may see published caregiver updates, not private metadata.
alter policy care_family_updates_select_shared on public.care_family_updates
using (
  private.can_view_raw_care_recipient(care_recipient_id)
  or private.is_active_family_viewer(care_recipient_id)
);

-- Members can inspect their own invitation, but only editors manage the roster.
alter policy care_members_select on public.care_recipient_members
using (
  user_id = (select auth.uid())
  or private.can_edit_care_recipient(care_recipient_id)
);

-- Family offer readback must cease when the direct invitation is revoked.
alter policy family_help_offer_read on public.family_help_offers
using (
  private.can_edit_care_recipient(care_recipient_id)
  or (created_by=(select auth.uid()) and private.is_active_family_viewer(care_recipient_id))
);

-- CareGroup read-only members need only their own membership, not the full roster.
create or replace function private.can_review_care_group_members(p_group uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    private.can_admin_care_group(p_group)
    or exists (
      select 1 from public.care_group_members m
      where m.care_group_id=p_group and m.user_id=(select auth.uid())
        and m.status='active' and m.role='co_caregiver'
    )
  );
$$;
revoke all on function private.can_review_care_group_members(uuid) from public,anon;
grant execute on function private.can_review_care_group_members(uuid) to authenticated;
alter policy care_group_members_select_shared on public.care_group_members
using (
  user_id=(select auth.uid())
  or private.can_review_care_group_members(care_group_id)
);

-- Audio is especially sensitive. Only editor/patient access may read the bucket.
alter policy doctor_visit_audio_select_shared on storage.objects
using (
  bucket_id='doctor-visit-audio'
  and private.can_view_raw_care_recipient(private.storage_recipient_from_path(name))
);

-- Revalidate chat authorization on every operation. Read-only CareGroup
-- membership alone no longer bypasses a revoked direct family invitation.
create or replace function private.chat_is_member(target_recipient uuid,target_user uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select target_user is not null and (
    exists (select 1 from public.care_recipients r
      where r.id=target_recipient and r.owner_id=target_user)
    or exists (select 1 from public.care_recipient_members m
      where m.care_recipient_id=target_recipient
        and m.user_id=target_user and m.status='active')
    or exists (
      select 1 from public.care_recipients r
      join public.care_group_members gm on gm.care_group_id=r.care_group_id
      where r.id=target_recipient and gm.user_id=target_user
        and gm.status='active' and gm.role in ('primary_advocate','co_caregiver')
    )
  );
$$;
create or replace function private.chat_can_access(target_conversation uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.chat_conversations c
    where c.id=target_conversation
      and private.chat_is_member(c.care_recipient_id,(select auth.uid()))
      and (c.kind='group' or (select auth.uid()) in (c.direct_user_a,c.direct_user_b))
  );
$$;
create or replace function public.chat_team_people(p_recipient uuid)
returns table(user_id uuid,full_name text,avatar_url text)
language sql stable security definer set search_path = ''
as $$
  with allowed as (
    select r.owner_id uid from public.care_recipients r where r.id=p_recipient
    union
    select m.user_id from public.care_recipient_members m
      where m.care_recipient_id=p_recipient and m.status='active'
    union
    select gm.user_id from public.care_recipients r
      join public.care_group_members gm on gm.care_group_id=r.care_group_id
      where r.id=p_recipient and gm.status='active'
        and gm.role in ('primary_advocate','co_caregiver')
  )
  select a.uid,p.full_name,p.avatar_url from allowed a
  left join public.profiles p on p.id=a.uid
  where (select auth.uid()) is not null
    and private.chat_is_member(p_recipient,(select auth.uid()))
  order by p.full_name nulls last,a.uid;
$$;
