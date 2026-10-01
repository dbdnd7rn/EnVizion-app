create table if not exists public.care_groups (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.care_group_members (
  membership_id uuid primary key default gen_random_uuid(),
  care_group_id uuid not null references public.care_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'co_caregiver'
    check (role in ('primary_advocate','co_caregiver','read_only')),
  relationship_to_patient text,
  status text not null default 'active'
    check (status in ('invited','active','revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (care_group_id, user_id)
);

alter table public.profiles
  add column if not exists phone_number text,
  add column if not exists avatar_url text;

alter table public.care_recipients
  add column if not exists care_group_id uuid references public.care_groups(id) on delete restrict;

insert into public.care_groups (id, group_name, created_by, created_at, updated_at)
select
  r.id,
  concat(r.display_name, '''s Care Team'),
  r.owner_id,
  r.created_at,
  r.updated_at
from public.care_recipients r
where r.care_group_id is null
on conflict (id) do nothing;

update public.care_recipients
set care_group_id = id
where care_group_id is null;

alter table public.care_recipients
  alter column care_group_id set not null;

insert into public.care_group_members (
  care_group_id, user_id, role, relationship_to_patient, status, joined_at, created_at, updated_at
)
select
  r.care_group_id,
  r.owner_id,
  'primary_advocate',
  coalesce(r.relationship, 'Primary advocate'),
  'active',
  r.created_at,
  r.created_at,
  r.updated_at
from public.care_recipients r
on conflict (care_group_id, user_id) do update
set role = 'primary_advocate',
    status = 'active',
    updated_at = excluded.updated_at;

insert into public.care_group_members (
  care_group_id, user_id, role, relationship_to_patient, status, invited_by, joined_at, created_at, updated_at
)
select
  r.care_group_id,
  m.user_id,
  case m.role
    when 'owner' then 'primary_advocate'
    when 'caregiver' then 'co_caregiver'
    when 'viewer' then 'read_only'
  end,
  null,
  case when m.status in ('invited','active','revoked') then m.status else 'invited' end,
  m.invited_by,
  m.accepted_at,
  m.created_at,
  m.updated_at
from public.care_recipient_members m
join public.care_recipients r on r.id = m.care_recipient_id
where m.role in ('owner','caregiver','viewer')
  and m.user_id <> r.owner_id
on conflict (care_group_id, user_id) do update
set role = excluded.role,
    status = excluded.status,
    invited_by = excluded.invited_by,
    joined_at = coalesce(excluded.joined_at, public.care_group_members.joined_at),
    updated_at = excluded.updated_at;

create index if not exists care_recipients_care_group_id_idx
  on public.care_recipients(care_group_id);

create index if not exists care_group_members_user_id_idx
  on public.care_group_members(user_id);

create index if not exists care_group_members_group_status_idx
  on public.care_group_members(care_group_id, status);

create or replace function private.can_view_care_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_groups g
    where g.id = target_group_id
      and g.created_by = (select auth.uid())
  )
  or exists (
    select 1
    from public.care_group_members m
    where m.care_group_id = target_group_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function private.can_admin_care_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_groups g
    where g.id = target_group_id
      and g.created_by = (select auth.uid())
  )
  or exists (
    select 1
    from public.care_group_members m
    where m.care_group_id = target_group_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role = 'primary_advocate'
  );
$$;

create or replace function private.can_edit_care_group(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_groups g
    where g.id = target_group_id
      and g.created_by = (select auth.uid())
  )
  or exists (
    select 1
    from public.care_group_members m
    where m.care_group_id = target_group_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('primary_advocate','co_caregiver')
  );
$$;

create or replace function private.can_view_care_recipient(target_recipient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_recipients r
    where r.id = target_recipient_id
      and r.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.care_recipient_members m
    where m.care_recipient_id = target_recipient_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  )
  or exists (
    select 1
    from public.care_recipients r
    join public.care_group_members gm
      on gm.care_group_id = r.care_group_id
    where r.id = target_recipient_id
      and gm.user_id = (select auth.uid())
      and gm.status = 'active'
  );
$$;

create or replace function private.can_edit_care_recipient(target_recipient_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_recipients r
    where r.id = target_recipient_id
      and r.owner_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.care_recipient_members m
    where m.care_recipient_id = target_recipient_id
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and m.role in ('owner','caregiver','patient')
  )
  or exists (
    select 1
    from public.care_recipients r
    join public.care_group_members gm
      on gm.care_group_id = r.care_group_id
    where r.id = target_recipient_id
      and gm.user_id = (select auth.uid())
      and gm.status = 'active'
      and gm.role in ('primary_advocate','co_caregiver')
  );
$$;

create or replace function private.can_assign_care_task(target_recipient_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.care_recipients r
    where r.id = target_recipient_id
      and r.owner_id = target_user_id
  )
  or exists (
    select 1
    from public.care_recipient_members m
    where m.care_recipient_id = target_recipient_id
      and m.user_id = target_user_id
      and m.status = 'active'
      and m.role in ('owner','caregiver','patient')
  )
  or exists (
    select 1
    from public.care_recipients r
    join public.care_group_members gm
      on gm.care_group_id = r.care_group_id
    where r.id = target_recipient_id
      and gm.user_id = target_user_id
      and gm.status = 'active'
      and gm.role in ('primary_advocate','co_caregiver')
  );
$$;

create or replace function private.ensure_care_recipient_group()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.care_group_id is null then
    new.care_group_id := gen_random_uuid();
    insert into public.care_groups (id, group_name, created_by)
    values (
      new.care_group_id,
      concat(new.display_name, '''s Care Team'),
      new.owner_id
    );
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_care_recipient_group_before_insert
on public.care_recipients;

create trigger ensure_care_recipient_group_before_insert
before insert on public.care_recipients
for each row
execute function private.ensure_care_recipient_group();

create or replace function private.ensure_care_group_primary_advocate()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.care_group_members (
    care_group_id, user_id, role, relationship_to_patient, status, joined_at
  )
  values (
    new.care_group_id,
    new.owner_id,
    'primary_advocate',
    coalesce(new.relationship, 'Primary advocate'),
    'active',
    now()
  )
  on conflict (care_group_id, user_id) do update
  set role = 'primary_advocate',
      status = 'active',
      updated_at = now();
  return new;
end;
$$;

drop trigger if exists ensure_care_group_primary_advocate_after_insert
on public.care_recipients;

create trigger ensure_care_group_primary_advocate_after_insert
after insert on public.care_recipients
for each row
execute function private.ensure_care_group_primary_advocate();

alter table public.care_groups enable row level security;
alter table public.care_group_members enable row level security;

drop policy if exists care_groups_select_shared on public.care_groups;
create policy care_groups_select_shared
on public.care_groups
for select
to authenticated
using (private.can_view_care_group(id));

drop policy if exists care_groups_insert_own on public.care_groups;
create policy care_groups_insert_own
on public.care_groups
for insert
to authenticated
with check (created_by = (select auth.uid()));

drop policy if exists care_groups_update_admin on public.care_groups;
create policy care_groups_update_admin
on public.care_groups
for update
to authenticated
using (private.can_admin_care_group(id))
with check (private.can_admin_care_group(id));

drop policy if exists care_groups_delete_admin on public.care_groups;
create policy care_groups_delete_admin
on public.care_groups
for delete
to authenticated
using (private.can_admin_care_group(id));

drop policy if exists care_group_members_select_shared on public.care_group_members;
create policy care_group_members_select_shared
on public.care_group_members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or private.can_view_care_group(care_group_id)
);

drop policy if exists care_group_members_insert_admin on public.care_group_members;
create policy care_group_members_insert_admin
on public.care_group_members
for insert
to authenticated
with check (private.can_admin_care_group(care_group_id));

drop policy if exists care_group_members_update_admin on public.care_group_members;
create policy care_group_members_update_admin
on public.care_group_members
for update
to authenticated
using (private.can_admin_care_group(care_group_id))
with check (private.can_admin_care_group(care_group_id));

drop policy if exists care_group_members_delete_admin on public.care_group_members;
create policy care_group_members_delete_admin
on public.care_group_members
for delete
to authenticated
using (private.can_admin_care_group(care_group_id));
