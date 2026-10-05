-- The Edge Function verifies the signed-in actor. Only service_role may call
-- the transaction wrapper; browser clients receive SELECT-only RLS access.
create table public.care_advocate_handovers (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references public.care_recipients(id) on delete cascade,
  from_user_id uuid references auth.users(id) on delete set null,
  to_user_id uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','accepted','declined','cancelled','expired')),
  membership_fingerprint text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  resolved_at timestamptz,
  check (from_user_id <> to_user_id)
);
create unique index care_advocate_handovers_one_pending
  on public.care_advocate_handovers(care_recipient_id) where status = 'pending';
create index care_advocate_handovers_from on public.care_advocate_handovers(from_user_id);
create index care_advocate_handovers_to on public.care_advocate_handovers(to_user_id);
alter table public.care_advocate_handovers enable row level security;
revoke all on public.care_advocate_handovers from anon, authenticated;
grant select on public.care_advocate_handovers to authenticated;
grant all on public.care_advocate_handovers to service_role;
create policy handover_participants_read on public.care_advocate_handovers
for select to authenticated using (
  (select auth.uid()) in (from_user_id, to_user_id)
);

-- Existing deployed writers already emit these additional accountability events.
alter table public.care_consent_events drop constraint care_consent_events_event_type_check;
alter table public.care_consent_events add constraint care_consent_events_event_type_check
check (event_type in (
  'owner_initialized','invite_sent','invite_accepted','invite_declined',
  'role_changed','access_revoked','access_reinvited','invite_reminder_sent',
  'invite_auto_reminder_sent','security_remediation_applied','access_recertified',
  'advocate_handover_requested','advocate_handover_accepted',
  'advocate_handover_declined','advocate_handover_cancelled'
));

-- Group identity is an authorization boundary, not an editable profile field.
create function private.protect_handover_identity() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select auth.uid()) is not null then
    if tg_table_name = 'care_groups' and
      (to_jsonb(new)->>'created_by') is distinct from (to_jsonb(old)->>'created_by') then
      raise exception 'Use the confirmed Primary Advocate handover to change ownership.';
    end if;
    if tg_table_name = 'care_recipients' and
      (to_jsonb(new)->>'care_group_id') is distinct from (to_jsonb(old)->>'care_group_id') then
      raise exception 'The care group cannot be reassigned from profile editing.';
    end if;
  end if;
  return new;
end;
$$;
create trigger protect_handover_group_identity before update on public.care_groups
for each row execute function private.protect_handover_identity();
create trigger protect_handover_profile_identity before update on public.care_recipients
for each row execute function private.protect_handover_identity();

