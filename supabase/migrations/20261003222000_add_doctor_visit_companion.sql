create table if not exists public.doctor_visits (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references public.care_recipients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  physician_name text not null,
  specialty text,
  appointment_datetime timestamptz not null,
  location text,
  status text not null default 'prep'
    check (status in ('prep','in_visit','review','approved','published','cancelled')),
  raw_notes text,
  transcript_text text,
  recording_consent_confirmed boolean not null default false,
  recording_consent_at timestamptz,
  recording_consent_by uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doctor_visit_questions (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.doctor_visits(id) on delete cascade,
  care_recipient_id uuid not null references public.care_recipients(id) on delete cascade,
  question_text text not null,
  category text,
  is_answered boolean not null default false,
  answer_notes text,
  position integer not null default 0,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.doctor_visit_summaries (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references public.doctor_visits(id) on delete cascade,
  care_recipient_id uuid not null references public.care_recipients(id) on delete cascade,
  source_type text not null default 'manual'
    check (source_type in ('manual','ai')),
  status text not null default 'draft'
    check (status in ('draft','approved','superseded')),
  summary_text text,
  new_orders text[] not null default '{}',
  action_items text[] not null default '{}',
  red_flags text[] not null default '{}',
  generation_notes text,
  model_name text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists doctor_visits_recipient_date_idx
  on public.doctor_visits(care_recipient_id, appointment_datetime desc);

create index if not exists doctor_visits_created_by_idx
  on public.doctor_visits(created_by);

create index if not exists doctor_visit_questions_visit_idx
  on public.doctor_visit_questions(visit_id, position, created_at);

create index if not exists doctor_visit_questions_recipient_idx
  on public.doctor_visit_questions(care_recipient_id);

create index if not exists doctor_visit_summaries_visit_idx
  on public.doctor_visit_summaries(visit_id, created_at desc);

create index if not exists doctor_visit_summaries_recipient_idx
  on public.doctor_visit_summaries(care_recipient_id);

alter table public.doctor_visits enable row level security;
alter table public.doctor_visit_questions enable row level security;
alter table public.doctor_visit_summaries enable row level security;

drop policy if exists doctor_visits_select_shared on public.doctor_visits;
create policy doctor_visits_select_shared
on public.doctor_visits
for select
to authenticated
using (private.can_view_care_recipient(care_recipient_id));

drop policy if exists doctor_visits_insert_editors on public.doctor_visits;
create policy doctor_visits_insert_editors
on public.doctor_visits
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_edit_care_recipient(care_recipient_id)
);

drop policy if exists doctor_visits_update_editors on public.doctor_visits;
create policy doctor_visits_update_editors
on public.doctor_visits
for update
to authenticated
using (private.can_edit_care_recipient(care_recipient_id))
with check (private.can_edit_care_recipient(care_recipient_id));

drop policy if exists doctor_visits_delete_editors on public.doctor_visits;
create policy doctor_visits_delete_editors
on public.doctor_visits
for delete
to authenticated
using (private.can_edit_care_recipient(care_recipient_id));

drop policy if exists doctor_visit_questions_select_shared on public.doctor_visit_questions;
create policy doctor_visit_questions_select_shared
on public.doctor_visit_questions
for select
to authenticated
using (private.can_view_care_recipient(care_recipient_id));

drop policy if exists doctor_visit_questions_insert_editors on public.doctor_visit_questions;
create policy doctor_visit_questions_insert_editors
on public.doctor_visit_questions
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_edit_care_recipient(care_recipient_id)
  and exists (
    select 1
    from public.doctor_visits v
    where v.id = visit_id
      and v.care_recipient_id = doctor_visit_questions.care_recipient_id
  )
);

drop policy if exists doctor_visit_questions_update_editors on public.doctor_visit_questions;
create policy doctor_visit_questions_update_editors
on public.doctor_visit_questions
for update
to authenticated
using (private.can_edit_care_recipient(care_recipient_id))
with check (private.can_edit_care_recipient(care_recipient_id));

drop policy if exists doctor_visit_questions_delete_editors on public.doctor_visit_questions;
create policy doctor_visit_questions_delete_editors
on public.doctor_visit_questions
for delete
to authenticated
using (private.can_edit_care_recipient(care_recipient_id));

drop policy if exists doctor_visit_summaries_select_shared on public.doctor_visit_summaries;
create policy doctor_visit_summaries_select_shared
on public.doctor_visit_summaries
for select
to authenticated
using (private.can_view_care_recipient(care_recipient_id));

drop policy if exists doctor_visit_summaries_insert_editors on public.doctor_visit_summaries;
create policy doctor_visit_summaries_insert_editors
on public.doctor_visit_summaries
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and private.can_edit_care_recipient(care_recipient_id)
  and exists (
    select 1
    from public.doctor_visits v
    where v.id = visit_id
      and v.care_recipient_id = doctor_visit_summaries.care_recipient_id
  )
);

drop policy if exists doctor_visit_summaries_update_editors on public.doctor_visit_summaries;
create policy doctor_visit_summaries_update_editors
on public.doctor_visit_summaries
for update
to authenticated
using (private.can_edit_care_recipient(care_recipient_id))
with check (private.can_edit_care_recipient(care_recipient_id));

drop policy if exists doctor_visit_summaries_delete_editors on public.doctor_visit_summaries;
create policy doctor_visit_summaries_delete_editors
on public.doctor_visit_summaries
for delete
to authenticated
using (private.can_edit_care_recipient(care_recipient_id));
