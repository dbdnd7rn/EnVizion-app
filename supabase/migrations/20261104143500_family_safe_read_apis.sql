-- Family-safe read APIs. Additive rollout: deploy the client before restricting raw records.
-- New read functions return an intentionally minimal allowlist of fields.

alter table public.appointments
  add column if not exists shared_with_family boolean not null default false;

create or replace function private.is_active_family_viewer(p_recipient uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.care_recipient_members m
    where m.care_recipient_id = p_recipient
      and m.user_id = (select auth.uid())
      and m.role = 'viewer' and m.status = 'active'
  );
$$;

-- Direct table access will soon be restricted for viewers, so profile
-- switching must read only approved identity fields through this function.
create or replace function private.care_profile_cards_internal()
returns table (
  id uuid, display_name text, relationship text,
  care_group_id uuid, created_at timestamptz, is_owner boolean
) language sql stable security definer set search_path = ''
as $$
  select r.id, r.display_name, r.relationship,
         r.care_group_id, r.created_at,
         (r.owner_id = (select auth.uid())) as is_owner
  from public.care_recipients r
  where (select auth.uid()) is not null
    and private.can_view_care_recipient(r.id)
  order by r.created_at asc;
$$;

-- Public functions execute as caller; privileged reads stay inside private.
create or replace function public.care_accessible_profile_cards()
returns table (
  id uuid, display_name text, relationship text,
  care_group_id uuid, created_at timestamptz, is_owner boolean
) language sql stable security invoker set search_path = ''
as $$
  select * from private.care_profile_cards_internal();
$$;

-- Family appointment rows are deliberately narrower than appointments.
-- No notes, owner IDs, clinical questions, preparation notes or user IDs.
create or replace function private.family_shared_appointment_rows(p_recipient uuid)
returns table (
  id uuid, title text, appointment_date date, appointment_time time,
  starts_at timestamptz, location text, created_at timestamptz
) language sql stable security definer set search_path = ''
as $$
  select a.id, a.title, a.appointment_date, a.appointment_time,
         a.starts_at, a.location, a.created_at
  from public.appointments a
  where a.care_recipient_id = p_recipient
    and a.shared_with_family = true
    and private.is_active_family_viewer(p_recipient)
  order by a.created_at desc
  limit 100;
$$;

create or replace function public.family_shared_appointments(p_recipient uuid)
returns table (
  id uuid, title text, appointment_date date, appointment_time time,
  starts_at timestamptz, location text, created_at timestamptz
) language sql stable security invoker set search_path = ''
as $$
  select * from private.family_shared_appointment_rows(p_recipient);
$$;

revoke all on function private.is_active_family_viewer(uuid) from public,anon;
revoke all on function private.care_profile_cards_internal() from public,anon;
revoke all on function private.family_shared_appointment_rows(uuid) from public,anon;
revoke all on function public.care_accessible_profile_cards() from public,anon;
revoke all on function public.family_shared_appointments(uuid) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.is_active_family_viewer(uuid) to authenticated;
grant execute on function private.care_profile_cards_internal() to authenticated;
grant execute on function private.family_shared_appointment_rows(uuid) to authenticated;
grant execute on function public.care_accessible_profile_cards() to authenticated;
grant execute on function public.family_shared_appointments(uuid) to authenticated;

create index if not exists appointments_family_share_idx
  on public.appointments(care_recipient_id, created_at desc)
  where shared_with_family = true;