create function private.care_advocate_handover(
  p_actor uuid, p_recipient uuid, p_action text, p_target uuid default null,
  p_request uuid default null, p_fingerprint text default null, p_confirm boolean default false
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r public.care_recipients%rowtype;
  h public.care_advocate_handovers%rowtype;
  g public.care_groups%rowtype;
  source_direct public.care_recipient_members%rowtype;
  target_direct public.care_recipient_members%rowtype;
  source_group public.care_group_members%rowtype;
  target_group public.care_group_members%rowtype;
  target_id uuid;
  fingerprint text;
  result_status text;
  event_note text;
begin
  if p_actor is null or p_action is null or p_action not in ('preview','request','accept','decline','cancel') then
    raise exception 'A valid handover actor and action are required.';
  end if;
  if p_action <> 'preview' and p_confirm is distinct from true then
    raise exception 'Explicit confirmation is required.';
  end if;
  select * into r from public.care_recipients where id = p_recipient for update;
  if not found then raise exception 'Care profile not found.'; end if;

  if p_action in ('preview','request') then
    if p_actor <> r.owner_id then raise exception 'Only the current profile owner can start a handover.'; end if;
    target_id := p_target;
  else
    select * into h from public.care_advocate_handovers
      where id = p_request and care_recipient_id = r.id for update;
    if not found then raise exception 'Handover request not found.'; end if;
    if (p_action = 'cancel' and p_actor is distinct from h.from_user_id)
      or (p_action in ('accept','decline') and p_actor is distinct from h.to_user_id) then
      raise exception 'Only the designated handover participant can make this decision.';
    end if;
    if h.status <> 'pending' then raise exception 'This handover is already closed. Refresh the page.'; end if;
    if h.expires_at <= now() then
      update public.care_advocate_handovers set status = 'expired', resolved_at = now() where id = h.id;
      return jsonb_build_object('ok',true,'status','expired');
    end if;
    target_id := h.to_user_id;
    -- Cancellation and decline never depend on membership still matching.
    if p_action in ('cancel','decline') then
      result_status := case p_action when 'cancel' then 'cancelled' else 'declined' end;
    elsif r.owner_id <> h.from_user_id then
      raise exception 'Ownership changed. Cancel this request and start a new handover.';
    end if;
  end if;

  if result_status is null then
    if target_id is null or target_id = r.owner_id then raise exception 'Choose another active Co-Caregiver.'; end if;
    select * into g from public.care_groups where id = r.care_group_id for update;
    if not found or g.created_by is distinct from r.owner_id then
      raise exception 'CareGroup ownership is inconsistent. Resolve the security review first.';
    end if;
    if (select count(*) from public.care_recipients where care_group_id = g.id) <> 1 then
      raise exception 'This CareGroup contains multiple profiles. A group-wide handover is required.';
    end if;
    -- Lock the same membership rows that role changes/revocations update.
    perform 1 from public.care_recipient_members
      where care_recipient_id = r.id and user_id in (r.owner_id,target_id) order by user_id for update;
    perform 1 from public.care_group_members
      where care_group_id = g.id and user_id in (r.owner_id,target_id) order by user_id for update;
    select * into source_direct from public.care_recipient_members where care_recipient_id = r.id and user_id = r.owner_id;
    select * into target_direct from public.care_recipient_members where care_recipient_id = r.id and user_id = target_id;
    select * into source_group from public.care_group_members where care_group_id = g.id and user_id = r.owner_id;
    select * into target_group from public.care_group_members where care_group_id = g.id and user_id = target_id;
    if source_group.status is distinct from 'active' or source_group.role is distinct from 'primary_advocate'
      or (source_direct.user_id is not null and (source_direct.status <> 'active' or source_direct.role <> 'owner')) then
      raise exception 'Outgoing ownership records disagree. Resolve the security review first.';
    end if;
    if target_group.status is distinct from 'active' or target_group.role is distinct from 'co_caregiver'
      or (target_direct.user_id is not null and (target_direct.status <> 'active' or target_direct.role <> 'caregiver')) then
      raise exception 'The incoming advocate must be an active Co-Caregiver with consistent permissions. Care Recipient and Family Member roles cannot accept ownership.';
    end if;
    fingerprint := md5(jsonb_build_object(
      'owner',r.owner_id,'group',g.id,'groupOwner',g.created_by,
      'sourceDirect',to_jsonb(source_direct),'targetDirect',to_jsonb(target_direct),
      'sourceGroup',to_jsonb(source_group),'targetGroup',to_jsonb(target_group)
    )::text);
    if p_action = 'preview' then
      return jsonb_build_object('fingerprint',fingerprint,'fromUserId',r.owner_id,'toUserId',target_id,
        'before','You: Primary Advocate; incoming advocate: Co-Caregiver',
        'after','You: Co-Caregiver; incoming advocate: Primary Advocate');
    end if;
    if fingerprint is distinct from (case when p_action = 'request' then p_fingerprint else h.membership_fingerprint end) then
      raise exception 'Access changed after the preview. Cancel any pending request and preview a new handover.';
    end if;
    if p_action = 'request' then
      update public.care_advocate_handovers set status='expired',resolved_at=now()
        where care_recipient_id=r.id and status='pending' and expires_at <= now();
      if exists(select 1 from public.care_advocate_handovers where care_recipient_id=r.id and status='pending') then
        raise exception 'A handover is already pending. Cancel it before choosing another advocate.';
      end if;
      insert into public.care_advocate_handovers(care_recipient_id,from_user_id,to_user_id,membership_fingerprint)
        values(r.id,r.owner_id,target_id,fingerprint) returning * into h;
      result_status := 'requested';
    else
      -- This transaction changes all authorization sources together. The existing
      -- direct-membership trigger synchronizes CareGroup roles.
      update public.care_recipients set owner_id=target_id,updated_at=now() where id=r.id;
      update public.care_groups set created_by=target_id,updated_at=now() where id=g.id;
      insert into public.care_recipient_members(care_recipient_id,user_id,role,status,accepted_at)
        values(r.id,target_id,'owner','active',now()),(r.id,r.owner_id,'caregiver','active',now())
        on conflict(care_recipient_id,user_id) do update set
          role=excluded.role,status='active',revoked_at=null,updated_at=now();
      update public.care_access_recertifications set status='cancelled',updated_at=now()
        where care_recipient_id=r.id and subject_user_id in (r.owner_id,target_id) and status in ('scheduled','due');
      insert into public.care_access_recertifications(care_recipient_id,subject_user_id,role_snapshot,status,due_at)
        values(r.id,r.owner_id,'caregiver','scheduled',now()+interval '90 days');
      result_status := 'accepted';
    end if;
  end if;

  if result_status <> 'requested' then
    update public.care_advocate_handovers set status=result_status,resolved_at=now() where id=h.id;
  end if;
  event_note := case result_status
    when 'accepted' then 'Confirmed handover: outgoing Primary Advocate -> Co-Caregiver; incoming Co-Caregiver -> Primary Advocate.'
    when 'requested' then 'Primary Advocate handover requested. Access stays unchanged until the incoming advocate accepts within seven days.'
    else 'Primary Advocate handover ' || result_status || '. Access remains unchanged.' end;
  insert into public.care_consent_events(care_recipient_id,actor_user_id,subject_user_id,event_type,role,note)
    values(r.id,p_actor,h.to_user_id,'advocate_handover_'||result_status,
      case when result_status='accepted' then 'owner' else 'caregiver' end,event_note);
  insert into public.care_audit_events(care_recipient_id,actor_user_id,action,entity_type,entity_id,summary)
    values(r.id,p_actor,'advocate_handover_'||result_status,'care_advocate_handover',h.id,event_note);
  insert into public.notifications(user_id,audience,kind,title,body,entity_type,entity_id)
    select id,'caregiver','advocate_handover_'||result_status,'Primary Advocate handover',
      r.display_name || ': ' || event_note,'care_advocate_handover',r.id
    from (select h.from_user_id id union select h.to_user_id) participants where id is not null;
  return jsonb_build_object('ok',true,'status',case when result_status='requested' then 'pending' else result_status end,'id',h.id);
end;
$$;
revoke all on function private.care_advocate_handover(uuid,uuid,text,uuid,uuid,text,boolean) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.care_advocate_handover(uuid,uuid,text,uuid,uuid,text,boolean) to service_role;

create function public.manage_care_advocate_handover(
  p_actor uuid, p_recipient uuid, p_action text, p_target uuid default null,
  p_request uuid default null, p_fingerprint text default null, p_confirm boolean default false
) returns jsonb language sql security invoker set search_path = '' as $$
  select private.care_advocate_handover(p_actor,p_recipient,p_action,p_target,p_request,p_fingerprint,p_confirm);
$$;
revoke all on function public.manage_care_advocate_handover(uuid,uuid,text,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.manage_care_advocate_handover(uuid,uuid,text,uuid,uuid,text,boolean) to service_role;
