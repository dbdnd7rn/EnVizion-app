drop policy if exists care_audit_insert_access on public.care_audit_events;
drop policy if exists care_audit_insert_analytics_report on public.care_audit_events;
create policy care_audit_insert_allowed
on public.care_audit_events
for insert
to authenticated
with check (
  (
    actor_user_id = (select auth.uid())
    and action = 'workspace_opened'
    and entity_type = 'care_workspace'
    and entity_id = care_recipient_id
    and private.can_view_care_recipient(care_recipient_id)
  )
  or
  (
    actor_user_id = (select auth.uid())
    and action = 'weekly_coordination_report_generated'
    and entity_type = 'care_analytics'
    and entity_id = care_recipient_id
    and private.can_edit_care_recipient(care_recipient_id)
  )
);

drop policy if exists coaching_requests_select_own on public.coaching_requests;
drop policy if exists coaching_requests_staff_select on public.coaching_requests;
create policy coaching_requests_select_own_or_staff
on public.coaching_requests
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.staff_members s
    where s.user_id = (select auth.uid())
      and s.active = true
      and s.role = any (array['admin'::text, 'advocate'::text])
  )
);

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_staff_select on public.profiles;
create policy profiles_select_own_or_staff
on public.profiles
for select
to authenticated
using (
  (select auth.uid()) = id
  or exists (
    select 1
    from public.staff_members s
    where s.user_id = (select auth.uid())
      and s.active = true
  )
);

drop policy if exists support_messages_insert_caregiver on public.support_messages;
drop policy if exists support_messages_staff_insert on public.support_messages;
create policy support_messages_insert_authorized
on public.support_messages
for insert
to authenticated
with check (
  (
    sender_type = 'caregiver'
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.support_requests r
      where r.id = support_messages.request_id
        and r.user_id = (select auth.uid())
    )
  )
  or
  (
    sender_type = 'staff'
    and user_id = (select auth.uid())
    and exists (
      select 1
      from public.staff_members s
      where s.user_id = (select auth.uid())
        and s.active = true
    )
    and exists (
      select 1
      from public.support_requests r
      where r.id = support_messages.request_id
    )
  )
);

drop policy if exists support_messages_select_own_request on public.support_messages;
drop policy if exists support_messages_staff_select on public.support_messages;
create policy support_messages_select_own_or_staff
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_requests r
    where r.id = support_messages.request_id
      and r.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.staff_members s
    where s.user_id = (select auth.uid())
      and s.active = true
  )
);

drop policy if exists support_requests_select_own on public.support_requests;
drop policy if exists support_requests_staff_select on public.support_requests;
create policy support_requests_select_own_or_staff
on public.support_requests
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or exists (
    select 1
    from public.staff_members s
    where s.user_id = (select auth.uid())
      and s.active = true
  )
);
