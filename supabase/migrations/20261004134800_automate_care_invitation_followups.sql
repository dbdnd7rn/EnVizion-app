alter table public.care_recipient_members
  add column if not exists auto_reminded_at timestamptz,
  add column if not exists owner_attention_notified_at timestamptz,
  add column if not exists expired_notified_at timestamptz;

create or replace function private.dispatch_care_invitation_followups()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  item record;
  auto_reminders integer := 0;
  owner_attention integer := 0;
  expired_alerts integer := 0;
  target_label text;
  role_label text;
begin
  for item in
    select
      m.care_recipient_id,
      m.user_id,
      m.role,
      m.status,
      m.invited_name,
      m.invited_email,
      m.invite_expires_at,
      m.last_reminded_at,
      m.auto_reminded_at,
      m.owner_attention_notified_at,
      m.expired_notified_at,
      r.owner_id,
      r.display_name
    from public.care_recipient_members m
    join public.care_recipients r
      on r.id = m.care_recipient_id
    where m.status = 'invited'
      and m.invite_expires_at is not null
  loop
    role_label := case item.role
      when 'caregiver' then 'Co-Caregiver'
      when 'patient' then 'Care Recipient'
      when 'viewer' then 'Family Member'
      else 'care team'
    end;

    target_label := coalesce(
      nullif(btrim(item.invited_name), ''),
      nullif(btrim(item.invited_email), ''),
      'A care team member'
    );

    if item.invite_expires_at > now()
       and item.invite_expires_at <= now() + interval '48 hours'
    then
      if item.owner_attention_notified_at is null then
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
          item.owner_id,
          'caregiver',
          'care_invite_needs_attention',
          'Care invitation needs attention',
          target_label || '''s ' || role_label ||
            ' invitation to ' || item.display_name ||
            ' expires within 48 hours.',
          'care_recipient',
          item.care_recipient_id
        );

        update public.care_recipient_members
        set owner_attention_notified_at = now(),
            updated_at = now()
        where care_recipient_id = item.care_recipient_id
          and user_id = item.user_id
          and owner_attention_notified_at is null;

        owner_attention := owner_attention + 1;
      end if;

      if item.auto_reminded_at is null
         and (
           item.last_reminded_at is null
           or item.last_reminded_at <= now() - interval '24 hours'
         )
      then
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
          item.user_id,
          'caregiver',
          'care_invite_expiring',
          'Care invitation expires soon',
          'Your ' || role_label || ' invitation to ' ||
            item.display_name ||
            '''s care space expires within 48 hours. Open EnVizion Life to review it.',
          'care_recipient',
          item.care_recipient_id
        );

        insert into public.care_consent_events (
          care_recipient_id,
          actor_user_id,
          subject_user_id,
          event_type,
          role,
          note
        )
        values (
          item.care_recipient_id,
          null,
          item.user_id,
          'invite_auto_reminder_sent',
          item.role,
          'Automatic reminder sent within the final 48 hours before invitation expiry.'
        );

        update public.care_recipient_members
        set auto_reminded_at = now(),
            last_reminded_at = now(),
            updated_at = now()
        where care_recipient_id = item.care_recipient_id
          and user_id = item.user_id
          and auto_reminded_at is null;

        auto_reminders := auto_reminders + 1;
      end if;
    end if;

    if item.invite_expires_at <= now()
       and item.expired_notified_at is null
    then
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
        item.owner_id,
        'caregiver',
        'care_invite_expired',
        'Care invitation expired',
        target_label || '''s ' || role_label ||
          ' invitation to ' || item.display_name ||
          ' expired. Re-open it from Care Team if access is still needed.',
        'care_recipient',
        item.care_recipient_id
      );

      update public.care_recipient_members
      set expired_notified_at = now(),
          updated_at = now()
      where care_recipient_id = item.care_recipient_id
        and user_id = item.user_id
        and expired_notified_at is null;

      expired_alerts := expired_alerts + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'auto_reminders', auto_reminders,
    'owner_attention', owner_attention,
    'expired_alerts', expired_alerts
  );
end;
$function$;

do $$
begin
  if exists (
    select 1 from cron.job
    where jobname = 'envizion-care-invitation-followups'
  ) then
    perform cron.unschedule('envizion-care-invitation-followups');
  end if;
end $$;

select cron.schedule(
  'envizion-care-invitation-followups',
  '13 * * * *',
  'select private.dispatch_care_invitation_followups();'
);
