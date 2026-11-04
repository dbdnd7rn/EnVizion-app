-- Approved, minimal family-facing snapshots; raw care records are never exposed by this feature.
create table if not exists public.family_care_reports (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references public.care_recipients(id) on delete cascade,
  period text not null check (period in ('daily','weekly')),
  start_on date not null,
  planned_count integer not null default 0 check (planned_count between 0 and 5000),
  completed_count integer not null default 0 check (completed_count >= 0 and completed_count <= planned_count),
  activities jsonb not null default '[]'::jsonb check (jsonb_typeof(activities) = 'array'),
  summary_note text not null default '' check (char_length(summary_note) <= 800),
  published boolean not null default false,
  created_by uuid not null references auth.users(id),
  published_by uuid references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint family_report_publish_integrity check (
    (published = true and published_by is not null and published_at is not null)
    or (published = false and published_by is null and published_at is null)
  ),
  unique (care_recipient_id, period, start_on)
);
create index if not exists family_care_reports_recipient_recent_idx
  on public.family_care_reports(care_recipient_id,period,start_on desc);

alter table public.family_care_reports enable row level security;
revoke all on public.family_care_reports from public, anon, authenticated;
grant select, insert on public.family_care_reports to authenticated;
grant update (planned_count, completed_count, activities, summary_note,
  published, published_by, published_at, updated_at) on public.family_care_reports to authenticated;

create policy family_care_reports_read on public.family_care_reports
for select to authenticated
using (
  private.can_edit_care_recipient(care_recipient_id)
  or (
    published
    and private.can_view_care_recipient(care_recipient_id)
    and exists (
      select 1 from public.care_recipient_members m
      where m.care_recipient_id = family_care_reports.care_recipient_id
        and m.user_id = (select auth.uid())
        and m.status = 'active' and m.role = 'viewer'
    )
  )
);

create policy family_care_reports_create_owner on public.family_care_reports
for insert to authenticated
with check (
  private.is_care_recipient_owner(care_recipient_id)
  and created_by = (select auth.uid())
  and (
    (published and published_by = (select auth.uid()) and published_at is not null)
    or (not published and published_by is null and published_at is null)
  )
);

create policy family_care_reports_update_owner on public.family_care_reports
for update to authenticated
using (private.is_care_recipient_owner(care_recipient_id))
with check (
  private.is_care_recipient_owner(care_recipient_id)
  and (
    (published and published_by = (select auth.uid()) and published_at is not null)
    or (not published and published_by is null and published_at is null)
  )
);

comment on table public.family_care_reports is
  'Primary Advocate-approved, non-clinical snapshots of care routines shared with active family viewers. No raw vitals, medication, notes or clinical records.';
