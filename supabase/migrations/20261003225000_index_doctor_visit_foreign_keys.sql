create index if not exists doctor_visits_appointment_id_idx
  on public.doctor_visits(appointment_id);

create index if not exists doctor_visits_recording_consent_by_idx
  on public.doctor_visits(recording_consent_by);

create index if not exists doctor_visit_questions_created_by_idx
  on public.doctor_visit_questions(created_by);

create index if not exists doctor_visit_summaries_created_by_idx
  on public.doctor_visit_summaries(created_by);

create index if not exists doctor_visit_summaries_approved_by_idx
  on public.doctor_visit_summaries(approved_by);
