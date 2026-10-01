alter table public.user_preferences
  add column if not exists care_mode text not null default 'advocate'
  check (care_mode in ('advocate','self'));

update public.user_preferences p
set care_mode = 'self'
from public.care_recipients r
where p.active_care_recipient_id = r.id
  and lower(coalesce(r.relationship, '')) = 'myself'
  and p.care_mode <> 'self';
