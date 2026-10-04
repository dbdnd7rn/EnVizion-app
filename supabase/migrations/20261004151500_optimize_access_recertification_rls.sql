drop policy if exists "Primary Advocates can view access recertifications"
  on public.care_access_recertifications;

create policy "Primary Advocates can view access recertifications"
on public.care_access_recertifications
for select
to authenticated
using (
  exists (
    select 1
    from public.care_recipients r
    where r.id = care_access_recertifications.care_recipient_id
      and (
        r.owner_id = (select auth.uid())
        or (
          r.care_group_id is not null
          and private.can_admin_care_group(r.care_group_id)
        )
      )
  )
);
