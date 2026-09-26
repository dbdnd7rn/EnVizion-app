drop policy if exists care_recipients_select_shared
on public.care_recipients;

create policy care_recipients_select_shared
on public.care_recipients
for select
to authenticated
using (
  owner_id = (select auth.uid())
  or private.can_view_care_recipient(id)
  or exists (
    select 1
    from public.staff_members s
    where s.user_id = (select auth.uid())
      and s.active = true
  )
);
