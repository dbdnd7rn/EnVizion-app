alter table public.care_recipient_members
  drop constraint if exists care_recipient_members_role_check;

alter table public.care_recipient_members
  add constraint care_recipient_members_role_check
  check (role = any (array['owner'::text, 'caregiver'::text, 'patient'::text, 'viewer'::text]));

alter table public.care_consent_events
  drop constraint if exists care_consent_events_role_check;

alter table public.care_consent_events
  add constraint care_consent_events_role_check
  check (role is null or role = any (array['owner'::text, 'caregiver'::text, 'patient'::text, 'viewer'::text]));
