create or replace function public.apply_care_access_recertification(
  target_recertification_id uuid,
  target_care_recipient_id uuid,
  target_actor_user_id uuid,
  target_decision text,
  target_role_after text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  recert public.care_access_recertifications%rowtype;
  recipient public.care_recipients%rowtype;
  direct_member public.care_recipient_members%rowtype;
  group_member public.care_group_members%rowtype;
  current_access_role text;
  group_role_mapped text;
  final_role text;
  before_label text;
  after_label text;
  now_at timestamptz := now();
  next_due_at timestamptz;
begin
  if target_decision not in ('keep', 'change_role', 'revoke') then
    raise exception 'A valid recertification decision is required.';
  end if;

  select *
    into recipient
  from public.care_recipients
  where id = target_care_recipient_id;

  if not found then
    raise exception 'Care profile not found.';
  end if;

  if not (
    recipient.owner_id = target_actor_user_id
    or exists (
      select 1
      from public.care_recipient_members m
      where m.care_recipient_id = recipient.id
        and m.user_id = target_actor_user_id
        and m.status = 'active'
        and m.role = 'owner'
    )
    or (
      recipient.care_group_id is not null
      and exists (
        select 1
        from public.care_group_members gm
        where gm.care_group_id = recipient.care_group_id
          and gm.user_id = target_actor_user_id
          and gm.status = 'active'
          and gm.role = 'primary_advocate'
      )
    )
  ) then
    raise exception 'Only a Primary Advocate can sign off access recertification.';
  end if;

  select *
    into recert
  from public.care_access_recertifications
  where id = target_recertification_id
    and care_recipient_id = target_care_recipient_id
  for update;

  if not found then
    raise exception 'Access recertification not found.';
  end if;

  if recert.status <> 'due' then
    raise exception 'This access review is no longer due. Refresh the review list.';
  end if;

  if recert.subject_user_id = recipient.owner_id then
    raise exception 'Primary Advocate ownership cannot be recertified here.';
  end if;

  select *
    into direct_member
  from public.care_recipient_members
  where care_recipient_id = recipient.id
    and user_id = recert.subject_user_id;

  if recipient.care_group_id is not null then
    select *
      into group_member
    from public.care_group_members
    where care_group_id = recipient.care_group_id
      and user_id = recert.subject_user_id;
  end if;

  group_role_mapped := case
    when group_member.role = 'co_caregiver' then 'caregiver'
    when group_member.role = 'read_only' then 'viewer'
    when group_member.role = 'primary_advocate' then 'owner'
    else null
  end;

  if direct_member.user_id is not null then
    if direct_member.status <> 'active'
       or direct_member.role not in ('caregiver', 'viewer') then
      raise exception 'This member no longer has recertifiable active access. Run the security review again.';
    end if;

    current_access_role := direct_member.role;

    if recipient.care_group_id is not null then
      if group_member.user_id is null
         or group_member.status <> 'active'
         or group_role_mapped is distinct from current_access_role then
        raise exception 'Membership records changed or disagree. Resolve the Care Team Security Review before recertifying access.';
      end if;
    end if;
  else
    if group_member.user_id is null
       or group_member.status <> 'active'
       or group_role_mapped not in ('caregiver', 'viewer') then
      raise exception 'This member no longer has recertifiable active access. Run the security review again.';
    end if;

    current_access_role := group_role_mapped;
  end if;

  if recert.role_snapshot is distinct from current_access_role then
    raise exception 'The member role changed after this review was created. Refresh before signing off.';
  end if;

  if target_decision = 'change_role' then
    if target_role_after not in ('caregiver', 'viewer') then
      raise exception 'Choose Co-Caregiver or Family Member as the new role.';
    end if;
    if target_role_after = current_access_role then
      raise exception 'Choose a different role, or keep the current access.';
    end if;
    final_role := target_role_after;
  elsif target_decision = 'keep' then
    final_role := current_access_role;
  else
    final_role := null;
  end if;

  before_label := case current_access_role
    when 'caregiver' then 'Co-Caregiver'
    when 'viewer' then 'Family Member'
    else current_access_role
  end;

  after_label := case
    when target_decision = 'revoke' then 'Access revoked'
    when final_role = 'caregiver' then 'Co-Caregiver'
    when final_role = 'viewer' then 'Family Member'
    else 'Access updated'
  end;

  if target_decision = 'change_role' then
    if direct_member.user_id is not null then
      update public.care_recipient_members
      set role = final_role,
          updated_at = now_at
      where care_recipient_id = recipient.id
        and user_id = recert.subject_user_id;
    else
      update public.care_group_members
      set role = case final_role
            when 'caregiver' then 'co_caregiver'
            else 'read_only'
          end,
          updated_at = now_at
      where care_group_id = recipient.care_group_id
        and user_id = recert.subject_user_id;
    end if;
  elsif target_decision = 'revoke' then
    if direct_member.user_id is not null then
      update public.care_recipient_members
      set status = 'revoked',
          revoked_at = now_at,
          updated_at = now_at
      where care_recipient_id = recipient.id
        and user_id = recert.subject_user_id;
    else
      update public.care_group_members
      set status = 'revoked',
          joined_at = null,
          updated_at = now_at
      where care_group_id = recipient.care_group_id
        and user_id = recert.subject_user_id;
    end if;
  end if;

  update public.care_access_recertifications
  set status = 'completed',
      decision = target_decision,
      role_after = final_role,
      reviewed_by = target_actor_user_id,
      reviewed_at = now_at,
      updated_at = now_at
  where id = recert.id;

  if target_decision <> 'revoke' then
    next_due_at := now_at + interval '90 days';

    insert into public.care_access_recertifications (
      care_recipient_id,
      subject_user_id,
      role_snapshot,
      status,
      due_at
    )
    values (
      recipient.id,
      recert.subject_user_id,
      final_role,
      'scheduled',
      next_due_at
    )
    on conflict (care_recipient_id, subject_user_id)
      where status in ('scheduled', 'due')
    do nothing;
  end if;

  insert into public.care_consent_events (
    care_recipient_id,
    actor_user_id,
    subject_user_id,
    event_type,
    role,
    note
  )
  values (
    recipient.id,
    target_actor_user_id,
    recert.subject_user_id,
    'access_recertified',
    coalesce(final_role, current_access_role),
    '90-day access review · ' || initcap(replace(target_decision, '_', ' '))
      || ' · ' || before_label || ' -> ' || after_label
  );

  insert into public.care_audit_events (
    care_recipient_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    summary
  )
  values (
    recipient.id,
    target_actor_user_id,
    'access_recertification_completed',
    'care_team_member',
    recert.subject_user_id,
    '90-day access review · ' || before_label || ' -> ' || after_label
  );

  insert into public.notifications (
    user_id,
    audience,
    kind,
    title,
    body,
    entity_type,
    entity_id
  )
  values (
    recert.subject_user_id,
    'caregiver',
    'care_access_recertified',
    'Care team access reviewed',
    case target_decision
      when 'keep' then
        'A Primary Advocate confirmed that your ' || before_label
          || ' access to ' || recipient.display_name || ' is still needed.'
      when 'change_role' then
        'A Primary Advocate changed your access to ' || recipient.display_name
          || ' from ' || before_label || ' to ' || after_label || '.'
      else
        'A Primary Advocate ended your care-team access to '
          || recipient.display_name || ' during a 90-day access review.'
    end,
    'care_recipient',
    recipient.id
  );

  return jsonb_build_object(
    'ok', true,
    'subjectUserId', recert.subject_user_id,
    'decision', target_decision,
    'before', before_label,
    'after', after_label,
    'nextDueAt', next_due_at
  );
end;
$function$;

revoke all on function public.apply_care_access_recertification(
  uuid, uuid, uuid, text, text
) from public, anon, authenticated;

grant execute on function public.apply_care_access_recertification(
  uuid, uuid, uuid, text, text
) to service_role;
