create table if not exists public.care_access_recertifications (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null
    references public.care_recipients(id) on delete cascade,
  subject_user_id uuid not null
    references auth.users(id) on delete cascade,
  role_snapshot text not null
    check (role_snapshot in ('caregiver', 'viewer')),
  status text not null default 'scheduled'
    check (status in ('scheduled', 'due', 'completed', 'cancelled')),
  due_at timestamptz not null,
  notified_at timestamptz,
  decision text
    check (decision is null or decision in ('keep', 'change_role', 'revoke')),
  role_after text
    check (role_after is null or role_after in ('caregiver', 'viewer')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint care_access_recertifications_completion_check
    check (
      status <> 'completed'
      or (
        reviewed_at is not null
        and reviewed_by is not null
        and decision is not null
      )
    )
);

create index if not exists idx_care_access_recertifications_recipient
  on public.care_access_recertifications(care_recipient_id, due_at desc);

create index if not exists idx_care_access_recertifications_subject
  on public.care_access_recertifications(subject_user_id, due_at desc);

create index if not exists idx_care_access_recertifications_reviewer
  on public.care_access_recertifications(reviewed_by)
  where reviewed_by is not null;

create unique index if not exists uq_care_access_recertifications_open_member
  on public.care_access_recertifications(care_recipient_id, subject_user_id)
  where status in ('scheduled', 'due');

alter table public.care_access_recertifications enable row level security;

drop policy if exists "Primary Advocates can view access recertifications"
  on public.care_access_recertifications;

create policy "Primary Advocates can view access recertifications"
on public.care_access_recertifications
for select
to authenticated
using (
  exists (
    select 1
    from public.care_recipients r
    where r.id = care_access_recertifications.care_recipient_id
      and (
        r.owner_id = auth.uid()
        or (
          r.care_group_id is not null
          and private.can_admin_care_group(r.care_group_id)
        )
      )
  )
);

create or replace function private.dispatch_care_access_recertifications()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  seeded_count integer := 0;
  due_count integer := 0;
  cancelled_count integer := 0;
  notified_count integer := 0;
begin
  with eligible as (
    select
      r.id as care_recipient_id,
      m.user_id as subject_user_id,
      m.role as role_snapshot,
      coalesce(m.accepted_at, m.created_at, m.updated_at, now()) as active_since
    from public.care_recipient_members m
    join public.care_recipients r
      on r.id = m.care_recipient_id
    where m.status = 'active'
      and m.role in ('caregiver', 'viewer')
      and m.user_id <> r.owner_id

    union all

    select
      r.id as care_recipient_id,
      gm.user_id as subject_user_id,
      case gm.role
        when 'co_caregiver' then 'caregiver'
        else 'viewer'
      end as role_snapshot,
      coalesce(gm.joined_at, gm.created_at, gm.updated_at, now()) as active_since
    from public.care_group_members gm
    join public.care_recipients r
      on r.care_group_id = gm.care_group_id
    where gm.status = 'active'
      and gm.role in ('co_caregiver', 'read_only')
      and gm.user_id <> r.owner_id
      and not exists (
        select 1
        from public.care_recipient_members m
        where m.care_recipient_id = r.id
          and m.user_id = gm.user_id
      )
  )
  update public.care_access_recertifications recert
  set status = 'cancelled',
      updated_at = now()
  where recert.status in ('scheduled', 'due')
    and not exists (
      select 1
      from eligible e
      where e.care_recipient_id = recert.care_recipient_id
        and e.subject_user_id = recert.subject_user_id
    );

  get diagnostics cancelled_count = row_count;

  with eligible as (
    select
      r.id as care_recipient_id,
      m.user_id as subject_user_id,
      m.role as role_snapshot,
      coalesce(m.accepted_at, m.created_at, m.updated_at, now()) as active_since
    from public.care_recipient_members m
    join public.care_recipients r
      on r.id = m.care_recipient_id
    where m.status = 'active'
      and m.role in ('caregiver', 'viewer')
      and m.user_id <> r.owner_id

    union all

    select
      r.id as care_recipient_id,
      gm.user_id as subject_user_id,
      case gm.role
        when 'co_caregiver' then 'caregiver'
        else 'viewer'
      end as role_snapshot,
      coalesce(gm.joined_at, gm.created_at, gm.updated_at, now()) as active_since
    from public.care_group_members gm
    join public.care_recipients r
      on r.care_group_id = gm.care_group_id
    where gm.status = 'active'
      and gm.role in ('co_caregiver', 'read_only')
      and gm.user_id <> r.owner_id
      and not exists (
        select 1
        from public.care_recipient_members m
        where m.care_recipient_id = r.id
          and m.user_id = gm.user_id
      )
  ),
  candidates as (
    select
      e.*,
      coalesce(last_review.reviewed_at, e.active_since, now()) + interval '90 days'
        as next_due_at
    from eligible e
    left join lateral (
      select recert.reviewed_at
      from public.care_access_recertifications recert
      where recert.care_recipient_id = e.care_recipient_id
        and recert.subject_user_id = e.subject_user_id
        and recert.status = 'completed'
        and recert.reviewed_at is not null
      order by recert.reviewed_at desc
      limit 1
    ) last_review on true
    where not exists (
      select 1
      from public.care_access_recertifications open_recert
      where open_recert.care_recipient_id = e.care_recipient_id
        and open_recert.subject_user_id = e.subject_user_id
        and open_recert.status in ('scheduled', 'due')
    )
  )
  insert into public.care_access_recertifications (
    care_recipient_id,
    subject_user_id,
    role_snapshot,
    status,
    due_at
  )
  select
    care_recipient_id,
    subject_user_id,
    role_snapshot,
    case when next_due_at <= now() then 'due' else 'scheduled' end,
    next_due_at
  from candidates
  on conflict (care_recipient_id, subject_user_id)
    where status in ('scheduled', 'due')
  do nothing;

  get diagnostics seeded_count = row_count;

  update public.care_access_recertifications
  set status = 'due',
      updated_at = now()
  where status = 'scheduled'
    and due_at <= now();

  get diagnostics due_count = row_count;

  with due_reviews as (
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
      and recert.notified_at is null
  ),
  advocates as (
    select
      d.id as recertification_id,
      d.care_recipient_id,
      d.subject_user_id,
      d.display_name,
      d.owner_id as advocate_user_id
    from due_reviews d

    union

    select
      d.id as recertification_id,
      d.care_recipient_id,
      d.subject_user_id,
      d.display_name,
      gm.user_id as advocate_user_id
    from due_reviews d
    join public.care_group_members gm
      on gm.care_group_id = d.care_group_id
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
    'care_access_recertification_due',
    '90-day care access review due',
    'Review whether an active Co-Caregiver or Family Member still needs access to '
      || a.display_name || '''s care space.',
    'care_access_recertification',
    a.recertification_id
  from advocates a
  where a.advocate_user_id is not null;

  get diagnostics notified_count = row_count;

  update public.care_access_recertifications recert
  set notified_at = now(),
      updated_at = now()
  where recert.status = 'due'
    and recert.notified_at is null;

  return jsonb_build_object(
    'seeded', seeded_count,
    'became_due', due_count,
    'cancelled', cancelled_count,
    'notifications', notified_count
  );
end;
$function$;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'envizion-care-access-recertifications'
  ) then
    perform cron.unschedule('envizion-care-access-recertifications');
  end if;
end $$;

select cron.schedule(
  'envizion-care-access-recertifications',
  '29 */6 * * *',
  'select private.dispatch_care_access_recertifications();'
);
