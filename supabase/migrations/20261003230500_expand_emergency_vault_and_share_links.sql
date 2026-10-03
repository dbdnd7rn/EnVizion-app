alter table public.care_emergency_profiles
  add column if not exists blood_type text,
  add column if not exists primary_language text,
  add column if not exists code_status text not null default 'unknown'
    check (code_status in ('unknown','full_code','dnr','dni','dnr_dni','other')),
  add column if not exists dnr_location text,
  add column if not exists poa_status text not null default 'unknown'
    check (poa_status in ('unknown','none','on_file','not_on_file')),
  add column if not exists poa_name text,
  add column if not exists poa_phone text;

create table if not exists public.emergency_share_links (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references public.care_recipients(id) on delete cascade,
  token_hash text not null unique,
  snapshot jsonb not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  access_count integer not null default 0,
  last_accessed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint emergency_share_links_expiry_check
    check (expires_at > created_at)
);

create index if not exists emergency_share_links_recipient_created_idx
  on public.emergency_share_links(care_recipient_id, created_at desc);

create index if not exists emergency_share_links_expires_idx
  on public.emergency_share_links(expires_at);

create index if not exists emergency_share_links_created_by_idx
  on public.emergency_share_links(created_by);

alter table public.emergency_share_links enable row level security;

drop policy if exists emergency_share_links_select_editors on public.emergency_share_links;
create policy emergency_share_links_select_editors
on public.emergency_share_links
for select
to authenticated
using (private.can_edit_care_recipient(care_recipient_id));

drop policy if exists emergency_share_links_update_editors on public.emergency_share_links;
create policy emergency_share_links_update_editors
on public.emergency_share_links
for update
to authenticated
using (private.can_edit_care_recipient(care_recipient_id))
with check (private.can_edit_care_recipient(care_recipient_id));

drop policy if exists emergency_share_links_delete_editors on public.emergency_share_links;
create policy emergency_share_links_delete_editors
on public.emergency_share_links
for delete
to authenticated
using (private.can_edit_care_recipient(care_recipient_id));
