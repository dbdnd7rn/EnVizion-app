-- EnVizion Life: permission-scoped practical offers of non-clinical help.
create table if not exists public.family_help_offers (
  id uuid primary key default gen_random_uuid(),
  care_recipient_id uuid not null references public.care_recipients(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  help_type text not null check (help_type in ('transport','groceries','errands','companionship','other')),
  note text not null default '' check (char_length(note) <= 500),
  status text not null default 'offered' check (status in ('offered','accepted','declined')),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint family_help_review_integrity check (
    (status = 'offered' and reviewed_by is null and reviewed_at is null)
    or (status in ('accepted','declined') and reviewed_by is not null and reviewed_at is not null)
  )
);
create index if not exists family_help_offers_profile_created_idx
 on public.family_help_offers(care_recipient_id,created_at desc);
create index if not exists family_help_offers_author_idx
 on public.family_help_offers(created_by,created_at desc);
alter table public.family_help_offers enable row level security;
revoke all on public.family_help_offers from public,anon,authenticated;
grant select,insert on public.family_help_offers to authenticated;
grant update (status,reviewed_by,reviewed_at) on public.family_help_offers to authenticated;
create policy "family_help_offer_read"
on public.family_help_offers for select to authenticated
using (
 private.can_edit_care_recipient(care_recipient_id)
 or (created_by = (select auth.uid()) and private.can_view_care_recipient(care_recipient_id))
);
create policy "family_help_offer_submit"
on public.family_help_offers for insert to authenticated
with check (
 created_by = (select auth.uid()) and status = 'offered' and reviewed_by is null and reviewed_at is null
 and private.can_view_care_recipient(care_recipient_id)
 and exists (
  select 1 from public.care_recipient_members m
  where m.care_recipient_id = family_help_offers.care_recipient_id
    and m.user_id = (select auth.uid())
    and m.status = 'active' and m.role = 'viewer'
 )
);
create policy "family_help_offer_review"
on public.family_help_offers for update to authenticated
using (status = 'offered' and private.can_edit_care_recipient(care_recipient_id))
with check (
 status in ('accepted','declined')
 and reviewed_by = (select auth.uid())
 and reviewed_at is not null
 and private.can_edit_care_recipient(care_recipient_id)
);
comment on table public.family_help_offers is 'Family members can offer practical help; only active care editors can accept or decline.';
