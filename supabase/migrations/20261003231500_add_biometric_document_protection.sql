alter table public.care_documents
  add column if not exists requires_biometric boolean not null default false;

update public.care_documents
set requires_biometric = true
where category = 'advance_directive'
  and requires_biometric = false;

create index if not exists care_documents_biometric_idx
  on public.care_documents(care_recipient_id, requires_biometric)
  where archived_at is null;
