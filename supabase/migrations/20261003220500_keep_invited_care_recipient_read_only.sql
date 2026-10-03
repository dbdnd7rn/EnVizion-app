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
      and m.role in ('owner','caregiver')
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
      and m.role in ('owner','caregiver')
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
