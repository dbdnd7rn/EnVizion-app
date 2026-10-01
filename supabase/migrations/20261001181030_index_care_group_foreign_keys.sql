create index if not exists care_groups_created_by_idx
  on public.care_groups(created_by);

create index if not exists care_group_members_invited_by_idx
  on public.care_group_members(invited_by);
