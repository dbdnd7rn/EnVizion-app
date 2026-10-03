alter table public.care_family_updates
  add column if not exists doctor_visit_id uuid references public.doctor_visits(id) on delete set null;

create index if not exists care_family_updates_doctor_visit_id_idx
  on public.care_family_updates(doctor_visit_id);
