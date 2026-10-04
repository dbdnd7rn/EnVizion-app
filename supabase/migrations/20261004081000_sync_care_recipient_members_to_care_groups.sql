create or replace function private.sync_care_group_member_from_recipient_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_group_id uuid;
  mapped_role text;
  mapped_status text;
begin
  select r.care_group_id
    into target_group_id
  from public.care_recipients r
  where r.id = new.care_recipient_id;

  if target_group_id is null then
    return new;
  end if;

  -- Care Recipient access is intentionally patient-specific and read-only.
  -- It must not accidentally grant group-wide family/caregiver access.
  if new.role = 'patient' then
    update public.care_group_members
    set status = 'revoked',
        joined_at = null,
        updated_at = now()
    where care_group_id = target_group_id
      and user_id = new.user_id
      and role <> 'primary_advocate';

    return new;
  end if;

  mapped_role := case new.role
    when 'owner' then 'primary_advocate'
    when 'caregiver' then 'co_caregiver'
    when 'viewer' then 'read_only'
    else null
  end;

  if mapped_role is null then
    return new;
  end if;

  mapped_status := case new.status
    when 'active' then 'active'
    when 'invited' then 'invited'
    else 'revoked'
  end;

  insert into public.care_group_members (
    care_group_id,
    user_id,
    role,
    status,
    invited_by,
    joined_at,
    created_at,
    updated_at
  )
  values (
    target_group_id,
    new.user_id,
    mapped_role,
    mapped_status,
    new.invited_by,
    case when mapped_status = 'active'
      then coalesce(new.accepted_at, now())
      else null
    end,
    now(),
    now()
  )
  on conflict (care_group_id, user_id)
  do update set
    role = excluded.role,
    status = excluded.status,
    invited_by = excluded.invited_by,
    joined_at = case
      when excluded.status = 'active'
        then coalesce(public.care_group_members.joined_at, excluded.joined_at, now())
      else null
    end,
    updated_at = now();

  return new;
end;
$function$;

drop trigger if exists sync_care_group_member_from_recipient_member
  on public.care_recipient_members;

create trigger sync_care_group_member_from_recipient_member
after insert or update of role, status, invited_by, accepted_at, revoked_at
on public.care_recipient_members
for each row
execute function private.sync_care_group_member_from_recipient_member();

-- Reconcile all existing direct memberships immediately.
insert into public.care_group_members (
  care_group_id,
  user_id,
  role,
  status,
  invited_by,
  joined_at,
  created_at,
  updated_at
)
select
  r.care_group_id,
  m.user_id,
  case m.role
    when 'owner' then 'primary_advocate'
    when 'caregiver' then 'co_caregiver'
    else 'read_only'
  end,
  case m.status
    when 'active' then 'active'
    when 'invited' then 'invited'
    else 'revoked'
  end,
  m.invited_by,
  case
    when m.status = 'active' then coalesce(m.accepted_at, m.created_at, now())
    else null
  end,
  coalesce(m.created_at, now()),
  now()
from public.care_recipient_members m
join public.care_recipients r
  on r.id = m.care_recipient_id
where r.care_group_id is not null
  and m.role in ('owner','caregiver','viewer')
on conflict (care_group_id, user_id)
do update set
  role = excluded.role,
  status = excluded.status,
  invited_by = excluded.invited_by,
  joined_at = case
    when excluded.status = 'active'
      then coalesce(public.care_group_members.joined_at, excluded.joined_at, now())
    else null
  end,
  updated_at = now();

update public.care_group_members gm
set status = 'revoked',
    joined_at = null,
    updated_at = now()
from public.care_recipient_members m
join public.care_recipients r
  on r.id = m.care_recipient_id
where m.role = 'patient'
  and r.care_group_id = gm.care_group_id
  and m.user_id = gm.user_id
  and gm.role <> 'primary_advocate';
