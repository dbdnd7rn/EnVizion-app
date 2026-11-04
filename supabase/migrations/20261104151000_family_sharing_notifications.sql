-- Family Member event notifications are intentionally generic: never copy
-- clinical notes, family messages, patient names or care activity titles.
-- Row-level access is rechecked at read time, including after revocation.
create or replace function private.notify_approved_family_report()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op = 'INSERT' and new.published)
      or (tg_op = 'UPDATE' and new.published and not old.published) then
    insert into public.notifications
      (user_id,audience,kind,title,body,entity_type,entity_id)
    select distinct m.user_id,'caregiver','family_care_report_shared',
      case when new.period='weekly' then 'Weekly family summary available'
           else 'Daily family care summary available' end,
      'The Primary Advocate shared a new care summary. Open EnVizion Life to read it.',
      'family_care_report',new.id
    from public.care_recipient_members m
    where m.care_recipient_id=new.care_recipient_id
      and m.status='active' and m.role='viewer'
      and m.user_id is distinct from new.published_by;
  elsif tg_op = 'UPDATE' and old.published and not new.published then
    -- Remove obsolete notice instead of pointing family to a withdrawn report.
    delete from public.notifications
    where entity_type='family_care_report' and entity_id=new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists notify_approved_family_report on public.family_care_reports;
create trigger notify_approved_family_report
after insert or update of published on public.family_care_reports
for each row execute function private.notify_approved_family_report();

create or replace function private.notify_family_shared_appointment()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (tg_op='INSERT' and new.shared_with_family)
      or (tg_op='UPDATE' and new.shared_with_family and not old.shared_with_family) then
    insert into public.notifications
      (user_id,audience,kind,title,body,entity_type,entity_id)
    select distinct m.user_id,'caregiver','family_appointment_shared',
       'A care appointment was shared',
       'A caregiver shared an appointment with family. Open EnVizion Life for the approved details.',
       'family_shared_appointment',new.id
    from public.care_recipient_members m
    where m.care_recipient_id=new.care_recipient_id
      and m.status='active' and m.role='viewer';
  elsif tg_op='UPDATE' and old.shared_with_family and not new.shared_with_family then
    delete from public.notifications
    where entity_type='family_shared_appointment' and entity_id=new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists notify_family_shared_appointment on public.appointments;
create trigger notify_family_shared_appointment
after insert or update of shared_with_family on public.appointments
for each row execute function private.notify_family_shared_appointment();

create or replace function private.notify_family_help_offer_status()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op='INSERT' and new.status='offered' then
    insert into public.notifications
      (user_id,audience,kind,title,body,entity_type,entity_id)
    select distinct candidates.user_id,'caregiver','family_help_offered',
       'Family member offered practical help',
       'Review a new non-clinical support offer in Family Communication.',
       'family_help_offer',new.id
    from (
      select r.owner_id as user_id
      from public.care_recipients r where r.id=new.care_recipient_id
      union
      select m.user_id from public.care_recipient_members m
      where m.care_recipient_id=new.care_recipient_id and m.status='active'
        and m.role in ('owner','caregiver')
      union
      select gm.user_id from public.care_group_members gm
        join public.care_recipients r on r.care_group_id=gm.care_group_id
      where r.id=new.care_recipient_id and gm.status='active'
        and gm.role in ('primary_advocate','co_caregiver')
    ) candidates
    where candidates.user_id is not null
      and candidates.user_id is distinct from new.created_by;
  elsif tg_op='UPDATE' and old.status='offered'
       and new.status in ('accepted','declined') then
    insert into public.notifications
      (user_id,audience,kind,title,body,entity_type,entity_id)
    select new.created_by,'caregiver','family_help_reviewed',
      case when new.status='accepted' then 'Your help offer was accepted'
           else 'Your help offer was declined' end,
      'A caregiver responded to your practical support offer. Open EnVizion Life to view its status.',
      'family_help_offer',new.id
    where exists (
      select 1 from public.care_recipient_members m
      where m.care_recipient_id=new.care_recipient_id
        and m.user_id=new.created_by and m.role='viewer' and m.status='active'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists notify_family_help_offer_status on public.family_help_offers;
create trigger notify_family_help_offer_status
after insert or update of status on public.family_help_offers
for each row execute function private.notify_family_help_offer_status();

-- Existing family update/chat notices may remain in history after access
-- is revoked. Read-time RLS blocks them if the referenced item is no longer
-- visible. This is restrictive: it also applies to UPDATE's required SELECT.
drop policy if exists notifications_care_event_current_access on public.notifications;
create policy notifications_care_event_current_access
on public.notifications as restrictive for select to authenticated
using (
  case entity_type
    when 'care_family_update' then exists (
      select 1 from public.care_family_updates u where u.id=entity_id
        and (private.can_view_raw_care_recipient(u.care_recipient_id)
             or private.is_active_family_viewer(u.care_recipient_id))
    )
    when 'family_care_report' then exists (
      select 1 from public.family_care_reports r
      where r.id=entity_id and r.published
        and (private.can_edit_care_recipient(r.care_recipient_id)
          or private.is_active_family_viewer(r.care_recipient_id))
    )
    when 'family_shared_appointment' then exists (
      select 1 from public.appointments a
      where a.id=entity_id and a.shared_with_family
        and private.is_active_family_viewer(a.care_recipient_id)
    )
    when 'family_help_offer' then exists (
      select 1 from public.family_help_offers h
      where h.id=entity_id and (
        private.can_edit_care_recipient(h.care_recipient_id)
        or (h.created_by=(select auth.uid())
             and private.is_active_family_viewer(h.care_recipient_id))
      )
    )
    when 'care_chat' then exists (
      select 1 from public.chat_conversations c where c.id=entity_id
    )
    else true
  end
);

comment on function private.notify_approved_family_report() is
 'Only notifies active direct family members when a Primary Advocate publishes a care summary; withdrawn shares retract notices.';
comment on function private.notify_family_shared_appointment() is
 'Notifies current family members only on explicit appointment sharing, never on private appointment changes.';
comment on function private.notify_family_help_offer_status() is
 'Routes generic practical-help notifications to current care editors and back to an active offer author.';
