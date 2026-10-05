-- Isolated PostgreSQL test schema: synthetic identities only, no network or live data.
create schema auth;
create schema private;
create role anon;
create role authenticated;
create role service_role;
create function auth.uid() returns uuid language sql as $$
 select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
$$;
grant usage on schema auth,public to anon,authenticated,service_role;
create table auth.users(id uuid primary key);
create table public.care_groups(id uuid primary key,created_by uuid,updated_at timestamptz default now());
create table public.care_recipients(id uuid primary key,owner_id uuid,care_group_id uuid references public.care_groups(id),display_name text,updated_at timestamptz default now());
create table public.care_recipient_members(
 care_recipient_id uuid references public.care_recipients(id),user_id uuid references auth.users(id),
 role text not null,status text not null,invited_by uuid,accepted_at timestamptz,revoked_at timestamptz,
 created_at timestamptz default now(),updated_at timestamptz default now(),
 primary key(care_recipient_id,user_id)
);
create table public.care_group_members(
 membership_id uuid default gen_random_uuid() primary key,care_group_id uuid references public.care_groups(id),user_id uuid references auth.users(id),
 role text not null,status text not null,invited_by uuid,joined_at timestamptz,
 created_at timestamptz default now(),updated_at timestamptz default now(),unique(care_group_id,user_id)
);
create table public.care_consent_events(
 id uuid default gen_random_uuid(),care_recipient_id uuid,actor_user_id uuid,subject_user_id uuid,event_type text,role text,note text,
 constraint care_consent_events_event_type_check check(event_type in ('owner_initialized','invite_sent','invite_accepted','invite_declined','role_changed','access_revoked','access_reinvited'))
);
create table public.care_audit_events(id uuid default gen_random_uuid(),care_recipient_id uuid,actor_user_id uuid,action text,entity_type text,entity_id uuid,summary text);
create table public.notifications(id uuid default gen_random_uuid(),user_id uuid,audience text,kind text,title text,body text,entity_type text,entity_id uuid);
create table public.care_access_recertifications(
 id uuid primary key default gen_random_uuid(),care_recipient_id uuid,subject_user_id uuid,role_snapshot text,status text,due_at timestamptz,
 decision text,role_after text,reviewed_by uuid,reviewed_at timestamptz,updated_at timestamptz default now()
);
create unique index fixture_open_recert on public.care_access_recertifications(care_recipient_id,subject_user_id) where status in ('scheduled','due');
