alter table public.care_recipient_members
  add column if not exists invite_expires_at timestamptz,
  add column if not exists last_reminded_at timestamptz,
  add column if not exists invite_email_requested_at timestamptz;

update public.care_recipient_members
set invite_expires_at = coalesce(invited_at, created_at, now()) + interval '14 days'
where status = 'invited'
  and invite_expires_at is null;

create index if not exists idx_care_recipient_members_invite_expiry
  on public.care_recipient_members (invite_expires_at)
  where status = 'invited';
