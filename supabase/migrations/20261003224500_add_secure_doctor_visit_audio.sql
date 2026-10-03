alter table public.doctor_visits
  add column if not exists audio_path text,
  add column if not exists audio_mime_type text,
  add column if not exists audio_size_bytes bigint,
  add column if not exists audio_duration_ms integer,
  add column if not exists audio_uploaded_at timestamptz,
  add column if not exists transcription_status text not null default 'none'
    check (transcription_status in ('none','queued','processing','completed','failed')),
  add column if not exists transcription_error text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'doctor-visit-audio',
  'doctor-visit-audio',
  false,
  104857600,
  array[
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/aac',
    'audio/webm',
    'audio/3gpp',
    'audio/wav',
    'audio/x-wav'
  ]::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.storage_recipient_from_path(path text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(path, '/', 1)::uuid;
exception
  when others then
    return null;
end;
$$;

drop policy if exists doctor_visit_audio_select_shared on storage.objects;
create policy doctor_visit_audio_select_shared
on storage.objects
for select
to authenticated
using (
  bucket_id = 'doctor-visit-audio'
  and private.can_view_care_recipient(private.storage_recipient_from_path(name))
);

drop policy if exists doctor_visit_audio_insert_editors on storage.objects;
create policy doctor_visit_audio_insert_editors
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'doctor-visit-audio'
  and owner_id = (select auth.uid()::text)
  and private.can_edit_care_recipient(private.storage_recipient_from_path(name))
);

drop policy if exists doctor_visit_audio_update_editors on storage.objects;
create policy doctor_visit_audio_update_editors
on storage.objects
for update
to authenticated
using (
  bucket_id = 'doctor-visit-audio'
  and private.can_edit_care_recipient(private.storage_recipient_from_path(name))
)
with check (
  bucket_id = 'doctor-visit-audio'
  and private.can_edit_care_recipient(private.storage_recipient_from_path(name))
);

drop policy if exists doctor_visit_audio_delete_editors on storage.objects;
create policy doctor_visit_audio_delete_editors
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'doctor-visit-audio'
  and private.can_edit_care_recipient(private.storage_recipient_from_path(name))
);
