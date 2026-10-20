-- A caregiver may display teammates' private profile photos only while sharing an active care context.
-- Keep the original owner-only write/delete policies unchanged.
create function private.chat_can_view_avatar(target_user uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select target_user is not null and (select auth.uid()) is not null and exists (
    select 1 from public.care_recipients r
    where private.chat_is_member(r.id, target_user)
      and private.chat_is_member(r.id, (select auth.uid()))
  );
$$;
revoke all on function private.chat_can_view_avatar(uuid) from public, anon;
grant execute on function private.chat_can_view_avatar(uuid) to authenticated;

create policy caregiver_avatars_select_shared_chat
on storage.objects for select to authenticated
using (
  bucket_id='caregiver-avatars'
  and private.chat_can_view_avatar(
    case when split_part(name,'/',1) ~* '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$'
    then split_part(name,'/',1)::uuid else null::uuid end
  )
);
